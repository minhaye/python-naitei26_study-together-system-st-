import uuid

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.main import app


async def test_me_requires_token(async_client):
    response = await async_client.get("/auth/me")
    assert response.status_code == 401


async def test_me_rejects_malformed_token(async_client):
    response = await async_client.get("/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


async def test_me_returns_current_user(async_client):
    fake_user = CurrentUser(id=uuid.uuid4(), email="user@example.com", role="authenticated")
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        response = await async_client.get("/auth/me", headers={"Authorization": "Bearer whatever"})
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    body = response.json()
    assert body == {"id": str(fake_user.id), "email": "user@example.com", "role": "authenticated"}
