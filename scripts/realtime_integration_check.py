"""Standalone Realtime security check for group chat (Scenario B/C from the chat backend spec).

NOT a pytest test: it opens real WebSocket connections to Supabase Realtime and
waits on wall-clock time to observe an event, which doesn't fit the mocked,
sub-second style used by the rest of this repo's test suite. Run it manually.

STATUS: this script has NOT been executed against a live project in this
environment -- no SUPABASE_TEST_USER_* credentials were available. It is
provided as prepared-but-unverified tooling, written against the documented
`realtime` (realtime-py) client API. Run it once real credentials exist and
fix up anything that doesn't match before trusting its output.

WHAT IT VERIFIES
    B. User B (who has access to the channel) receives a Postgres Changes
       INSERT event over Supabase Realtime when User A posts a message
       through the FastAPI backend -- without polling.
    C. An outsider subscribed to the exact same table/filter does NOT
       receive that event. This is the one thing FastAPI-layer permission
       checks cannot enforce by themselves, since the frontend connects to
       Realtime directly with its own Supabase access token -- it is RLS
       (via the can_access_channel() policy) doing the work here.

REQUIREMENTS
    pip install realtime      # Supabase's Python Realtime client.
                               # Not a project runtime dependency -- only
                               # needed to run this script.

    Same env vars as tests/integration/ (see docs/chat-integration.md):
      SUPABASE_TEST_USER_A_EMAIL / SUPABASE_TEST_USER_A_PASSWORD
      SUPABASE_TEST_USER_B_EMAIL / SUPABASE_TEST_USER_B_PASSWORD
      SUPABASE_TEST_OUTSIDER_EMAIL / SUPABASE_TEST_OUTSIDER_PASSWORD
    These must be real, pre-existing Supabase Auth users. This script only
    signs in -- it never creates accounts or sets passwords.

    .env must already have SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.

RUN
    python scripts/realtime_integration_check.py
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app

try:
    from realtime import AsyncRealtimeClient
except ImportError:
    print("Missing dependency. Run: pip install realtime")
    raise SystemExit(1)

REQUIRED_ENV = [
    "SUPABASE_TEST_USER_A_EMAIL",
    "SUPABASE_TEST_USER_A_PASSWORD",
    "SUPABASE_TEST_USER_B_EMAIL",
    "SUPABASE_TEST_USER_B_PASSWORD",
    "SUPABASE_TEST_OUTSIDER_EMAIL",
    "SUPABASE_TEST_OUTSIDER_PASSWORD",
]


async def sign_in(client: httpx.AsyncClient, email: str, password: str) -> dict:
    response = await client.post(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password",
        headers={"apikey": settings.supabase_publishable_key or ""},
        json={"email": email, "password": password},
    )
    response.raise_for_status()
    data = response.json()
    return {"access_token": data["access_token"], "user_id": data["user"]["id"]}


async def wait_until(predicate, timeout: float, interval: float = 0.25) -> bool:
    waited = 0.0
    while waited < timeout:
        if predicate():
            return True
        await asyncio.sleep(interval)
        waited += interval
    return False


async def subscribe(ws_url: str, anon_key: str, access_token: str, conversation_id: str, sink: list) -> AsyncRealtimeClient:
    socket = AsyncRealtimeClient(f"{ws_url}/realtime/v1", token=anon_key)
    await socket.connect()
    await socket.set_auth(access_token)
    topic = f"messages-check-{uuid.uuid4().hex[:8]}"
    sub_channel = socket.channel(topic)
    sub_channel.on_postgres_changes(
        "INSERT",
        schema="public",
        table="messages",
        filter=f"conversation_id=eq.{conversation_id}",
        callback=lambda payload: sink.append(payload),
    )
    await sub_channel.subscribe()
    return socket


async def main() -> None:
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        print(f"Missing required env vars, aborting: {', '.join(missing)}")
        print("See docs/chat-integration.md#integration-tests")
        raise SystemExit(1)

    async with httpx.AsyncClient(timeout=10.0) as http:
        user_a = await sign_in(http, os.environ["SUPABASE_TEST_USER_A_EMAIL"], os.environ["SUPABASE_TEST_USER_A_PASSWORD"])
        user_b = await sign_in(http, os.environ["SUPABASE_TEST_USER_B_EMAIL"], os.environ["SUPABASE_TEST_USER_B_PASSWORD"])
        outsider = await sign_in(
            http, os.environ["SUPABASE_TEST_OUTSIDER_EMAIL"], os.environ["SUPABASE_TEST_OUTSIDER_PASSWORD"]
        )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as api:
        group = (
            await api.post(
                "/groups/",
                json={"name": f"realtime-check-{uuid.uuid4().hex[:8]}", "owner_id": user_a["user_id"], "is_public": False},
            )
        ).json()
        channel = (
            await api.post("/channels/", json={"group_id": group["id"], "name": "general", "created_by": user_a["user_id"]})
        ).json()
        conversation_id = channel["conversation_id"]
        await api.post(f"/groups/{group['id']}/members", json={"group_id": group["id"], "user_id": user_b["user_id"]})

        ok = True
        socket_b = socket_outsider = None
        try:
            ws_url = settings.supabase_url.rstrip("/").replace("https://", "wss://").replace("http://", "ws://")
            anon_key = settings.supabase_publishable_key or ""

            b_events: list = []
            outsider_events: list = []

            socket_b = await subscribe(ws_url, anon_key, user_b["access_token"], conversation_id, b_events)
            socket_outsider = await subscribe(ws_url, anon_key, outsider["access_token"], conversation_id, outsider_events)

            await asyncio.sleep(1.0)  # let both subscriptions settle before posting

            post_response = await api.post(
                f"/conversations/{conversation_id}/messages",
                json={"content": "realtime check"},
                headers={"Authorization": f"Bearer {user_a['access_token']}"},
            )
            post_response.raise_for_status()
            posted = post_response.json()

            b_received = await wait_until(lambda: bool(b_events), timeout=10.0)
            await asyncio.sleep(2.0)  # fair window for an outsider event that should never arrive

            print(f"Posted message id={posted['id']} sender_id={posted['sender_id']} conversation_id={posted['conversation_id']}")

            if not b_received:
                print("FAIL: User B did not receive the Realtime INSERT event within 10s")
                ok = False
            else:
                record = b_events[0].get("data", {}).get("record", {})
                if record.get("id") != posted["id"]:
                    print(f"FAIL: User B's event has the wrong message id: {record.get('id')!r}")
                    ok = False
                elif record.get("sender_id") != posted["sender_id"] or record.get("conversation_id") != posted["conversation_id"]:
                    print("FAIL: User B's event has a mismatched sender_id/conversation_id")
                    ok = False
                else:
                    print("PASS: User B received the correct Realtime INSERT event")

            if outsider_events:
                print(f"FAIL: outsider received {len(outsider_events)} event(s) they must not have access to")
                ok = False
            else:
                print("PASS: outsider received no events (RLS enforced at the Realtime layer)")
        finally:
            if socket_b:
                await socket_b.close()
            if socket_outsider:
                await socket_outsider.close()
            await api.delete(f"/groups/{group['id']}")  # cascades to channel + message

    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
