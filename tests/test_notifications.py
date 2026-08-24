import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.main import app
from app.notifications.entities.notification_entity import Notification
from app.notifications.routers import notification_router

AUTH_HEADERS = {"Authorization": "Bearer testtoken"}


async def _fake_db_session():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def override_db_session():
    app.dependency_overrides[get_db_session] = _fake_db_session
    yield
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
def fake_user():
    return CurrentUser(id=uuid.uuid4(), email="user@example.com", role="authenticated")


@pytest.fixture
def as_fake_user(fake_user):
    app.dependency_overrides[get_current_user] = lambda: fake_user
    yield fake_user
    app.dependency_overrides.pop(get_current_user, None)


def _notification(user_id, is_read=False) -> Notification:
    return Notification(
        id=uuid.uuid4(), user_id=user_id, type="mention", is_read=is_read, created_at=datetime.now(timezone.utc)
    )


# --- No public creation endpoint at all ---


async def test_create_notification_endpoint_does_not_exist(async_client):
    response = await async_client.post("/notifications/", json={"user_id": str(uuid.uuid4()), "type": "mention"})
    assert response.status_code in (404, 405)


# --- Everything else requires auth ---


async def test_list_notifications_requires_auth(async_client):
    response = await async_client.get("/notifications/")
    assert response.status_code == 401


async def test_get_notification_requires_auth(async_client):
    response = await async_client.get(f"/notifications/{uuid.uuid4()}")
    assert response.status_code == 401


async def test_mark_read_requires_auth(async_client):
    response = await async_client.put(f"/notifications/{uuid.uuid4()}/read")
    assert response.status_code == 401


async def test_delete_notification_requires_auth(async_client):
    response = await async_client.delete(f"/notifications/{uuid.uuid4()}")
    assert response.status_code == 401


# --- list/get/mark-read/delete are scoped to the authenticated caller (IDOR fix) ---


async def test_list_notifications_ignores_any_client_supplied_target_and_uses_caller_id(
    async_client, monkeypatch, as_fake_user
):
    list_mock = AsyncMock(return_value=[_notification(as_fake_user.id)])
    monkeypatch.setattr(notification_router.service, "list_for_user", list_mock)

    response = await async_client.get("/notifications/", headers=AUTH_HEADERS)
    assert response.status_code == 200
    list_mock.assert_awaited_once()
    assert list_mock.await_args.args[1] == as_fake_user.id


async def test_get_notification_owned_by_caller_allowed(async_client, monkeypatch, as_fake_user):
    notification = _notification(as_fake_user.id)
    monkeypatch.setattr(notification_router.service, "get_by_id", AsyncMock(return_value=notification))

    response = await async_client.get(f"/notifications/{notification.id}", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_get_notification_owned_by_someone_else_returns_404(async_client, monkeypatch, as_fake_user):
    notification = _notification(uuid.uuid4())
    monkeypatch.setattr(notification_router.service, "get_by_id", AsyncMock(return_value=notification))

    response = await async_client.get(f"/notifications/{notification.id}", headers=AUTH_HEADERS)
    assert response.status_code == 404


async def test_mark_read_someone_elses_notification_returns_404(async_client, monkeypatch, as_fake_user):
    notification = _notification(uuid.uuid4())
    monkeypatch.setattr(notification_router.service, "get_by_id", AsyncMock(return_value=notification))
    mark_read_mock = AsyncMock()
    monkeypatch.setattr(notification_router.service, "mark_read", mark_read_mock)

    response = await async_client.put(f"/notifications/{notification.id}/read", headers=AUTH_HEADERS)
    assert response.status_code == 404
    mark_read_mock.assert_not_awaited()


async def test_mark_read_own_notification_allowed(async_client, monkeypatch, as_fake_user):
    notification = _notification(as_fake_user.id)
    monkeypatch.setattr(notification_router.service, "get_by_id", AsyncMock(return_value=notification))
    monkeypatch.setattr(notification_router.service, "mark_read", AsyncMock(return_value=notification))

    response = await async_client.put(f"/notifications/{notification.id}/read", headers=AUTH_HEADERS)
    assert response.status_code == 200


async def test_delete_someone_elses_notification_returns_404(async_client, monkeypatch, as_fake_user):
    notification = _notification(uuid.uuid4())
    monkeypatch.setattr(notification_router.service, "get_by_id", AsyncMock(return_value=notification))
    delete_mock = AsyncMock()
    monkeypatch.setattr(notification_router.service, "delete", delete_mock)

    response = await async_client.delete(f"/notifications/{notification.id}", headers=AUTH_HEADERS)
    assert response.status_code == 404
    delete_mock.assert_not_awaited()


async def test_delete_own_notification_allowed(async_client, monkeypatch, as_fake_user):
    notification = _notification(as_fake_user.id)
    monkeypatch.setattr(notification_router.service, "get_by_id", AsyncMock(return_value=notification))
    monkeypatch.setattr(notification_router.service, "delete", AsyncMock(return_value=None))

    response = await async_client.delete(f"/notifications/{notification.id}", headers=AUTH_HEADERS)
    assert response.status_code == 204


# --- Phase 1 & 2: New unread-counts, read-all & category filter endpoints ---


async def test_unread_counts_endpoint_requires_auth(async_client):
    response = await async_client.get("/notifications/unread-counts")
    assert response.status_code == 401


async def test_unread_counts_returns_counts_structure(async_client, monkeypatch, as_fake_user):
    counts = {"total": 5, "forum": 2, "group": 1, "goal": 2, "message": 0}
    monkeypatch.setattr(notification_router.service, "get_unread_counts", AsyncMock(return_value=counts))

    response = await async_client.get("/notifications/unread-counts", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert data["forum"] == 2
    assert data["group"] == 1
    assert data["goal"] == 2
    assert data["message"] == 0


async def test_mark_all_read_endpoint(async_client, monkeypatch, as_fake_user):
    monkeypatch.setattr(notification_router.service, "mark_all_read", AsyncMock(return_value=3))

    response = await async_client.put("/notifications/read-all", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json() == {"updated": 3}


async def test_mark_all_read_with_category_filter(async_client, monkeypatch, as_fake_user):
    mark_all_mock = AsyncMock(return_value=2)
    monkeypatch.setattr(notification_router.service, "mark_all_read", mark_all_mock)

    response = await async_client.put("/notifications/read-all?category=forum", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json() == {"updated": 2}
    mark_all_mock.assert_awaited_once()


async def test_list_notifications_with_category_filter(async_client, monkeypatch, as_fake_user):
    notification = _notification(as_fake_user.id)
    notification.type = "post_like"
    list_mock = AsyncMock(return_value=[notification])
    monkeypatch.setattr(notification_router.service, "list_for_user", list_mock)

    response = await async_client.get("/notifications/?category=forum", headers=AUTH_HEADERS)
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["category"] == "forum"


# --- Phase 3: Background Scheduler Service & Trigger Endpoint ---


async def test_trigger_scheduler_endpoint_requires_auth(async_client):
    response = await async_client.post("/notifications/trigger-scheduler")
    assert response.status_code == 401


async def test_trigger_scheduler_endpoint_success(async_client, monkeypatch, as_fake_user):
    mock_run = AsyncMock(return_value={"daily_reminders": 2, "due_soon": 1, "overdue": 0})
    monkeypatch.setattr(notification_router.scheduler_service, "run_all_checks", mock_run)

    response = await async_client.post("/notifications/trigger-scheduler", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["notifications_created"]["daily_reminders"] == 2


