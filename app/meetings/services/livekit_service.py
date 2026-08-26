import datetime
import uuid

from livekit.api import (
    AccessToken,
    DeleteRoomRequest,
    LiveKitAPI,
    MuteRoomTrackRequest,
    RoomParticipantIdentity,
    ServerError,
    ServerErrorCode,
    VideoGrants,
)
from livekit.protocol.models import TrackSource

from app.core.config import settings


def study_room_livekit_name(room_id: uuid.UUID) -> str:
    return f"study-room-{room_id}"


class LiveKitService:
    """Server-side LiveKit operations: participant token issuance, plus the admin
    RoomService actions (remove participant, mute/unmute a track, close a room) that back
    Study Room moderation and lifecycle enforcement -- see study_room_router's
    KICK/MUTE/UNMUTE/end/delete handling. The LiveKit room itself is still never explicitly
    *created* here -- LiveKit Cloud creates it on first participant join -- but it can now
    be explicitly closed (`close_room`) rather than only ever left to its own
    `empty_timeout`."""

    def create_participant_token(
        self,
        room_id: uuid.UUID,
        identity: uuid.UUID,
        name: str | None = None,
        can_publish_data: bool = False,
    ) -> str:
        grants = VideoGrants(
            room_join=True,
            room=study_room_livekit_name(room_id),
            can_publish=True,
            can_subscribe=True,
            # Data-channel publish is the transport for live whiteboard sync
            # (useWhiteboardSync.ts) -- gated by the caller's room role
            # (can_edit_whiteboard: HOST/MODERATOR only), never unconditionally true, so a
            # PARTICIPANT can't forge whiteboard_update packets even with a patched client.
            can_publish_data=can_publish_data,
        )
        token = (
            AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
            .with_identity(str(identity))
            .with_grants(grants)
            .with_ttl(datetime.timedelta(seconds=settings.livekit_token_ttl_seconds))
        )
        if name:
            token = token.with_name(name)
        return token.to_jwt()

    def _room_api(self) -> LiveKitAPI:
        """A fresh `LiveKitAPI` (and its own aiohttp session) per call. These are infrequent,
        latency-insensitive admin operations (kick/mute/room-close) triggered by a moderator
        action or room lifecycle change, not a hot path worth a pooled/shared session --
        `async with` guarantees the session is always closed, success or failure."""
        return LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)

    @staticmethod
    def _is_not_found(error: ServerError) -> bool:
        return error.code == ServerErrorCode.NOT_FOUND

    async def remove_participant(self, room_id: uuid.UUID, identity: uuid.UUID) -> None:
        """Immediately disconnects `identity` from this room's live LiveKit session --
        the server-side counterpart of moderation KICK (see study_room_router.log_moderation),
        which already ends the target's `study_room_members` row; this ends their live
        connection too, instead of leaving it dangling until they notice on their own.

        Idempotent: a participant who isn't currently connected, or a room LiveKit has
        already torn down (e.g. it was already empty), is a no-op success -- the end state
        ("not connected to this room") is identical to the requested one either way, so this
        must not surface as a failure of the KICK action itself."""
        async with self._room_api() as lkapi:
            try:
                await lkapi.room.remove_participant(
                    RoomParticipantIdentity(room=study_room_livekit_name(room_id), identity=str(identity))
                )
            except ServerError as e:
                if not self._is_not_found(e):
                    raise

    async def _set_microphone_muted(self, room_id: uuid.UUID, identity: uuid.UUID, muted: bool) -> bool:
        """Returns whether the track's *actual resulting* muted state in LiveKit matches
        `muted` -- callers must not infer success merely from this not having raised. LiveKit
        can accept a `MutePublishedTrack` RPC without error yet leave the track's real state
        unchanged (this is the documented case for a rejected remote-unmute, see
        `unmute_microphone`) -- the only truthful signal is the `TrackInfo` LiveKit hands back
        in the RPC response itself, which this checks directly rather than assuming."""
        room_name = study_room_livekit_name(room_id)
        async with self._room_api() as lkapi:
            try:
                participant = await lkapi.room.get_participant(
                    RoomParticipantIdentity(room=room_name, identity=str(identity))
                )
            except ServerError as e:
                if self._is_not_found(e):
                    return True  # Not connected -- nothing exists to be in the wrong state.
                raise
            mic_track = next(
                (track for track in participant.tracks if track.source == TrackSource.MICROPHONE), None
            )
            if mic_track is None:
                return True  # No published mic track -- vacuously already "not transmitting".
            if mic_track.muted == muted:
                return True
            try:
                response = await lkapi.room.mute_published_track(
                    MuteRoomTrackRequest(
                        room=room_name, identity=str(identity), track_sid=mic_track.sid, muted=muted
                    )
                )
            except ServerError as e:
                if self._is_not_found(e):
                    return True
                raise
            return response.track.muted == muted

    async def mute_microphone(self, room_id: uuid.UUID, identity: uuid.UUID) -> None:
        """Force-mutes `identity`'s published microphone track in LiveKit -- the server-side
        counterpart of moderation MUTE. LiveKit always allows a server-initiated mute
        regardless of project configuration, so unlike `unmute_microphone` there is no
        "accepted but didn't actually take effect" case worth returning to the caller here.

        Idempotent: no active LiveKit session for this identity, no currently-published
        microphone track, or a track that's already muted are all no-op successes -- there is
        nothing left to mute in any of those cases."""
        await self._set_microphone_muted(room_id, identity, muted=True)

    async def unmute_microphone(self, room_id: uuid.UUID, identity: uuid.UUID) -> bool:
        """Resumes transmission of `identity`'s already-published microphone track -- the
        server-side counterpart of moderation UNMUTE. Confirmed against LiveKit's own docs
        (https://docs.livekit.io/home/server/managing-participants/): `MutePublishedTrack`
        with `muted=false` operates purely at the track-publication level -- it does NOT force
        the participant's local hardware/device on, it only tells LiveKit to resume relaying a
        track that is already being captured and published (the mic was never physically off;
        our own `mute_microphone` above only ever paused the *send*). That's a materially
        different, and safe, operation from "turning on someone's microphone without their
        consent" -- the device itself was never touched.

        REQUIRED LiveKit Cloud/project setting: remote unmute is gated by "Admins can
        remotely unmute tracks" in the project's settings (self-hosted:
        `room.enable_remote_unmute: true`), which is OFF by default. With it off, LiveKit can
        accept this RPC without raising yet leave the track's real muted state unchanged --
        so a non-raising call is NOT proof the participant is actually audible again.

        Returns True only if LiveKit's own RPC response confirms the track's resulting state
        is actually unmuted; False if the request was accepted but LiveKit left it muted
        (most likely the project setting above is disabled). study_room_router.log_moderation
        logs a distinct warning when this is False, specifically so a False here is
        diagnosable in production rather than silently indistinguishable from a real success --
        it does NOT roll back or alter the already-committed moderation audit record, which is
        a factual log of the action a moderator took, not a claim about live LiveKit state.
        That claim is instead made truthfully by the frontend's real mic-state UI
        (`MeetingVideoGrid`'s `p.isMicrophoneEnabled`), which reads LiveKit's live track state
        directly rather than the moderation audit log, and so correctly keeps showing the
        participant as muted in this case until they unmute themselves via the normal mic
        toggle -- which always works regardless of this project setting.

        Idempotent: no active LiveKit session, no currently-published microphone track, or a
        track that's already unmuted are all no-op successes (return True -- there is nothing
        left to do, so nothing to be wrong about)."""
        return await self._set_microphone_muted(room_id, identity, muted=False)

    async def close_room(self, room_id: uuid.UUID) -> None:
        """Immediately disconnects every participant and tears down this room's LiveKit
        session -- the server-side counterpart of a Study Room ending or being deleted (see
        study_room_router.end_room/delete_room), so a live meeting doesn't keep running after
        the application considers it over.

        Idempotent: LiveKit already auto-closes an empty room on its own `empty_timeout`, so a
        room that's already gone by the time this runs is a no-op success, not an error."""
        async with self._room_api() as lkapi:
            try:
                await lkapi.room.delete_room(DeleteRoomRequest(room=study_room_livekit_name(room_id)))
            except ServerError as e:
                if not self._is_not_found(e):
                    raise
