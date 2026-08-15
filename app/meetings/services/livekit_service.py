import datetime
import uuid

from livekit.api import AccessToken, VideoGrants

from app.core.config import settings


def study_room_livekit_name(room_id: uuid.UUID) -> str:
    return f"study-room-{room_id}"


class LiveKitService:
    """Server-side LiveKit operations for the meeting MVP: participant token issuance only.
    The LiveKit room itself is never explicitly created or closed here -- LiveKit Cloud
    creates it on first participant join and tears it down when empty."""

    def create_participant_token(self, room_id: uuid.UUID, identity: uuid.UUID, name: str | None = None) -> str:
        grants = VideoGrants(
            room_join=True,
            room=study_room_livekit_name(room_id),
            can_publish=True,
            can_subscribe=True,
            can_publish_data=False,
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
