# Study Together System

A platform for group study: study groups with text channels, live study rooms with video meetings, shared resources, and a learning forum. The repository has two parts: a FastAPI backend (`app/`) with a fully implemented, tested API, and a React/Vite frontend (`frontend/`) that currently provides page-level UI for the product's screens but is **not yet wired to the backend, Supabase, or LiveKit** — see [Current Development Status](#current-development-status) for the precise breakdown.

## Overview

### Backend domains

The backend implements the following domains as APIs with corresponding tests:

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

### Frontend pages

`frontend/` (React + TypeScript + Vite) has page-level UI for the product's main screens: Home, Forum (list + post detail + comments), Study Groups (list + detail with channels), Study Room (video-call grid + whiteboard + in-room chat), Login/Register, Account Settings, and a personal "Goals" (Aim) page. All of these currently render from hardcoded or in-memory mock data — see [Current Development Status](#current-development-status) for which parts are real UI vs. static mock content, and what it would take to connect them to the backend above.

## Tech Stack

### Backend

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

### Frontend

```text
React 19
TypeScript
Vite
React Router (react-router-dom)
lucide-react (icons)
oxlint (linting)
```

Styling is inline (`style={{...}}` objects) plus a small global [frontend/src/index.css](frontend/src/index.css) — there is no CSS framework (e.g. Tailwind) or component library in use. There is no state-management library (no Redux/Zustand/Context store beyond local `useState`/`useEffect`/`localStorage`), no HTTP client (no `axios`/`fetch` wrapper), and no Supabase or LiveKit client SDK in [frontend/package.json](frontend/package.json) — see [Current Development Status](#current-development-status). See [frontend/package.json](frontend/package.json) for the full, authoritative dependency list.

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

### Frontend responsibilities (intended, not yet wired)

The diagrams below (authentication flow, chat, attachments, LiveKit meetings) describe the **backend-side design** and the frontend integration it was built for. As of this repository's current state, the `frontend/` app does not call any of it: page components render from hardcoded/mock data, "auth" is a `localStorage.setItem('auth', 'true')` flag set by the login form (no Supabase call, no token), and there is no `fetch`/`axios`/Supabase-client/LiveKit-client code anywhere in `frontend/src`. See [Current Development Status](#current-development-status).

### Authentication flow

```text
Frontend
  → Authorization: Bearer <Supabase access token>
  → FastAPI get_current_user (app/auth/dependencies.py)
  → JWT verification against Supabase's JWKS
  → authenticated user UUID (+ email/role claims)
```

See [Authentication](#authentication) below for how this is used by backend endpoints. The frontend's login/register pages do not perform this flow yet (see above).

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

The full schema and business rules live in [docs/db/STUDY_PLATFORM_DATABASE_SPEC.md](docs/db/STUDY_PLATFORM_DATABASE_SPEC.md) — this README intentionally does not duplicate them. The Study Room page in `frontend/` shows an in-room chat panel, but it's local component state seeded with mock messages, not a client of this API.

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

FastAPI validates that a client-supplied `attachment_path` was actually issued to that user/conversation before accepting it on a message, and issues short-lived signed download URLs via `GET /messages/{message_id}/attachment-url`. No frontend page currently calls this flow (no file-upload UI exists in `frontend/src`).

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

FastAPI never creates/closes the LiveKit room explicitly (LiveKit Cloud manages that lifecycle) and never sees media. Recording, transcription, attendance tracking, webhooks, and whiteboard are **not** implemented on the backend. The frontend's Study Room page renders a full video-call UI (participant grid, mic/camera/screen-share/raise-hand controls, a whiteboard tab) entirely from local mock state — it does not request a LiveKit token from the backend and has no LiveKit client SDK integration, so no real audio/video/whiteboard connection happens.

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
└── db/
    ├── STUDY_PLATFORM_DATABASE_SPEC.md
    └── migrations/    # numbered SQL migrations + README
scripts/
├── open_swagger.py             # dev helper: runs the server and opens /docs
└── realtime_integration_check.py  # manual Supabase Realtime check, not run by pytest
dev.py                # runs backend (uvicorn) + frontend (vite) together for local dev

frontend/              # React + TypeScript + Vite app (see Tech Stack / Current Development Status)
├── src/
│   ├── main.tsx        # app entry point
│   ├── index.css       # global styles
│   ├── routes/          # AppRoutes (react-router-dom route table + ProtectedRoute)
│   ├── components/
│   │   ├── layout/       # Header, Footer, Layout
│   │   └── ui/            # Avatar, Button, Dropdown, Hover, Modal, SearchInput
│   ├── hooks/            # useAuth (localStorage-based, see caveats above)
│   └── pages/
│       ├── HomePage.tsx, LoginPage.tsx, RegisterPage.tsx, Aim.tsx, AccountSettingsPage.tsx
│       ├── StudyGroup/    # StudyGroups (list), StudyGroupDetail, StudyRoom (call + whiteboard UI)
│       └── forum/         # ForumPage, ForumPostDetail, components/, hooks/, lib/forum.api.ts (mock data), types/
├── package.json
└── vite.config.ts
```

Each `app/<domain>/` package follows the same layout: `entities/` (SQLAlchemy models), `dto/` (Pydantic request/response schemas), `services/` (business logic), `routers/` (FastAPI routes).

## Prerequisites

Backend:

- Python 3.13 (no strict version pin declared in the repo; this is the version used in development)
- A Supabase project (PostgreSQL database, Auth, and Storage)
- A LiveKit Cloud project (only required for Study Room meeting functionality)

Frontend:

- Node.js + npm (no version pin declared in the repo; `frontend/package.json` targets React 19 / Vite 8 / TypeScript ~6.0, which require a reasonably current Node.js)

## Environment Setup

### Backend

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

### Frontend

```bash
cd frontend
npm install
```

## Environment Variables

Copy [.env.example](.env.example) to `.env` and fill in real values. **Never commit `.env`.** These are consumed by the backend only — the frontend does not currently read any environment variables (no `import.meta.env`/Supabase-client/LiveKit-client usage exists in `frontend/src`; see [Current Development Status](#current-development-status)), so there is no `frontend/.env`.

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

## Running the Frontend

```bash
cd frontend
npm run dev
```

The Vite dev server is served at `http://localhost:5173` by default (Vite's default port; not overridden in [frontend/vite.config.ts](frontend/vite.config.ts)). As noted above, it currently runs standalone against mock/hardcoded data — pointing it at the backend from above requires wiring that does not exist yet.

## Running Both Together

```bash
python dev.py
```

This starts the backend at `http://localhost:8000` and the frontend at `http://localhost:5173`, streaming both processes' output with `[backend]`/`[frontend]` prefixes. Requires `npm` on `PATH` and frontend dependencies already installed (`npm install` in `frontend/`).

## API Documentation

FastAPI's interactive docs are enabled at their default paths:

```text
/docs
/redoc
/openapi.json
```

A helper script starts the server and opens Swagger automatically:

```bash
python -m scripts.open_swagger
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

### Backend

```bash
pytest tests/ -q
```

Test categories:

- `tests/test_*.py` — unit/API tests against an in-process ASGI app (no live network or database).
- `tests/integration/` — end-to-end tests against a real Supabase project. They require pre-existing Supabase Auth test users supplied via environment variables (`SUPABASE_TEST_USER_A_EMAIL`/`PASSWORD`, etc.); any test that's missing those variables is skipped automatically.

[scripts/realtime_integration_check.py](scripts/realtime_integration_check.py) is a standalone, manually-run script (not part of the pytest suite) that opens real Supabase Realtime WebSocket connections to verify group-chat Realtime authorization; run it directly with real credentials when validating that change.

### Frontend

There is no automated test suite for the frontend (no test runner is configured in [frontend/package.json](frontend/package.json), and there are no `*.test.*`/`*.spec.*` files under `frontend/src`). The available `npm` scripts are:

```bash
cd frontend
npm run lint      # oxlint
npm run build     # tsc -b && vite build (type-checks + production build)
```

## Current Development Status

**Backend:** all domains listed under [Backend domains](#backend-domains) above are implemented as FastAPI endpoints with corresponding unit/API tests (see [Testing](#testing)), and migrations 001–007 are applied live (see [Database and Migrations](#database-and-migrations)). Chat/meeting features are backend-complete but still require end-to-end frontend validation once the frontend is wired up.

**Frontend:** `frontend/` is a page-level UI prototype, not yet integrated with the backend. Concretely, as of this repository's current state:

- Every page (`HomePage`, `ForumPage`/`ForumPostDetail`, `StudyGroups`/`StudyGroupDetail`/`StudyRoom`, `LoginPage`/`RegisterPage`, `AccountSettingsPage`, `Aim`) renders from hardcoded JSX or in-memory mock data (e.g. `frontend/src/pages/forum/lib/forum.api.ts` implements a `forumApi` with the same function/DTO shapes the backend uses, but backed by local arrays, not HTTP calls).
- There is no `fetch`/`axios` call, no Supabase client, and no LiveKit client SDK anywhere in `frontend/src` — nothing in the frontend talks to the FastAPI backend, Supabase, or LiveKit Cloud.
- "Login"/"logout" is a `localStorage.setItem('auth', 'true')` / `removeItem('auth')` flag read by `useAuth()` and `ProtectedRoute` — there is no real authentication, no Supabase session, and no token is ever sent anywhere.
- The Study Room page renders a full video-call UI (participant grid, mic/camera/screen-share/raise-hand, whiteboard) and an in-room chat panel, entirely from local component state with mock participants/messages — no LiveKit connection and no Conversations/Messages API calls occur.
- There is no automated frontend test suite (see [Testing](#testing)).

**Resources update (2026-08-19):** the bullet points above no longer hold for Resources specifically. `frontend/src/pages/StudyGroup/StudyGroupDetail.tsx` (via `frontend/src/hooks/useGroupResources.ts` + `frontend/src/lib/resource.api.ts`) is wired to the real `app/resources` API and Supabase Storage: list, upload, Open/Preview, explicit Download, and delete all use persisted backend/Storage data, no mock resource list remains. Files live in the private `group-resources` Storage bucket via FastAPI-issued signed upload/download URLs (migration `014_create_group_resources_bucket.sql`, applied live and verified). Stale legacy seed metadata (`mock-resource-*` rows with no real Storage object) was removed by migration `015_cleanup_stale_mock_resources.sql`, also applied live and verified — see [docs/db/migrations/README.md](docs/db/migrations/README.md).

In short: the backend is a complete, tested API surface; the frontend is a UI shell over the intended screens that has not yet been connected to it, except where noted above (Resources). Wiring the rest of the frontend to the backend (real auth via Supabase, real data via the FastAPI endpoints, LiveKit for meetings, Realtime for chat) is the next major milestone.

## Documentation

- [docs/db/STUDY_PLATFORM_DATABASE_SPEC.md](docs/db/STUDY_PLATFORM_DATABASE_SPEC.md) — full schema, relationships, and business rules.
- [docs/db/migrations/README.md](docs/db/migrations/README.md) — migration run order and live status.
- Project design doc: https://docs.google.com/document/d/1hkcR2caS_9mWPl6JrovgKbv5g54odd6Dptg_TgCeEmw/edit?tab=t.0
