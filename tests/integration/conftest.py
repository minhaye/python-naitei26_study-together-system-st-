"""Integration fixtures that talk to the real Supabase project configured in .env.

These tests are opt-in: they require three pre-existing Supabase Auth users
(this suite only signs them in, it never creates accounts or sets passwords).
See docs/chat-integration.md#integration-tests for exactly how to prepare them.
Any test file under tests/integration/ is skipped automatically if the
required env vars are absent.
"""

import os
import uuid

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app

def _env_or_skip(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        pytest.skip(
            f"Integration tests require real Supabase test users. Missing env var: {name}. "
            "See docs/chat-integration.md#integration-tests."
        )
    return value


async def _sign_in(email: str, password: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password",
            headers={"apikey": settings.supabase_publishable_key or ""},
            json={"email": email, "password": password},
        )
        response.raise_for_status()
        data = response.json()
    return {"access_token": data["access_token"], "user_id": data["user"]["id"]}


@pytest.fixture(scope="module")
async def user_a():
    return await _sign_in(_env_or_skip("SUPABASE_TEST_USER_A_EMAIL"), _env_or_skip("SUPABASE_TEST_USER_A_PASSWORD"))


@pytest.fixture(scope="module")
async def user_b():
    return await _sign_in(_env_or_skip("SUPABASE_TEST_USER_B_EMAIL"), _env_or_skip("SUPABASE_TEST_USER_B_PASSWORD"))


@pytest.fixture(scope="module")
async def outsider():
    return await _sign_in(_env_or_skip("SUPABASE_TEST_OUTSIDER_EMAIL"), _env_or_skip("SUPABASE_TEST_OUTSIDER_PASSWORD"))


@pytest.fixture
async def api_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
async def chat_fixture(api_client, user_a, user_b):
    """Creates a throwaway group owned by user A, with a public and a private
    channel, and user B as an active member of the group (and of the private
    channel). Deleted at teardown -- FK cascades remove the channels and any
    messages created during the test."""
    group = (
        await api_client.post(
            "/groups/",
            json={"name": f"integration-test-{uuid.uuid4().hex[:8]}", "owner_id": user_a["user_id"], "is_public": False},
        )
    ).json()

    channel = (
        await api_client.post(
            "/channels/", json={"group_id": group["id"], "name": "general", "created_by": user_a["user_id"]}
        )
    ).json()
    private_channel = (
        await api_client.post(
            "/channels/",
            json={"group_id": group["id"], "name": "private-room", "is_private": True, "created_by": user_a["user_id"]},
        )
    ).json()

    await api_client.post(f"/groups/{group['id']}/members", json={"group_id": group["id"], "user_id": user_b["user_id"]})
    await api_client.post(
        f"/channels/{private_channel['id']}/members",
        json={"channel_id": private_channel["id"], "user_id": user_b["user_id"]},
    )

    try:
        yield {
            "group": group,
            "channel": channel,
            "private_channel": private_channel,
            "conversation_id": channel["conversation_id"],
            "private_conversation_id": private_channel["conversation_id"],
        }
    finally:
        await api_client.delete(f"/groups/{group['id']}")
