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
