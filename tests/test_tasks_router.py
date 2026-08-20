import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.main import app

AUTH_HEADERS = {'Authorization': 'Bearer testtoken'}


def _override_user(user):
    app.dependency_overrides[get_current_user] = lambda: user


async def test_create_tasks_bulk_validates_and_assigns_current_user(async_client):
    user = CurrentUser(id=uuid.uuid4(), email='task@example.com', role='authenticated')
    session = AsyncMock()
    session.add_all = MagicMock()

    async def refresh(task):
        task.id = uuid.uuid4()
        task.created_at = datetime.now(timezone.utc)

    session.refresh.side_effect = refresh
    _override_user(user)
    async def session_dependency():
        yield session
    app.dependency_overrides[get_db_session] = session_dependency
    try:
        response = await async_client.post('/tasks/bulk', json={'tasks': [
            {'title': '  Ôn chương 4  ', 'due_date': '2026-08-20', 'priority': 2},
            {'title': 'Nộp bài tập', 'due_date': '2026-08-20', 'priority': 3},
        ]}, headers=AUTH_HEADERS)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db_session, None)

    assert response.status_code == 201
    assert [task.title for task in session.add_all.call_args.args[0]] == ['Ôn chương 4', 'Nộp bài tập']
    assert all(task.user_id == user.id for task in session.add_all.call_args.args[0])


async def test_task_bulk_rejects_blank_lines_as_titles(async_client):
    _override_user(CurrentUser(id=uuid.uuid4(), email='task@example.com', role='authenticated'))
    try:
        response = await async_client.post('/tasks/bulk', json={'tasks': [
            {'title': '   ', 'due_date': '2026-08-20', 'priority': 2},
        ]}, headers=AUTH_HEADERS)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 422


async def test_complete_task_not_owned_returns_not_found(async_client):
    session = AsyncMock()
    session.scalar.return_value = None
    _override_user(CurrentUser(id=uuid.uuid4(), email='task@example.com', role='authenticated'))
    async def session_dependency():
        yield session
    app.dependency_overrides[get_db_session] = session_dependency
    try:
        response = await async_client.patch(f'/tasks/{uuid.uuid4()}/complete', headers=AUTH_HEADERS)
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 404


async def test_update_task_not_owned_returns_not_found(async_client):
    session = AsyncMock()
    session.scalar.return_value = None
    _override_user(CurrentUser(id=uuid.uuid4(), email='task@example.com', role='authenticated'))
    async def session_dependency():
        yield session
    app.dependency_overrides[get_db_session] = session_dependency
    try:
        response = await async_client.patch(f'/tasks/{uuid.uuid4()}', json={'title': 'Không được sửa'}, headers=AUTH_HEADERS)
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 404
