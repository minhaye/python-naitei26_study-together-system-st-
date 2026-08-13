# Chat integration guide (frontend)

Realtime group chat, scoped to `Channel`. No typing indicator, presence, read
receipts, reactions, DMs, or voice/video in this version.

## Open a channel

```text
1. GET /channels/{channel_id}/messages?limit=50
2. Render items (newest-first: created_at desc, id desc as tiebreaker)
3. Subscribe to Supabase Realtime:
     table    = messages
     event    = INSERT
     filter   = channel_id=eq.<channel_id>
   using the user's own Supabase access token (not the service role key).
4. Prepend/append incoming INSERT rows to the UI.
```

RLS enforces the same permission model as the REST API for the Realtime
subscription itself (`can_access_channel()` — active group membership, plus
`channel_members` for private channels). A user who can't read a channel via
the API will not receive Realtime events for it either. See
[RLS verification](#rls-verification) below for exactly what's been checked.

## Pagination (`next_cursor`)

`GET /channels/{channel_id}/messages` returns:

```json
{ "items": [...], "next_cursor": "opaque-string-or-null" }
```

- `items` is ordered newest-first.
- To load older messages, call again with `?limit=50&before=<next_cursor>`.
- `next_cursor` is `null` when there are no more messages. It encodes
  `(created_at, id)` (keyset pagination), so it's stable even when multiple
  messages share the same `created_at`. Treat it as opaque — don't parse it.

## Send a text message

```http
POST /channels/{channel_id}/messages
Authorization: Bearer <user access token>
Content-Type: application/json

{ "content": "Hello everyone" }
```

`sender_id` is always taken from the token — never send it. Never insert
directly into Supabase from the frontend.

## Send a file

Attachments go through Supabase Storage directly, not through FastAPI's own
request body — the backend only issues a short-lived signed upload URL after
checking you can actually post to that channel.

```text
1. POST /channels/{channel_id}/attachments/upload-url
     { "file_name": "lesson.pdf", "content_type": "application/pdf", "file_size": 1048576 }
   -> { "path": "...", "upload_url": "...", "token": "..." }

2. PUT <upload_url> directly to Supabase Storage, body = raw file bytes,
   header Content-Type = the same content_type you sent above.

3. POST /channels/{channel_id}/messages
     { "content": "Tài liệu buổi hôm nay", "attachment_path": "<path from step 1>" }
   (content is optional if the message is attachment-only)

4. The INSERT arrives over Realtime like any other message.
```

Allowed types today: `image/jpeg`, `image/png`, `image/webp`,
`application/pdf`, `text/plain`. Max size: 10 MB (see
`app/attachments/constants.py` for the source of truth). `attachment_path`
**must** be a path this endpoint issued to you — the backend rejects any
other value with `403`, and rejects a path that was never actually uploaded
to Storage with `400`. One message = at most one attachment in this version.

**Note on validation limits:** content-type/size/extension are checked
against what the client *claims*, not the file's actual bytes (no
server-side content sniffing or antivirus scanning in this MVP). Don't treat
this as a hard content-safety guarantee.

## Read/view an attachment

The Storage bucket is private — there is no permanent public URL.

```http
GET /messages/{message_id}/attachment-url
```

```json
{ "url": "https://.../object/sign/...", "expires_in": 300 }
```

`expires_in` is seconds (default 300, configurable via
`ATTACHMENT_DOWNLOAD_URL_EXPIRES_IN`). Request a fresh URL each time you need
to display/download the file — don't cache the signed URL past its expiry.
`404` if the message has no attachment, `403` if you can't access the
message's channel.

## Edit / delete

```http
PATCH  /messages/{message_id}   { "content": "edited text" }
DELETE /messages/{message_id}
```

- `PATCH` only ever changes `content`. It cannot be used to attach or swap a
  file — that always goes through the upload flow above, then a new message
  (or, in a future version, a dedicated re-attach endpoint).
- Edit: sender only. Delete: sender, or a group owner/moderator.
- Deleting a message with an attachment also deletes the Storage object on a
  best-effort basis (see [Orphaned uploads](#orphaned-uploads) — Postgres and
  Storage aren't in the same transaction, so this isn't guaranteed atomic,
  but the message row is always gone regardless of whether the Storage
  cleanup succeeds).

## Deduplication

A `POST /channels/{channel_id}/messages` response and the Realtime `INSERT`
event for that same row can both reach the client. Deduplicate by
`message.id` before appending to the UI.

## Orphaned uploads

A file can be uploaded successfully and then never attached to a message
(user abandons the compose box). This version does not run a background
cleanup job. Mitigations already in place:

- Every object path is `groups/{group_id}/channels/{channel_id}/{user_id}/{uuid}/{filename}`,
  so orphans are trivially identifiable and attributable.
- `POST /channels/{channel_id}/messages` verifies the object actually exists
  in Storage before accepting an `attachment_path`, so a message is never
  silently created pointing at nothing.

Recommended follow-up (not implemented here, no Redis/Celery needed): a
scheduled job (e.g. Supabase cron / a periodic script) that lists objects
older than N hours under `message-attachments` and deletes any whose path
does not match an existing `messages.attachment_path` in Postgres.

---

## RLS verification

Checked directly against the live Supabase project (read-only queries), not
just the RLS policy dump in `docs/db/public`:

- `messages`, `channels`, `channel_members`, `group_members` all have RLS
  **enabled** (`pg_class.relrowsecurity = true`).
- `public.messages` is **already** in the `supabase_realtime` publication —
  Postgres Changes for INSERT already works today.
- Fetched the live SQL body of `can_access_channel()`, `is_group_manager()`,
  `is_group_member()`. Found that `can_access_channel()`'s private-channel
  branch did not re-check `group_members.status = 'active'` for users found
  via a `channel_members` row — a banned/left member with a stale
  `channel_members` row would still pass. FastAPI's
  `app/core/permissions.py` is unaffected (it checks active membership
  first, unconditionally), but the direct Realtime subscription path uses
  the DB function directly and was exposed. Fix prepared in
  `docs/db/migrations/002_fix_can_access_channel_active_membership.sql`
  (not yet applied — see that file's header).

## Integration tests

`tests/integration/` runs the REST scenarios (Scenario A from the spec)
against the real Supabase project in `.env`. It's skipped automatically —
per-fixture, with a clear reason — if the env vars below aren't set.

Required env vars (never commit real values):

```text
SUPABASE_TEST_USER_A_EMAIL / SUPABASE_TEST_USER_A_PASSWORD
SUPABASE_TEST_USER_B_EMAIL / SUPABASE_TEST_USER_B_PASSWORD
SUPABASE_TEST_OUTSIDER_EMAIL / SUPABASE_TEST_OUTSIDER_PASSWORD
```

**Setup (one-time, do this yourself — the suite only signs in, it never
creates accounts or sets passwords):**

1. In the Supabase dashboard (Authentication → Users), create 3 users (any
   email/password) — call them A, B, and Outsider. The `on_auth_user_created`
   trigger already in this project auto-creates a matching `profiles` row for
   each, so no extra fixture step is needed there.
2. Export the 6 env vars above in your shell (or a local, gitignored `.env.test`
   you source before running tests).
3. Run `pytest tests/integration -v`.

The suite creates its own throwaway group/channel/membership fixtures per
test module via the app's own API and deletes the group at teardown (FK
cascades remove the channels and any messages created during the run) — it
does not touch other users' data.

For the Realtime-specific checks (Scenario B/C — an authorized user receives
the INSERT event, an outsider does not), see
`scripts/realtime_integration_check.py`. It's a standalone script, not a
pytest test (it needs wall-clock time to observe a WebSocket event), and
needs `pip install realtime` in addition to the env vars above. **This
script has not been run against a live project in this environment** — no
test credentials were available — so treat it as prepared-but-unverified
until someone runs it for real.

## Pending manual actions

These require direct execution against production Supabase and were
deliberately not run automatically:

```bash
# Already verified live and already applied — running this again is a
# no-op, kept for reference/idempotency.
docs/db/migrations/001_enable_realtime_messages.sql

# NOT yet applied. Fixes the can_access_channel() gap described above.
docs/db/migrations/002_fix_can_access_channel_active_membership.sql

# NOT yet applied. Creates the private message-attachments bucket
# (storage.buckets is currently empty in this project).
docs/db/migrations/003_create_message_attachments_bucket.sql
```

Run all three (in order, 002 and 003 are what actually change anything) in
the Supabase SQL editor, or via `psql`/`supabase db query` pointed at the
project's connection string.

Also required before attachments work end-to-end:

```bash
# .env — server-side only, never expose to the frontend.
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard, Project Settings > API>
```

Without it, `/channels/{channel_id}/attachments/upload-url` and
`/messages/{message_id}/attachment-url` respond `500 Attachment storage is
not configured` — text-only chat is unaffected.
