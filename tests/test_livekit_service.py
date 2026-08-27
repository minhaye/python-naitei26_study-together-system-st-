import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from livekit.api import ServerError, ServerErrorCode
from livekit.protocol.models import TrackSource

from app.meetings.services.livekit_service import LiveKitService, study_room_livekit_name


class _FakeLiveKitAPI:
    """Stands in for `livekit.api.LiveKitAPI` as an async context manager, exposing a
    caller-supplied mock `.room` (RoomService) -- lets tests assert on exactly what
    LiveKitService passed to the SDK without a real LiveKit server."""

    def __init__(self, room):
        self.room = room

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


def _service_with_fake_room(monkeypatch, room_mock):
    service = LiveKitService()
    monkeypatch.setattr(service, "_room_api", lambda: _FakeLiveKitAPI(room_mock))
    return service


def _not_found_error() -> ServerError:
    return ServerError(ServerErrorCode.NOT_FOUND, "not found", status=404)


def _infra_error() -> ServerError:
    return ServerError(ServerErrorCode.INTERNAL, "boom", status=500)


def _participant_with_tracks(tracks):
    participant = MagicMock()
    participant.tracks = tracks
    return participant


def _mic_track(sid: str = "TR_mic", muted: bool = False):
    track = MagicMock()
    track.sid = sid
    track.source = TrackSource.MICROPHONE
    track.muted = muted
    return track


def _camera_track():
    track = MagicMock()
    track.sid = "TR_cam"
    track.source = TrackSource.CAMERA
    track.muted = False
    return track


# --- remove_participant (KICK) ---


async def test_remove_participant_targets_the_derived_room_and_identity(monkeypatch):
    room_mock = MagicMock()
    room_mock.remove_participant = AsyncMock()
    service = _service_with_fake_room(monkeypatch, room_mock)
    room_id, identity = uuid.uuid4(), uuid.uuid4()

    await service.remove_participant(room_id, identity)

    request = room_mock.remove_participant.call_args.args[0]
    assert request.room == study_room_livekit_name(room_id)
    assert request.identity == str(identity)


async def test_remove_participant_not_connected_is_idempotent_success(monkeypatch):
    """Kicking someone who has no live LiveKit session (never connected, or already
    disconnected) must not error -- the end state is identical either way."""
    room_mock = MagicMock()
    room_mock.remove_participant = AsyncMock(side_effect=_not_found_error())
    service = _service_with_fake_room(monkeypatch, room_mock)

    await service.remove_participant(uuid.uuid4(), uuid.uuid4())  # must not raise


async def test_remove_participant_infra_error_propagates(monkeypatch):
    """A genuine LiveKit infra failure (not "already gone") must not be swallowed -- the
    caller (study_room_router) is responsible for logging it without failing the request."""
    room_mock = MagicMock()
    room_mock.remove_participant = AsyncMock(side_effect=_infra_error())
    service = _service_with_fake_room(monkeypatch, room_mock)

    with pytest.raises(ServerError):
        await service.remove_participant(uuid.uuid4(), uuid.uuid4())


# --- mute_microphone (MUTE) ---


async def test_mute_microphone_mutes_the_published_mic_track(monkeypatch):
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(
        return_value=_participant_with_tracks([_camera_track(), _mic_track()])
    )
    room_mock.mute_published_track = AsyncMock()
    service = _service_with_fake_room(monkeypatch, room_mock)
    room_id, identity = uuid.uuid4(), uuid.uuid4()

    await service.mute_microphone(room_id, identity)

    request = room_mock.mute_published_track.call_args.args[0]
    assert request.room == study_room_livekit_name(room_id)
    assert request.identity == str(identity)
    assert request.track_sid == "TR_mic"
    assert request.muted is True


async def test_mute_microphone_no_published_track_is_safe_noop(monkeypatch):
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(return_value=_participant_with_tracks([_camera_track()]))
    room_mock.mute_published_track = AsyncMock()
    service = _service_with_fake_room(monkeypatch, room_mock)

    await service.mute_microphone(uuid.uuid4(), uuid.uuid4())

    room_mock.mute_published_track.assert_not_awaited()


async def test_mute_microphone_already_muted_is_safe_noop(monkeypatch):
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(
        return_value=_participant_with_tracks([_mic_track(muted=True)])
    )
    room_mock.mute_published_track = AsyncMock()
    service = _service_with_fake_room(monkeypatch, room_mock)

    await service.mute_microphone(uuid.uuid4(), uuid.uuid4())

    room_mock.mute_published_track.assert_not_awaited()


async def test_mute_microphone_participant_not_connected_is_idempotent_success(monkeypatch):
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(side_effect=_not_found_error())
    room_mock.mute_published_track = AsyncMock()
    service = _service_with_fake_room(monkeypatch, room_mock)

    await service.mute_microphone(uuid.uuid4(), uuid.uuid4())  # must not raise

    room_mock.mute_published_track.assert_not_awaited()


async def test_mute_microphone_infra_error_on_lookup_propagates(monkeypatch):
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(side_effect=_infra_error())
    service = _service_with_fake_room(monkeypatch, room_mock)

    with pytest.raises(ServerError):
        await service.mute_microphone(uuid.uuid4(), uuid.uuid4())


# --- unmute_microphone (UNMUTE): resumes transmission of an already-published track --
# confirmed via LiveKit's own docs that this operates at the track-publication level, not
# the device level (does not force local hardware on) -- see the method's docstring. ---


def _mute_response(resulting_muted: bool):
    response = MagicMock()
    response.track = MagicMock()
    response.track.muted = resulting_muted
    return response


async def test_unmute_microphone_resumes_the_published_mic_track_and_confirms_it(monkeypatch):
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(
        return_value=_participant_with_tracks([_camera_track(), _mic_track(muted=True)])
    )
    room_mock.mute_published_track = AsyncMock(return_value=_mute_response(resulting_muted=False))
    service = _service_with_fake_room(monkeypatch, room_mock)
    room_id, identity = uuid.uuid4(), uuid.uuid4()

    confirmed = await service.unmute_microphone(room_id, identity)

    request = room_mock.mute_published_track.call_args.args[0]
    assert request.room == study_room_livekit_name(room_id)
    assert request.identity == str(identity)
    assert request.track_sid == "TR_mic"
    assert request.muted is False
    assert confirmed is True


async def test_unmute_microphone_returns_false_when_livekit_leaves_the_track_muted(monkeypatch):
    """The truthfulness check this task is about: LiveKit's "Admins can remotely unmute
    tracks" project setting can make it accept the RPC without raising, yet leave the track's
    real state unchanged (still muted) -- this must be reported back as `False`, not treated
    as a success just because no exception was raised."""
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(
        return_value=_participant_with_tracks([_mic_track(muted=True)])
    )
    room_mock.mute_published_track = AsyncMock(return_value=_mute_response(resulting_muted=True))
    service = _service_with_fake_room(monkeypatch, room_mock)

    confirmed = await service.unmute_microphone(uuid.uuid4(), uuid.uuid4())

    assert confirmed is False


async def test_unmute_microphone_no_published_track_is_safe_noop(monkeypatch):
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(return_value=_participant_with_tracks([_camera_track()]))
    room_mock.mute_published_track = AsyncMock()
    service = _service_with_fake_room(monkeypatch, room_mock)

    confirmed = await service.unmute_microphone(uuid.uuid4(), uuid.uuid4())

    room_mock.mute_published_track.assert_not_awaited()
    assert confirmed is True


async def test_unmute_microphone_already_unmuted_is_safe_noop(monkeypatch):
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(
        return_value=_participant_with_tracks([_mic_track(muted=False)])
    )
    room_mock.mute_published_track = AsyncMock()
    service = _service_with_fake_room(monkeypatch, room_mock)

    confirmed = await service.unmute_microphone(uuid.uuid4(), uuid.uuid4())

    room_mock.mute_published_track.assert_not_awaited()
    assert confirmed is True


async def test_unmute_microphone_participant_not_connected_is_idempotent_success(monkeypatch):
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(side_effect=_not_found_error())
    room_mock.mute_published_track = AsyncMock()
    service = _service_with_fake_room(monkeypatch, room_mock)

    confirmed = await service.unmute_microphone(uuid.uuid4(), uuid.uuid4())  # must not raise

    room_mock.mute_published_track.assert_not_awaited()
    assert confirmed is True


async def test_unmute_microphone_rejected_by_livekit_project_setting_propagates(monkeypatch):
    """If the project's "Admins can remotely unmute tracks" setting is off, LiveKit may
    reject the RPC outright -- this must surface as a normal ServerError (for the router's
    existing best-effort catch/log to handle), not be silently swallowed as if it were a
    "not found" idempotency case."""
    room_mock = MagicMock()
    room_mock.get_participant = AsyncMock(
        return_value=_participant_with_tracks([_mic_track(muted=True)])
    )
    room_mock.mute_published_track = AsyncMock(side_effect=_infra_error())
    service = _service_with_fake_room(monkeypatch, room_mock)

    with pytest.raises(ServerError):
        await service.unmute_microphone(uuid.uuid4(), uuid.uuid4())


# --- close_room (end/delete) ---


async def test_close_room_deletes_the_derived_room(monkeypatch):
    room_mock = MagicMock()
    room_mock.delete_room = AsyncMock()
    service = _service_with_fake_room(monkeypatch, room_mock)
    room_id = uuid.uuid4()

    await service.close_room(room_id)

    request = room_mock.delete_room.call_args.args[0]
    assert request.room == study_room_livekit_name(room_id)


async def test_close_room_already_gone_is_idempotent_success(monkeypatch):
    """LiveKit already auto-closes an empty room -- a room that's gone by the time end/delete
    runs must not surface as an error."""
    room_mock = MagicMock()
    room_mock.delete_room = AsyncMock(side_effect=_not_found_error())
    service = _service_with_fake_room(monkeypatch, room_mock)

    await service.close_room(uuid.uuid4())  # must not raise


async def test_close_room_infra_error_propagates(monkeypatch):
    room_mock = MagicMock()
    room_mock.delete_room = AsyncMock(side_effect=_infra_error())
    service = _service_with_fake_room(monkeypatch, room_mock)

    with pytest.raises(ServerError):
        await service.close_room(uuid.uuid4())
