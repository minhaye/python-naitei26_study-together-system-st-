"""Regression coverage for the group_members_group_id_user_id_key UniqueViolation:
POST /groups/ must create exactly one owner group_members row, sourced from the live
DB trigger `groups_add_owner` (AFTER INSERT ON groups -> add_group_owner()), with no
duplicate insert racing it from application code.

Skipped automatically without real Supabase test user credentials -- see
tests/integration/conftest.py.
"""

import uuid


def auth_headers(user: dict) -> dict:
    return {"Authorization": f"Bearer {user['access_token']}"}


async def test_create_group_produces_exactly_one_owner_membership(api_client, user_a):
    response = await api_client.post(
        "/groups/",
        json={"name": f"integration-test-{uuid.uuid4().hex[:8]}", "is_public": True},
        headers=auth_headers(user_a),
    )
    assert response.status_code == 201
    group = response.json()
    assert group["owner_id"] == user_a["user_id"]

    try:
        members_response = await api_client.get(f"/groups/{group['id']}/members")
        assert members_response.status_code == 200
        members = members_response.json()

        owner_memberships = [m for m in members if m["user_id"] == user_a["user_id"]]
        assert len(owner_memberships) == 1
        assert owner_memberships[0]["role"] == "owner"
        assert owner_memberships[0]["status"] == "active"
    finally:
        await api_client.delete(f"/groups/{group['id']}", headers=auth_headers(user_a))
