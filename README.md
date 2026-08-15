# Study Together System

A platform for group study: study groups with text channels, live study rooms with video meetings, shared resources, and a learning forum. **This repository currently contains the backend implementation** (FastAPI + PostgreSQL/Supabase); a separate `frontend/` directory holds an in-progress React client.

## Overview

The backend implements the following domains:

- **Auth / Profiles** — Supabase Auth owns sign-up/sign-in; the backend verifies the issued access token and exposes/derives the authenticated user's profile.
- **Groups** — study groups with owner/moderator/member roles and membership status (active/banned/left).
- **Channels** — text channels within a group (public or private).
- **Study Rooms** — live study sessions with host/moderator/participant roles, membership, and moderation actions (mute/unmute/kick/raise-hand/lower-hand).
- **Conversations / Messages** — a unified chat layer over channels, study rooms, and 1:1 direct messages (see [Chat architecture](#chat-architecture)).
- **Attachments** — signed, direct-to-Storage file uploads/downloads for messages.
- **Resources** — folders and files for sharing study material within a group.
- **Forum** — categories, posts, comments (with replies), and likes on posts/comments.
- **Notifications** — persisted notifications for group/forum/room events.
- **Meetings** — LiveKit-based video/audio for Study Rooms (participant token issuance only; see [LiveKit meetings](#livekit-meetings)).

All of the above are implemented as backend APIs with corresponding tests. Frontend integration for chat and meetings is still in progress — see [Current Development Status](#current-development-status).

## Tech Stack

```text
Python
FastAPI
SQLAlchemy (async, SQLAlchemy 2.0+)
PostgreSQL (via Supabase)
Supabase Auth
Supabase Storage
Supabase Realtime (Postgres Changes on the messages table)
LiveKit Cloud (via livekit-api)
pytest / pytest-asyncio
```

Driver/runtime notes: `psycopg[binary]` (async mode) for database access, `pyjwt[crypto]` for Supabase JWT verification, `httpx` for calls to the Supabase Storage REST API, `pydantic-settings` for configuration. See [requirements.txt](requirements.txt) for the full, authoritative list.

## Architecture Overview

### Backend responsibilities

FastAPI is responsible for:

```text
authentication integration (Supabase access token verification)
authorization (group/channel/room/conversation-level permission checks)
business logic (groups, channels, study rooms, forum, resources, notifications)
database access (SQLAlchemy async ORM against PostgreSQL/Supabase)
signed Storage operations (attachment upload/download URLs)
LiveKit participant-token issuance
```

### Authentication flow

```text
Frontend
  → Authorization: Bearer <Supabase access token>
  → FastAPI get_current_user (app/auth/dependencies.py)
  → JWT verification against Supabase's JWKS
  → authenticated user UUID (+ email/role claims)
```

See [Authentication](#authentication) below for how this is used by endpoints.

### Chat architecture

Chat is modeled around a single `Conversation` abstraction that channels, study rooms, and direct messages all funnel through:

```text
Channel ───────┐
Study Room ────┼──> Conversation ───> Messages
Direct DM ─────┘
```

Supported `conversation.type` values: `channel`, `room`, `direct`. Authorization is dispatched by type in [app/core/permissions.py](app/core/permissions.py) (`can_access_conversation` / `can_send_to_conversation`):

- `channel` conversations check group membership (and private-channel membership).
- `room` conversations check study room membership/host status, plus a lifecycle gate (an ended room becomes read-only).
- `direct` conversations check `conversation_members` (the only membership source for DMs).

The full schema and business rules live in [docs/db/STUDY_PLATFORM_DATABASE_SPEC.md](docs/db/STUDY_PLATFORM_DATABASE_SPEC.md) — this README intentionally does not duplicate them.

### Realtime

```text
initial message history  → FastAPI (GET /conversations/{id}/messages, cursor-paginated)
new/updated/deleted messages → Supabase Realtime (Postgres Changes on the messages table)
```

Typing indicators and presence are not implemented.

### Attachments

```text
Frontend
  → POST /conversations/{conversation_id}/attachments/upload-url  (FastAPI, authorized)
  → uploads the file directly to Supabase Storage using the returned signed URL
  → POST /conversations/{conversation_id}/messages with attachment_path set
```

FastAPI validates that a client-supplied `attachment_path` was actually issued to that user/conversation before accepting it on a message, and issues short-lived signed download URLs via `GET /messages/{message_id}/attachment-url`.

### LiveKit meetings

Implemented as an MVP: FastAPI issues LiveKit participant tokens; it does not proxy audio/video.

```http
POST /study-rooms/{room_id}/meeting/token
```

```text
Frontend
  → FastAPI authentication + Study Room authorization (can_join_room_meeting)
  → LiveKit participant token (room-scoped, TTL-limited)
  → frontend connects directly to LiveKit Cloud using that token
```

FastAPI never creates/closes the LiveKit room explicitly (LiveKit Cloud manages that lifecycle) and never sees media. Recording, transcription, attendance tracking, webhooks, and whiteboard are **not** implemented.

## Project Structure

```text
app/
├── core/            # settings, permission helpers (app/core/permissions.py)
├── db/               # SQLAlchemy Base, session factory, shared enums
├── auth/             # Supabase token verification, get_current_user dependency
├── profiles/         # user profile entity/service/router
├── groups/           # study groups + membership
├── channels/         # text channels + membership
├── conversations/    # Conversation abstraction (channel/room/direct) + direct DM endpoints
├── messages/         # message CRUD, list/paginate per conversation
├── attachments/       # signed upload/download URL issuance for Supabase Storage
├── study_rooms/      # study rooms, membership, moderation actions
├── meetings/         # LiveKit participant-token service
├── resources/        # resource folders/files
├── forum/            # categories, posts, comments, likes
└── notifications/    # notifications
tests/                # unit/API tests (ASGITransport, no live network) + tests/integration
docs/
├── db/
│   ├── STUDY_PLATFORM_DATABASE_SPEC.md
│   └── migrations/    # numbered SQL migrations + README
└── open_swagger.py    # dev helper: runs the server and opens /docs
```

Each `app/<domain>/` package follows the same layout: `entities/` (SQLAlchemy models), `dto/` (Pydantic request/response schemas), `services/` (business logic), `routers/` (FastAPI routes).

## Prerequisites

- Python 3.13 (no strict version pin declared in the repo; this is the version used in development)
- A Supabase project (PostgreSQL database, Auth, and Storage)
- A LiveKit Cloud project (only required for Study Room meeting functionality)

## Environment Setup

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Unix/macOS:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Environment Variables

Copy [.env.example](.env.example) to `.env` and fill in real values. **Never commit `.env`.**

```text
Database
  DATABASE_URL=

Supabase
  SUPABASE_URL=
  SUPABASE_PUBLISHABLE_KEY=
  SUPABASE_SERVICE_ROLE_KEY=      # server-side only; never expose to the frontend
  ATTACHMENT_DOWNLOAD_URL_EXPIRES_IN=300

LiveKit
  LIVEKIT_URL=
  LIVEKIT_API_KEY=
  LIVEKIT_API_SECRET=
  LIVEKIT_TOKEN_TTL_SECONDS=600   # optional, defaults to 600 if unset
```

`SUPABASE_SERVICE_ROLE_KEY` is required for the attachment upload-url/download-url endpoints (Supabase Storage admin API); without it those endpoints return a 500.

## Running the Backend

```bash
uvicorn app.main:app --reload
```

or, equivalently:

```bash
python run.py
```

The API is served at `http://localhost:8000` by default.

## API Documentation

FastAPI's interactive docs are enabled at their default paths:

```text
/docs
/redoc
/openapi.json
```

A helper script starts the server and opens Swagger automatically:

```bash
python -m docs.open_swagger
```

## Authentication

```http
Authorization: Bearer <supabase_access_token>
```

Supabase Auth owns user sign-up/sign-in. FastAPI's `get_current_user` dependency (`app/auth/dependencies.py`) verifies the bearer token against Supabase's JWKS and derives the authenticated user's UUID from the token's `sub` claim. Endpoints authorize and attribute actions (message sender, room host, moderator, etc.) using this derived identity — **client-supplied identity fields in request bodies (e.g. `host_id`, `moderator_id`) are never trusted.**

## Major API Areas

| Area | Prefix |
|---|---|
| Auth | `/auth` |
| Profiles | `/profiles` |
| Groups | `/groups` |
| Channels | `/channels` |
| Conversations / Messages | `/conversations`, `/messages` |
| Study Rooms | `/study-rooms` |
| Attachments | `/conversations/{id}/attachments`, `/messages/{id}/attachment-url` |
| Resources | `/resources` |
| Forum | `/forum` |
| Notifications | `/notifications` |

Notable endpoints:

```http
POST /conversations/direct
POST /study-rooms/{room_id}/meeting/token
```

See `/docs` for the complete, always-current endpoint list and schemas.

## Database and Migrations

Migrations are plain SQL files under [docs/db/migrations/](docs/db/migrations/), tracked in Git and run manually against Supabase — nothing is auto-applied by the app or CI. Larger migrations follow a `preflight → migration → verify` convention, with a `_rollback.sql` kept only as a reviewed, ready-to-use undo path (not part of the normal run sequence).

Milestones (001–007, all applied live as of the current migrations README):

```text
001: enable Realtime + confirm RLS on messages/channels/channel_members/group_members
002: fix a channel-access RLS bug (superseded/reapplied by 004 §7)
003: create the private message-attachments Storage bucket
004: expand chat to the Conversation abstraction (channel/room/direct), alongside legacy messages.channel_id
005: contract phase — drop legacy messages.channel_id after the backend refactor landed
006: enforce direct-conversation pair uniqueness (one DM per user pair)
007: fix a Study Room moderation RLS policy (tautological predicate)
```

Full details, run order, and current status: [docs/db/migrations/README.md](docs/db/migrations/README.md). Complete schema and business rules: [docs/db/STUDY_PLATFORM_DATABASE_SPEC.md](docs/db/STUDY_PLATFORM_DATABASE_SPEC.md).

## Testing

```bash
pytest tests/ -q
```

Test categories:

- `tests/test_*.py` — unit/API tests against an in-process ASGI app (no live network or database).
- `tests/integration/` — end-to-end tests against a real Supabase project. They require pre-existing Supabase Auth test users supplied via environment variables (`SUPABASE_TEST_USER_A_EMAIL`/`PASSWORD`, etc.); any test that's missing those variables is skipped automatically.

## Current Development Status

Backend APIs are under active development. Frontend integration is not yet complete, and chat and meeting features still require end-to-end frontend validation.

## Documentation

- [docs/db/STUDY_PLATFORM_DATABASE_SPEC.md](docs/db/STUDY_PLATFORM_DATABASE_SPEC.md) — full schema, relationships, and business rules.
- [docs/db/migrations/README.md](docs/db/migrations/README.md) — migration run order and live status.
- Project design doc: https://docs.google.com/document/d/1hkcR2caS_9mWPl6JrovgKbv5g54odd6Dptg_TgCeEmw/edit?tab=t.0
