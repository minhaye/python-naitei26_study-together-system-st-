import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.main import app
from app.roadmaps.entities.roadmap_entity import Roadmap, RoadmapPhase

AUTH_HEADERS = {'Authorization': 'Bearer testtoken'}


async def test_create_roadmap_assigns_authenticated_owner(async_client):
    user = CurrentUser(id=uuid.uuid4(), email='roadmap@example.com', role='authenticated')
    session = AsyncMock()
    session.add = MagicMock()
    roadmap = Roadmap(id=uuid.uuid4(), user_id=user.id, title='IELTS', goal='Band 7.5', due_date=None, created_at=datetime.now(timezone.utc))
    roadmap.phases = [RoadmapPhase(id=uuid.uuid4(), name='Nền tảng', position=0, progress=0)]
    result = MagicMock()
    result.scalar_one.return_value = roadmap
    session.execute.return_value = result
    app.dependency_overrides[get_current_user] = lambda: user
    async def session_dependency():
        yield session
    app.dependency_overrides[get_db_session] = session_dependency
    try:
        response = await async_client.post('/roadmaps', json={'title': 'IELTS', 'goal': 'Band 7.5', 'phases': [{'name': 'Nền tảng'}]}, headers=AUTH_HEADERS)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db_session, None)

    assert response.status_code == 201
    assert session.add.call_args.args[0].user_id == user.id
    assert response.json()['phases'][0]['name'] == 'Nền tảng'


async def test_update_roadmap_phase_not_owned_returns_not_found(async_client):
    session = AsyncMock()
    session.scalar.return_value = None
    user = CurrentUser(id=uuid.uuid4(), email='roadmap@example.com', role='authenticated')
    app.dependency_overrides[get_current_user] = lambda: user
    async def session_dependency():
        yield session
    app.dependency_overrides[get_db_session] = session_dependency
    try:
        response = await async_client.patch(f'/roadmaps/{uuid.uuid4()}/phases/{uuid.uuid4()}', json={'progress': 50}, headers=AUTH_HEADERS)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db_session, None)

    assert response.status_code == 404
