"""Scenario A (REST) from the chat backend v1 spec, run against the real
Supabase project in .env. Skipped automatically without test user credentials
-- see tests/integration/conftest.py.
"""

def auth_headers(user: dict) -> dict:
    return {"Authorization": f"Bearer {user['access_token']}"}


async def test_active_member_can_post_message(api_client, user_a, chat_fixture):
    conversation_id = chat_fixture["conversation_id"]
    response = await api_client.post(
        f"/conversations/{conversation_id}/messages",
        json={"content": "hello from integration test"},
        headers=auth_headers(user_a),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["sender_id"] == user_a["user_id"]
    assert body["conversation_id"] == conversation_id


async def test_outsider_cannot_read_channel_messages(api_client, outsider, chat_fixture):
    conversation_id = chat_fixture["conversation_id"]
    response = await api_client.get(f"/conversations/{conversation_id}/messages", headers=auth_headers(outsider))
    assert response.status_code == 403


async def test_outsider_cannot_post_message(api_client, outsider, chat_fixture):
    conversation_id = chat_fixture["conversation_id"]
    response = await api_client.post(
        f"/conversations/{conversation_id}/messages", json={"content": "should not work"}, headers=auth_headers(outsider)
    )
    assert response.status_code == 403


async def test_private_channel_non_member_forbidden(api_client, outsider, chat_fixture):
    conversation_id = chat_fixture["private_conversation_id"]
    response = await api_client.get(f"/conversations/{conversation_id}/messages", headers=auth_headers(outsider))
    assert response.status_code == 403


async def test_private_channel_member_can_read(api_client, user_b, chat_fixture):
    conversation_id = chat_fixture["private_conversation_id"]
    response = await api_client.get(f"/conversations/{conversation_id}/messages", headers=auth_headers(user_b))
    assert response.status_code == 200


async def test_owner_can_soft_delete_channel_and_it_becomes_inaccessible(api_client, user_a, user_b, chat_fixture):
    """End-to-end (real Postgres, real RLS) coverage for migration 009: after the owner
    soft-deletes a public channel, reading it and its messages must be denied for everyone,
    including an active group member -- through the normal FastAPI REST paths."""
    channel_id = chat_fixture["channel"]["id"]
    conversation_id = chat_fixture["conversation_id"]

    delete_response = await api_client.delete(f"/channels/{channel_id}", headers=auth_headers(user_a))
    assert delete_response.status_code == 204

    get_response = await api_client.get(f"/channels/{channel_id}")
    assert get_response.status_code == 404

    read_response = await api_client.get(f"/conversations/{conversation_id}/messages", headers=auth_headers(user_b))
    assert read_response.status_code == 403

    send_response = await api_client.post(
        f"/conversations/{conversation_id}/messages", json={"content": "should not work"}, headers=auth_headers(user_a)
    )
    assert send_response.status_code == 403

    # Deleting again 404s -- there is no distinct "already deleted" outcome.
    redelete_response = await api_client.delete(f"/channels/{channel_id}", headers=auth_headers(user_a))
    assert redelete_response.status_code == 404


async def test_deleted_private_channel_denies_previously_valid_member(api_client, user_a, user_b, chat_fixture):
    """Regression guard for the deleted-channel invariant on top of the private-channel fix
    (commit 262cd09): user_b has an explicit channel_members row and would normally be
    allowed in, but a deleted channel must deny everyone through the normal access path."""
    private_channel_id = chat_fixture["private_channel"]["id"]
    private_conversation_id = chat_fixture["private_conversation_id"]

    delete_response = await api_client.delete(f"/channels/{private_channel_id}", headers=auth_headers(user_a))
    assert delete_response.status_code == 204

    read_response = await api_client.get(
        f"/conversations/{private_conversation_id}/messages", headers=auth_headers(user_b)
    )
    assert read_response.status_code == 403


async def test_banned_member_forbidden(api_client, user_b, chat_fixture):
    group_id = chat_fixture["group"]["id"]
    conversation_id = chat_fixture["conversation_id"]

    ban_response = await api_client.put(
        f"/groups/{group_id}/members/{user_b['user_id']}/status", params={"member_status": "banned"}
    )
    assert ban_response.status_code == 200

    try:
        response = await api_client.get(f"/conversations/{conversation_id}/messages", headers=auth_headers(user_b))
        assert response.status_code == 403
    finally:
        await api_client.put(f"/groups/{group_id}/members/{user_b['user_id']}/status", params={"member_status": "active"})
