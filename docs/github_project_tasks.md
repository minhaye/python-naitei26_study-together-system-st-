# GitHub Project Task Catalog

Reconstructed from repository evidence (git history, code, tests, migrations, and docs) as of commit `1ee6910` (2026-08-16, `master`). This file is the source of truth for manually creating GitHub Project items and Issues — it is not itself a GitHub artifact.

**MVP-completeness audit (2026-08-16, against `5e3d732`):** no application code changed between `1ee6910` and `5e3d732` (only this file, `README.md`, `.gitignore`, and `dev.py` were touched in between), so every Done/Ready/Backlog finding below remains accurate. This pass added tasks for end-to-end gaps evidenced directly against the current code and `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` (Resource file upload/download, Profile/Account-Settings frontend integration, Resources frontend integration, Notifications frontend integration), and expanded five existing tasks' Scope/Acceptance Criteria where completing them exactly as originally written would still have left a feature end-to-end incomplete or a security question unresolved (Group self-join, Study Room moderation-action wiring, the `POST /notifications` public-endpoint question, Realtime security-check coverage, and the Resource signed-upload cross-reference). See the individual tasks for details.

## Summary

### Done

- Establish backend layered architecture & initial domain models
- Implement Supabase authentication
- Implement Group & Channel management (CRUD + membership)
- Implement Study Rooms (rooms, membership, moderation log)
- Implement Resource folders & files (metadata CRUD)
- Implement Forum (categories, posts, comments, replies, likes)
- Implement Notifications backend (CRUD)
- Implement channel messaging with Supabase Realtime + attachments
- Refactor messaging to Conversation architecture (channel chat)
- Add Study Room chat and authorization
- Add Direct Messaging (1:1 DM)
- Implement LiveKit meeting token API
- Secure Study Room authorization (API + RLS fix)
- Track SQL migration files & runbook in version control
- Scaffold React frontend shell (routing, layout, Home, placeholder auth)
- Build mock Study Groups & Study Room frontend UI
- Build mock Forum frontend UI (browse/post/comment)
- Build mock Account Settings & Goal ("Aim") frontend UI

### In progress

*(none identified — no branch or working-tree evidence of partially-built features; every non-master branch is fully merged, see Evidence in individual tasks)*

### In review

*(none identified — most recent work, PR #17, is already merged)*

### Ready

- Remove plaintext test credentials from repository
- Secure Group & Channel authorization
- Secure Forum authorization
- Secure Resource authorization
- Secure Profile authorization
- Secure Notification authorization
- Implement Resource file upload/download with Supabase Storage
- Set up frontend API client and backend CORS
- Integrate Supabase Auth into frontend
- Integrate Profile / Account Settings API into frontend
- Integrate Study Group & Channel APIs into frontend
- Integrate Study Room APIs into frontend
- Integrate Resources into frontend
- Integrate Forum APIs into frontend
- Integrate messaging with backend and Supabase Realtime
- Integrate Notifications into frontend
- Fix broken links to deleted integration docs

### Backlog

- Integrate LiveKit video meetings into the Study Room frontend
- Wire up automatic notification creation for domain events
- Execute the Supabase Realtime security check script against a live project

---

## Done

### Establish backend layered architecture & initial domain models

**Status:** Done
**Type:** Infrastructure
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Bootstrapped the FastAPI backend and established the per-domain `entities/ dto/ services/ routers/` layering that every subsequent feature follows. The first pass (`d260e3a`) used a flat `app/models`, `app/schemas`, `app/crud` layout; it was immediately restructured twice into the current per-domain package layout.

**Motivation**
A layered, per-domain structure was needed before any real feature work could proceed in parallel across group/channel/study-room/forum/resource/notification domains without merge conflicts or circular imports.

**Scope**
- Initial SQLAlchemy models, Pydantic schemas, and CRUD functions for all core domains (`d260e3a`).
- Restructure from `app/models` + `app/schemas` + `app/crud` into per-domain `app/<domain>/entities|dto|services|routers` packages (`ff9dee8`).
- File/module renames to a consistent `*_entity.py` / `*_dto.py` / `*_service.py` / `*_router.py` naming convention (`45b3703`).
- `app/db/base.py` (declarative Base), `app/db/session.py`, `app/core/config.py` (pydantic-settings).

**Out of Scope**
- Business logic correctness of individual domains (covered by their own tasks below).
- Authentication (added later, see "Implement Supabase authentication").

**Acceptance Criteria**
- [x] `app/<domain>/{entities,dto,services,routers}` layout exists for every domain.
- [x] `app/main.py` composes routers from each domain package.
- [x] No leftover flat `app/models`/`app/schemas`/`app/crud` modules remain.

**Dependencies**
None identified.

**Related Code**
- `app/db/base.py`, `app/db/session.py`, `app/core/config.py`
- `app/*/entities/*_entity.py`, `app/*/dto/*_dto.py`, `app/*/services/*_service.py`, `app/*/routers/*_router.py`
- `app/main.py`

**Evidence**
- `650af4e` Initial commit → `d260e3a` "feat: add models, schemas and CRUD layer" → `ff9dee8` "refactor: layer architecture for be" → `45b3703` "refactor 2: rename and files position". The current tree matches the end state of these three commits exactly.

**Testing**
No dedicated tests for the scaffolding itself; correctness is exercised indirectly by every domain's own test suite.

**Risks / Edge Cases**
None identified.

**Notes**
This is purely structural work; treat it as the prerequisite for every other backend task in this catalog.

---

### Implement Supabase authentication

**Status:** Done
**Type:** Feature
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Added Supabase Auth as the identity provider for the API: `get_current_user` verifies a bearer access token against Supabase's JWKS and derives a `CurrentUser` (UUID + claims) from the `sub` claim. `GET /auth/me` exposes the resolved identity.

**Motivation**
Every authorization decision in the backend (message sender, room host, moderator, etc.) needs a trustworthy, server-verified user identity rather than a client-supplied one — this is the foundation all later authorization work (e.g. the Study Room authorization fix) builds on.

**Scope**
- JWT verification against Supabase JWKS (`app/auth/dependencies.py`).
- `CurrentUser` DTO and `GET /auth/me` (`app/auth/routers/auth_router.py`).
- `AuthService` (`app/auth/services/auth_service.py`).
- Supabase-related settings (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, etc. in `app/core/config.py`, `.env.example`).

**Out of Scope**
- Wiring `get_current_user` into every domain router (groups/channels/forum/resources/notifications/profiles still don't use it — see the "Secure ... authorization" Ready tasks below).
- Frontend login/session handling (frontend has no real Supabase client integration — see "Integrate Supabase Auth into frontend").

**Acceptance Criteria**
- [x] Requests with a valid Supabase access token resolve to a `CurrentUser` with the correct UUID.
- [x] Requests with a missing/invalid/expired token are rejected.
- [x] `GET /auth/me` returns the authenticated user's identity.

**Dependencies**
None identified.

**Related Code**
- `app/auth/dependencies.py`, `app/auth/dto/auth_dto.py`, `app/auth/routers/auth_router.py`, `app/auth/services/auth_service.py`
- `app/core/config.py` (`supabase_jwks_url`, `supabase_issuer`)
- `tests/test_auth.py`

**Evidence**
- `b374ce3` "feat: implement Supabase authentication" adds `app/auth/*`, config settings, and `tests/test_auth.py`.
- README §Authentication documents the same flow as currently implemented.

**Testing**
- Existing: `tests/test_auth.py` (28 lines — smoke-level coverage of `GET /auth/me`).
- Missing: no test exercises a genuinely invalid/tampered signature or expired token via the real JWKS-verification path (would likely require Supabase test credentials, similar to `tests/integration/`).

**Risks / Edge Cases**
None identified beyond the coverage gap noted above.

**Notes**
`docs/acc test login` (a tracked file holding plaintext seed-user credentials for manual/local testing) is a live security issue in its own right, not a footnote of this task — see "Remove plaintext test credentials from repository" (Ready) for the full investigation and remediation scope.

---

### Implement Group & Channel management (CRUD + membership)

**Status:** Done
**Type:** Feature
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Core study-group domain: groups with owner/moderator/member roles and active/banned/left membership status, plus text channels (public or private) nested inside a group with their own membership table. Implements the create-group-and-owner-membership-in-one-transaction rule from the spec.

**Motivation**
Groups and channels are the top-level organizing unit the rest of the product (study rooms, resources, chat) nests under; per `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §1.1/§4-10, this is core MVP scope.

**Scope**
- `Group`/`GroupMember` CRUD, role (`owner`/`moderator`/`member`) and status (`active`/`banned`/`left`) management.
- `Channel`/`ChannelMember` CRUD, `is_private` flag.
- Group creation atomically inserts the owner's `group_members` row (`GroupsService.create`, per spec §8).

**Out of Scope**
- Authorization/permission enforcement on these endpoints — **none of these endpoints currently check the caller's identity or role at all** (no `get_current_user` dependency anywhere in `group_router.py`/`channel_router.py`); see "Secure Group & Channel authorization" (Ready) below.
- Chat inside channels (see "Implement channel messaging...").

**Acceptance Criteria**
- [x] Creating a group also creates an `owner` `group_members` row in the same transaction.
- [x] Group members can be added/listed/role-changed/status-changed/removed.
- [x] Channels can be created/updated/deleted under a group, with private-channel membership tracked separately in `channel_members`.

**Dependencies**
None identified.

**Related Code**
- `app/groups/entities/group_entity.py`, `app/groups/dto/group_dto.py`, `app/groups/services/group_service.py`, `app/groups/routers/group_router.py`
- `app/channels/entities/channel_entity.py`, `app/channels/dto/channel_dto.py`, `app/channels/services/channel_service.py`, `app/channels/routers/channel_router.py`
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §4-10

**Evidence**
- `d260e3a`/`ff9dee8`/`45b3703` introduce and restructure `app/groups`, `app/channels`.
- `app/groups/routers/group_router.py` and `app/channels/routers/channel_router.py` expose 11 and 6 endpoints respectively, all functioning against a real DB session.

**Testing**
- Existing: none. There is no `tests/test_groups.py` or `tests/test_channels.py`, unlike every chat-adjacent domain (messages, conversations, attachments, study rooms all have dedicated test files).
- Missing: this is the largest test-coverage gap in the backend; see "Secure Group & Channel authorization" for where this should be added (bundled with the auth fix, mirroring how the Study Room fix added its tests in the same PR).

**Risks / Edge Cases**
- No authorization (see Out of Scope) — tracked as a separate Ready task rather than duplicated here.

**Notes**
`app/core/permissions.py` already defines `is_active_group_member`/`is_group_manager`/`can_access_channel` (built for the chat/Conversation authorization work) — these are directly reusable when securing these routers.

---

### Implement Study Rooms (rooms, membership, moderation log)

**Status:** Done
**Type:** Feature
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Live study-session domain: a study room belongs to a group, has a host, a `waiting`/`active`/`ended` lifecycle, join/leave/rejoin membership semantics, and a `room_moderation_actions` audit log for `mute`/`unmute`/`kick`/`raise_hand`/`lower_hand`.

**Motivation**
Per spec §16-22, study rooms are core MVP scope and the anchor for the later chat (room conversations) and meeting (LiveKit) features.

**Scope**
- `StudyRoom`/`StudyRoomMember` CRUD, `host`/`moderator`/`participant` roles.
- Room lifecycle: `start`, `end`.
- Join/leave/rejoin membership (rejoin updates the existing row rather than inserting a new one, per spec §20).
- `RoomModerationAction` logging and listing.

**Out of Scope**
- Authorization of these actions — this was originally unguarded and was fixed later; see "Secure Study Room authorization" (Done, below) for the fix itself. This task represents the original feature build, pre-fix.
- Chat inside a room (see "Add Study Room chat and authorization").
- LiveKit video/audio (see "Implement LiveKit meeting token API").

**Acceptance Criteria**
- [x] A room can be created, started, ended.
- [x] Users can join/leave/rejoin without duplicate membership rows (`UNIQUE(room_id, user_id)`).
- [x] Moderation actions are logged with moderator, target, action, and reason.

**Dependencies**
None identified.

**Related Code**
- `app/study_rooms/entities/study_room_entity.py`, `app/study_rooms/dto/study_room_dto.py`, `app/study_rooms/services/study_room_service.py`, `app/study_rooms/routers/study_room_router.py`
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §16-22

**Evidence**
- `d260e3a`/`ff9dee8`/`45b3703` introduce `app/study_rooms`.
- `tests/test_study_rooms.py` (722 lines, though most of this volume was added later by the `1250d29` authorization fix — see that task).

**Testing**
- See "Secure Study Room authorization" — most of the current `test_study_rooms.py` content was added alongside that fix, not this original build.

**Risks / Edge Cases**
None identified beyond the authorization gap (tracked as its own Done task once fixed).

---

### Implement Resource folders & files (metadata CRUD)

**Status:** Done
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Group-scoped document organization: nested `resource_folders` and `resources` (file metadata only — binary storage is out of scope of the database, per spec §24).

**Motivation**
Per spec §1.1/§23-24, letting a group organize shared study material into folders is core MVP scope.

**Scope**
- `ResourceFolder` CRUD, including nested subfolders (`parent_folder_id`) and subfolder listing.
- `Resource` (file metadata: `file_path`, `file_type`, `file_size`) CRUD.

**Out of Scope**
- Actual file upload/download against Supabase Storage — unlike `app/attachments/`, there is no signed-URL upload/download flow for resources; `file_path` is accepted as a plain string with no validation that anything was actually uploaded.
- Authorization — no `get_current_user` usage in `resource_router.py`; see "Secure Resource authorization" (Ready).

**Acceptance Criteria**
- [x] Folders can be created, nested, listed (including subfolder listing), updated, deleted.
- [x] Files can be created (metadata), listed, updated, deleted.

**Dependencies**
None identified.

**Related Code**
- `app/resources/entities/resource_entity.py`, `app/resources/dto/resource_dto.py`, `app/resources/services/resource_service.py`, `app/resources/routers/resource_router.py`
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §23-24

**Evidence**
- `d260e3a`/`ff9dee8`/`45b3703` introduce `app/resources`.

**Testing**
- Existing: none (no `tests/test_resources.py`).
- Missing: full endpoint coverage — see "Secure Resource authorization" for where this should be added.

**Risks / Edge Cases**
- `ResourceCreate.file_path` is an unvalidated string — nothing confirms the referenced object actually exists in storage, unlike the attachment flow's `object_exists` check. Worth revisiting once/if resources move to a signed-upload flow like attachments.

---

### Implement Forum (categories, posts, comments, replies, likes)

**Status:** Done
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Site-wide learning forum: categories, posts (with soft delete via `deleted_at`), threaded comments (self-referencing `parent_comment_id` for replies), and separate like tables for posts and comments.

**Motivation**
Per spec §1.2/§25-29, the forum is the second major product pillar alongside study groups.

**Scope**
- `ForumCategory` CRUD.
- `ForumPost` CRUD with soft delete (`soft_delete_post` sets `deleted_at`; `list_posts_by_category` filters `deleted_at IS NULL`).
- `Comment` CRUD with `parent_comment_id` reply nesting.
- `PostLike`/`CommentLike` create/delete (idempotency guarded by a pre-check + `UNIQUE(post_id, user_id)`/`UNIQUE(comment_id, user_id)`).

**Out of Scope**
- Authorization — no `get_current_user` usage anywhere in `forum_router.py`; any caller can create a category, or edit/delete any other user's post or comment by supplying an arbitrary `author_id`/`post_id`. See "Secure Forum authorization" (Ready).
- Automatic notifications on like/comment/reply (`NotificationType.POST_LIKE`/`POST_COMMENT`/`COMMENT_REPLY` exist as enum values but nothing in `forum_service.py` creates a `Notification` row) — see "Wire up automatic notification creation for domain events" (Backlog).
- Forum frontend (see "Build Forum frontend").

**Acceptance Criteria**
- [x] Posts can be filtered by category and paginated (`skip`/`limit`).
- [x] Deleted posts (`deleted_at` set) are excluded from listings.
- [x] Comments nest via `parent_comment_id`.
- [x] A user cannot like the same post/comment twice (checked at the service layer, backed by a DB unique constraint).

**Dependencies**
None identified.

**Related Code**
- `app/forum/entities/forum_entity.py`, `app/forum/dto/forum_dto.py`, `app/forum/services/forum_service.py`, `app/forum/routers/forum_router.py`
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §25-29

**Evidence**
- `d260e3a`/`ff9dee8`/`45b3703` introduce `app/forum`.

**Testing**
- Existing: none (no `tests/test_forum.py`).
- Missing: full endpoint coverage — see "Secure Forum authorization" for where this should be added.

**Risks / Edge Cases**
None identified beyond the authorization gap noted above (tracked separately).

---

### Implement Notifications backend (CRUD)

**Status:** Done
**Type:** Feature
**Priority:** Low
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Persisted per-user notifications (`post_like`, `post_comment`, `comment_reply`, `group_invite`, `group_role_changed`, `room_kicked`, `mention`) with create/list (with `unread_only` filter)/mark-read/delete.

**Motivation**
Per spec §30 and §41 (MVP scope), notifications are a required cross-cutting feature; this task is the CRUD substrate other domains are meant to call into.

**Scope**
- `Notification` CRUD (`app/notifications/`).
- List-for-user with unread filter and pagination.
- Mark-as-read.

**Out of Scope**
- Automatic creation from actual domain events (forum comment/like, group role change, room kick) — nothing calls `NotificationsService.create` except the raw `POST /notifications` endpoint itself. See "Wire up automatic notification creation for domain events" (Backlog).
- Authorization — no `get_current_user` usage in `notification_router.py`; `user_id` on `GET /notifications` and every notification-ID-based endpoint is unauthenticated. See "Secure Notification authorization" (Ready).
- Realtime push / email notifications (spec §42 explicitly leaves these as open questions, not implemented).

**Acceptance Criteria**
- [x] Notifications can be created, listed per user (optionally unread-only), marked read, and deleted.

**Dependencies**
None identified.

**Related Code**
- `app/notifications/entities/notification_entity.py`, `app/notifications/dto/notification_dto.py`, `app/notifications/services/notification_service.py`, `app/notifications/routers/notification_router.py`
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §30

**Evidence**
- `d260e3a`/`ff9dee8`/`45b3703` introduce `app/notifications`.
- `grep` confirms `NotificationsService`/`create_notification` are referenced only inside the notifications package itself — no other domain service calls it.

**Testing**
- Existing: none (no `tests/test_notifications.py`).
- Missing: full endpoint coverage — see "Secure Notification authorization" for where this should be added.

**Risks / Edge Cases**
None identified beyond the gaps noted above (tracked separately).

---

### Implement channel messaging with Supabase Realtime + attachments

**Status:** Done
**Type:** Feature
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
First working chat implementation: messages scoped to a channel (`messages.channel_id`), with clients getting message history from FastAPI and live updates from Supabase Realtime (Postgres Changes on `messages`), plus signed-URL file attachments via Supabase Storage.

**Motivation**
Per spec §1.1/§11 and the README's "Realtime" section, chat needed both a durable history API and a live-update path without FastAPI having to hold WebSocket connections itself.

**Scope**
- `Message` CRUD scoped to `channel_id` (the pre-Conversation schema).
- `app/attachments/`: signed upload-URL issuance, `attachment_path` validation on message create, signed download-URL issuance.
- Enabling the `messages` table in the `supabase_realtime` publication (migration `001_enable_realtime_messages.sql`).
- Private `message-attachments` Storage bucket (migration `003_create_message_attachments_bucket.sql`).
- Fix for a `can_access_channel()` RLS bug where a banned/left member with a stale `channel_members` row could still read a private channel (migration `002_fix_can_access_channel_active_membership.sql`).

**Out of Scope**
- The later migration to the polymorphic `Conversation` abstraction (channel/room/direct) — see "Refactor messaging to Conversation architecture".

**Acceptance Criteria**
- [x] A user can send/list/edit/delete messages in a channel they have access to.
- [x] A message can carry `content`, an `attachment_path`, or both (not neither).
- [x] Realtime is enabled on `messages` and RLS is confirmed on `messages`/`channels`/`channel_members`/`group_members`.

**Dependencies**
"Implement Group & Channel management (CRUD + membership)"; "Implement Supabase authentication".

**Related Code**
- `app/messages/`, `app/attachments/`
- `docs/db/migrations/001_enable_realtime_messages.sql`, `docs/db/migrations/002_fix_can_access_channel_active_membership.sql`, `docs/db/migrations/003_create_message_attachments_bucket.sql`

**Evidence**
- `5579f0a` "feat(chat): add realtime messaging and attachments" — adds `app/attachments/*`, extends `app/messages/*`, adds `app/core/permissions.py` (`can_access_channel`).
- `docs/db/migrations/README.md`: migrations 001-003 confirmed "✅ Applied live".

**Testing**
- Existing: `tests/test_messages.py`, `tests/test_attachments.py` (both later extended substantially by the Conversation refactor and room-chat work — see those tasks).

**Risks / Edge Cases**
None identified — superseded cleanly by the Conversation refactor (below), which kept the same authorization semantics.

---

### Refactor messaging to Conversation architecture (channel chat)

**Status:** Done
**Type:** Refactor
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Replaced the direct `channels → messages` relationship with a polymorphic `Conversation` parent (`type` = `channel`/`room`/`direct`) sitting between `channels`/`study_rooms`/direct-message pairs and `messages`. Executed as an expand/contract migration pair so the running backend was never broken mid-migration.

**Motivation**
Room chat and direct messaging (both planned next) had no way to reuse the existing `messages` table without either duplicating it per chat type or introducing a shared parent; per spec §12, `messages` hard-coded to `channel_id` couldn't support that, hence the `Conversation` abstraction.

**Scope**
- Expand phase: add `conversations`, `conversation_members`, `messages.conversation_id` alongside the still-live `messages.channel_id`, kept in sync by a compatibility trigger (`004_refactor_chat_to_conversations.sql`, verified by `004_verify.sql`: 33/33 checks OK).
- Backend refactor: SQLAlchemy models, `MessagesService`, message/attachment routers, and `app/core/permissions.py` moved to `conversation_id` as the operative column (`91d5712`).
- Contract phase: drop `messages.channel_id`, its FK/index, and the compatibility trigger, once the backend refactor was tested (`005_contract_messages_to_conversations.sql`, verified by `005_verify.sql`).
- `can_access_conversation()`/`can_send_to_conversation()` as the single dispatch point for channel/room/direct authorization (`app/core/permissions.py`).

**Out of Scope**
- Room-type and direct-type conversations themselves — the `conversations` schema supports them from migration 004 onward, but the room-chat and DM *features* are separate tasks (below); this task's functional scope is "channel chat now goes through `conversations`" only.

**Acceptance Criteria**
- [x] `messages.conversation_id` is the sole FK from `messages` (`messages.channel_id` no longer exists on the live schema).
- [x] Every existing channel has exactly one backfilled `conversations` row (`type='channel'`).
- [x] Channel chat behaves identically to before the refactor from the API consumer's point of view.

**Dependencies**
"Implement channel messaging with Supabase Realtime + attachments".

**Related Code**
- `app/conversations/entities/conversation_entity.py`, `app/conversations/services/conversation_service.py`
- `app/messages/entities/message_entity.py`, `app/messages/services/message_service.py`, `app/messages/routers/message_router.py`
- `app/core/permissions.py` (`can_access_conversation`, `can_send_to_conversation`, `is_room_conversation_open_for_writes`)
- `docs/db/migrations/004_preflight.sql`, `004_refactor_chat_to_conversations.sql`, `004_verify.sql`, `004_rollback.sql`
- `docs/db/migrations/005_preflight.sql`, `005_contract_messages_to_conversations.sql`, `005_verify.sql`, `005_rollback.sql`
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §12-14

**Evidence**
- `91d5712` "refactor(chat): contract messages to conversation_id" — introduces `app/conversations/*`, updates `app/messages/*`/`app/channels/*`/`app/core/permissions.py`.
- `docs/db/migrations/README.md`: 004 "✅ Applied live, verified"; 005 "✅ Applied live".
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §12 states both migrations are live as of 2026-08-16 and the backend refactor is complete.
- `d664e10`/`d925105` "docs(db): document Conversation chat migration, clean up stale db artifacts" — spec/doc updates accompanying this work.

**Testing**
- Existing: `tests/test_conversations.py`, `tests/test_permissions.py`, `tests/test_messages.py` all exercise conversation-based access.

**Risks / Edge Cases**
- The 005 rollback path is explicitly a best-effort reconstruction of the original `idx_messages_channel_created` definition (documented in `docs/db/migrations/README.md`, not a verified fact) — only relevant if 005 is ever actually rolled back.

---

### Add Study Room chat and authorization

**Status:** Done
**Type:** Feature
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Extended the Conversation-based chat to study rooms: a room-type conversation reuses the same `messages`/attachment endpoints as channel chat, gated by room membership plus a lifecycle rule — an ended room becomes read-only chat history for everyone, including the host.

**Motivation**
Per spec §1.1, live study rooms need in-session text chat; the `Conversation` abstraction built in the prior task made this a matter of adding a room-access authorization branch rather than a parallel messaging stack.

**Scope**
- `can_access_room`/`is_active_room_member`/`is_room_conversation_open_for_writes` authorization helpers in `app/core/permissions.py`.
- Room-scoped attachment path validation/namespacing (`validate_room_ownership`, `study-rooms/{room_id}/{user_id}/...`).
- Wiring room conversations through the same `GET/POST /conversations/{id}/messages` and attachment endpoints used by channels.

**Out of Scope**
- The FastAPI-level authorization *bugs* on the study-room CRUD/moderation endpoints themselves (host spoofing via client-supplied `host_id`, unguarded `join`/`leave`/`start`/`end`/moderation) — those were separate and are covered by "Secure Study Room authorization" below.

**Acceptance Criteria**
- [x] Room members can send/read messages and attachments in their room's conversation.
- [x] Non-members cannot access a room's conversation.
- [x] Once a room's `status` is `ended`, no new messages/attachments/edits/deletes are accepted, but existing history remains readable.

**Dependencies**
"Refactor messaging to Conversation architecture"; "Implement Study Rooms".

**Related Code**
- `app/core/permissions.py` (`can_access_room`, `is_active_room_member`, `is_room_conversation_open_for_writes`)
- `app/attachments/services/attachment_service.py` (`validate_room_ownership`)
- `app/messages/routers/message_router.py`, `app/attachments/routers/attachment_router.py`

**Evidence**
- `9846ae8` "feat: add study room chat and authorization" (merged via PR #12) — modifies `app/core/permissions.py`, `app/attachments/*`, `app/messages/routers/message_router.py`, `app/study_rooms/services/study_room_service.py`, and adds ~865 lines across `tests/test_attachments.py`, `tests/test_messages.py`, `tests/test_permissions.py`, `tests/test_study_rooms.py`.

**Testing**
- Existing: substantial coverage added in the same commit across `tests/test_attachments.py`, `tests/test_messages.py`, `tests/test_permissions.py`, `tests/test_study_rooms.py`.

**Risks / Edge Cases**
- Study rooms have no "banned" concept distinct from "left" — a kicked member is indistinguishable from one who left voluntarily (`left_at` set either way); `RoomModerationAction.KICK` is only an audit log entry, documented explicitly in `app/core/permissions.py::can_access_room`'s docstring.

---

### Add Direct Messaging (1:1 DM)

**Status:** Done
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
1:1 direct messaging between two users, reusing the generic conversation/message API. Guarantees at most one `direct`-type conversation per user pair at the database level, and handles the concurrent-open-DM race condition at the service layer via a SAVEPOINT + retry pattern.

**Motivation**
Per spec §12, direct messages did not exist before this work (`study_rooms` had no relation to `messages`, and there was no DM model/service at all); this closes the last gap in the chat architecture migration.

**Scope**
- `POST /conversations/direct` (idempotent get-or-create) and `GET /conversations/direct` (list current user's DMs).
- `conversations.direct_user_min_id`/`direct_user_max_id` (always sorted so A→B and B→A resolve to the same row) + CHECK constraint + partial unique index (migration 006).
- `ConversationsService.get_or_create_direct`: `SELECT`, then `INSERT` inside `session.begin_nested()` (a real SAVEPOINT); on a losing race (`IntegrityError` from the unique index) the SAVEPOINT rolls back and the service re-`SELECT`s the winning row.
- DM-scoped attachment namespace: `direct/{conversation_id}/{user_id}/{object_id}/{filename}`.
- Authorization via `is_conversation_member`, delegating to `conversation_members` (the sole membership source for DMs).

**Out of Scope**
- Group DMs (multi-user, not tied to a room/channel) — spec §13 explicitly defers `group_direct` as a future enum value, not current scope.

**Acceptance Criteria**
- [x] `POST /conversations/direct` returns the same conversation regardless of which of the two users calls it or in which order.
- [x] Two near-simultaneous `POST /conversations/direct` calls for the same pair never create two conversations (DB-enforced, not just service-layer).
- [x] DM messages/attachments use the same generic message/attachment endpoints as channel/room chat.

**Dependencies**
"Refactor messaging to Conversation architecture".

**Related Code**
- `app/conversations/dto/conversation_dto.py`, `app/conversations/routers/conversation_router.py`, `app/conversations/services/conversation_service.py` (`get_or_create_direct`, `is_member`)
- `app/core/permissions.py` (`is_conversation_member`)
- `docs/db/migrations/006_preflight.sql`, `006_direct_conversation_pair_uniqueness.sql`, `006_verify.sql`, `006_rollback.sql`
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §14-15

**Evidence**
- `f502bbc` "feat: add direct messaging support" (merged via PR #13) — adds `app/conversations/dto/conversation_dto.py`, `app/conversations/routers/conversation_router.py`, extends `app/conversations/services/conversation_service.py`, `tests/test_conversations.py` (403 lines), extends `tests/test_attachments.py`/`tests/test_messages.py`.
- `docs/db/migrations/README.md`: 006 "✅ Applied live".
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §15 documents the SAVEPOINT/retry race-condition handling matching the current `conversation_service.py` implementation.

**Testing**
- Existing: `tests/test_conversations.py` covers get-or-create idempotency and listing; attachment/message tests cover the DM path via the shared endpoints.

**Risks / Edge Cases**
None identified — the unique-pair constraint and SAVEPOINT retry directly address the obvious race condition.

---

### Implement LiveKit meeting token API

**Status:** Done
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
MVP video/audio meetings for study rooms: FastAPI issues short-lived LiveKit participant tokens; it never proxies media or explicitly creates/closes the LiveKit room (LiveKit Cloud manages that lifecycle on first join / last leave).

**Motivation**
Per spec §1.1 and the README, live study sessions need video/audio, and LiveKit Cloud was chosen so FastAPI only needs to authorize and issue tokens rather than run its own SFU.

**Scope**
- `POST /study-rooms/{room_id}/meeting/token`.
- `LiveKitService.create_participant_token` (`livekit-api`, room-scoped `VideoGrants`, configurable TTL).
- `can_join_room_meeting` authorization: same membership check as room chat, plus a lifecycle gate (no token once the room has `ended`).
- LiveKit settings (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_TOKEN_TTL_SECONDS`) added to config/`.env.example`/`requirements.txt`.

**Out of Scope**
- Recording, transcription, attendance tracking, webhooks, whiteboard — README explicitly states these are **not** implemented.
- Actual frontend video call UI wired to a real LiveKit room — see "Integrate LiveKit video meetings into the Study Room frontend" (Backlog); the existing `StudyRoom.tsx` meeting UI is a static mock (no `livekit-client` dependency, no call to this endpoint).

**Acceptance Criteria**
- [x] A room member can obtain a LiveKit participant token scoped to their room.
- [x] A non-member is rejected.
- [x] No token is issued once the room has ended.

**Dependencies**
"Add Study Room chat and authorization" (shares `can_access_room`); "Implement Study Rooms".

**Related Code**
- `app/meetings/dto/meeting_dto.py`, `app/meetings/services/livekit_service.py`
- `app/study_rooms/routers/study_room_router.py` (`POST /{room_id}/meeting/token`)
- `app/core/permissions.py` (`can_join_room_meeting`)
- `app/core/config.py`, `.env.example`, `requirements.txt` (`livekit-api==1.2.0`)

**Evidence**
- `944829c` "chore(livekit): set up backend environment" — adds LiveKit env vars/dependency.
- `6e1fbe5` "feat: add LiveKit meeting token endpoint" (merged via PR #15) — adds `app/meetings/*`, `can_join_room_meeting`, the router endpoint, and `tests/test_meetings.py` (278 lines).

**Testing**
- Existing: `tests/test_meetings.py` covers token issuance authorization; `tests/test_permissions.py` covers `can_join_room_meeting`.

**Risks / Edge Cases**
None identified — this is a deliberately minimal MVP per its own docstring in `livekit_service.py`.

---

### Secure Study Room authorization (API + RLS fix)

**Status:** Done
**Type:** Bug
**Priority:** Urgent
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Closed a set of real authorization vulnerabilities in the Study Room domain: every mutating endpoint (`create`, `update`, `start`, `end`, `join`, `leave`, member-role change, moderation logging) trusted client-supplied identity (`host_id`, `user_id`, `moderator_id`) instead of the authenticated caller, and several endpoints (`list_members`, `list_moderation`, moderation actions themselves) had no access check at all. Paired with a database-level fix for a tautological RLS predicate that let any active member of *any* study room read another room's moderation log.

**Motivation**
`docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §37 documents this as "a real security issue, not just a logic bug" for the RLS half; the API half is the same class of bug (trusting client-supplied identity) the spec §35 explicitly warns against ("Không nên phụ thuộc hoàn toàn vào role gửi từ frontend").

**Scope**
- Router-level fixes (`app/study_rooms/routers/study_room_router.py`): host-derived-from-token on create/update/start/end; caller-derived-from-token on join/leave (client can no longer self-assign `host`/`moderator` via `join`); access checks on `list_members`/`list_moderation`; moderator-authority checks (`can_manage_room`) plus host-protection (a moderator cannot act on the host) on `KICK`/`MUTE`/`UNMUTE`; self-service-only enforcement (`RAISE_HAND`/`LOWER_HAND` can only target yourself) on moderation logging.
- New permission helpers: `is_room_host`, `is_room_moderator`, `can_manage_room`, `can_join_room` (`app/core/permissions.py`).
- `StudyRoomsService.create` now takes `host_id` as an explicit parameter rather than trusting `data.host_id`.
- RLS fix: `room_moderation_select` policy's `srm.room_id = srm.room_id` tautology corrected to `srm.room_id = room_moderation_actions.room_id` (migration 007).

**Out of Scope**
- The equivalent, still-unfixed class of bug in Groups/Channels/Forum/Resources/Notifications/Profiles — those are separate Ready tasks below (this PR fixed Study Rooms only).

**Acceptance Criteria**
- [x] Only the host can update/start/end a room.
- [x] `join`/`leave` always act on the authenticated caller, never a client-supplied `user_id`; joining always yields `PARTICIPANT` (no self-assigned host/moderator).
- [x] `list_members`/`list_moderation` require room access.
- [x] `KICK`/`MUTE`/`UNMUTE` require host/moderator authority over that specific room; a moderator cannot act on the host.
- [x] `RAISE_HAND`/`LOWER_HAND` can only target the caller's own membership.
- [x] `room_moderation_select` RLS policy no longer contains the `srm.room_id = srm.room_id` tautology (verified live by `007_verify.sql`).

**Dependencies**
"Implement Study Rooms"; "Add Study Room chat and authorization".

**Related Code**
- `app/core/permissions.py`, `app/study_rooms/routers/study_room_router.py`, `app/study_rooms/services/study_room_service.py`
- `docs/db/migrations/007_preflight.sql`, `007_fix_room_moderation_select_policy.sql`, `007_verify.sql`, `007_rollback.sql`
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §37

**Evidence**
- PR #17 (`fix/study-room-authorization`, merged as `1ee6910`), containing:
  - `1250d29` "fix: secure study room authorization" — 4 files changed, 694 insertions across `app/core/permissions.py`, `app/study_rooms/routers/study_room_router.py`, `app/study_rooms/services/study_room_service.py`, `tests/test_study_rooms.py` (+581 lines of tests).
  - `89b7f0f`/`536a091` "chore: track database migrations and update docs" — commits migration 007 (and 001-006) to git for the first time.
  - `f016fce` "docs: update project README".
- `docs/db/migrations/README.md` and `STUDY_PLATFORM_DATABASE_SPEC.md` §37 both confirm 007 "✅ Applied live" and re-verified 2026-08-16.

**Testing**
- Existing: `tests/test_study_rooms.py` grew by 581 lines in this change, covering host-only actions, self-vs-other join/leave, moderator-vs-host protection, and self-service raise/lower-hand.

**Risks / Edge Cases**
None identified — this task closes the risks it was opened to address.

**Notes**
This PR is the direct precedent and template for the "Secure ... authorization" Ready tasks below: same bug class (client-supplied identity, missing router-level checks), same fix shape (derive identity from `get_current_user`, add helper predicates to `app/core/permissions.py`, add matching tests in the same change).

---

### Track SQL migration files & runbook in version control

**Status:** Done
**Type:** Chore
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Committed the full set of previously-untracked, manually-run SQL migrations (001-007, each with `preflight`/`verify`/`rollback` companions where applicable) plus a run-order-and-status `README.md` into `docs/db/migrations/`.

**Motivation**
Migrations 001-007 had all been run directly against the live Supabase project via the SQL editor/`psql` (per the project's documented workflow — nothing is auto-applied by the app or CI), but the `.sql` files themselves were not yet tracked in git; this commit made the applied-vs-not-applied status and exact SQL auditable and reviewable.

**Scope**
- Commit `docs/db/migrations/001_enable_realtime_messages.sql` through `007_fix_room_moderation_select_policy.sql` and all `_preflight.sql`/`_verify.sql`/`_rollback.sql` companions.
- Add `docs/db/migrations/README.md` documenting run order and live-status per migration.
- Update `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` to match.

**Out of Scope**
- Any migration tooling/automation (e.g. a migration runner) — these remain plain SQL files run manually, by design (per README §Database and Migrations).

**Acceptance Criteria**
- [x] All 7 migrations and their companion scripts are present under `docs/db/migrations/`.
- [x] `docs/db/migrations/README.md` accurately reflects live status as of 2026-08-16.

**Dependencies**
None identified.

**Related Code**
- `docs/db/migrations/` (all files)
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md`

**Evidence**
- `89b7f0f` "chore: track database migrations and update docs" adds all 22 files (2942 insertions) in one commit — `.gitignore` previously excluded them (removed in the same commit).
- `536a091` (same message) removes the now-redundant `.gitignore` entries.

**Testing**
Not applicable (documentation/tracking only, no executable change).

**Risks / Edge Cases**
None identified.

---

### Scaffold React frontend shell (routing, layout, Home, placeholder auth)

**Status:** Done
**Type:** Infrastructure
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Bootstrapped the `frontend/` React + TypeScript + Vite application: base layout (`Header`/`Footer`/`Layout`), client-side routing (`react-router-dom`), a `HomePage`, and placeholder `LoginPage`/`RegisterPage` screens.

**Motivation**
The backend was built API-first with no UI; this is the starting point for a frontend client, per README ("a separate `frontend/` directory holds an in-progress React client").

**Scope**
- Vite/TypeScript project setup (`215f12e`).
- Base layout components (`Header`, `Footer`, `Layout`) and route table (`a34b1f1`, `1674e7b`).
- `HomePage`, `LoginPage`, `RegisterPage` (`1674e7b`).
- `ProtectedRoute` gate based on `localStorage.getItem('auth')`.

**Out of Scope**
- Real authentication — `LoginPage`/`RegisterPage` only set `localStorage.setItem('auth', 'true')` on submit; there is no call to Supabase Auth or the backend at all. See "Integrate Supabase Auth into frontend" (Ready).
- Feature pages (forum, study groups/rooms, account, goals) — see their own tasks below.

**Acceptance Criteria**
- [x] The app renders a Home page inside a shared Header/Footer layout.
- [x] `/login` and `/register` render forms; submitting `/login` flips the `ProtectedRoute` gate.
- [x] Protected routes redirect to `/login` when the `auth` flag is unset.

**Dependencies**
None identified.

**Related Code**
- `frontend/src/main.tsx`, `frontend/src/routes/index.tsx`
- `frontend/src/components/layout/{Header,Footer,Layout}.tsx`
- `frontend/src/pages/{HomePage,LoginPage,RegisterPage}.tsx`
- `frontend/src/hooks/useAuth.ts`

**Evidence**
- `215f12e` "start react fe" — initial Vite scaffold.
- `a34b1f1` "test chatbot makes fe" — layout/header/footer, `StudyGroupDetail`/`StudyGroups` stubs.
- `1674e7b` "feat: diễn đàn fe" — adds `HomePage`, `LoginPage`, `RegisterPage`, route table.
- Confirmed by reading `frontend/src/pages/LoginPage.tsx` and `frontend/src/hooks/useAuth.ts`: both are purely `localStorage`-based, no network calls.
- `frontend/package.json` has no HTTP client (`axios`/`fetch` wrapper) or `@supabase/supabase-js` dependency at all — corroborates that this is intentionally not wired up yet.

**Testing**
No automated frontend tests exist anywhere in the repository (no test runner configured in `frontend/package.json`).

**Risks / Edge Cases**
None identified for the scaffold itself — the "not real auth" gap is tracked as its own Ready task rather than a defect here, since this was evidently built mock-first by design (matches the README's "Current Development Status").

---

### Build mock Study Groups & Study Room frontend UI

**Status:** Done
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Frontend-only, mock-data pages for browsing/opening a study group (`StudyGroups`, `StudyGroupDetail`) and a full in-room meeting UI (`StudyRoom`) with mock video-call controls (mute/camera/screen-share/raise-hand), a whiteboard mode, and a chat/participants/notes side panel — all driven by local component state and hard-coded mock participant data, with no backend or LiveKit connection. The title deliberately says "mock" — nothing here calls the real Group/Study-Room/LiveKit APIs; see "Integrate Study Group & Channel APIs into frontend", "Integrate Study Room APIs into frontend", and "Integrate LiveKit video meetings into the Study Room frontend" for the work that makes this real.

**Motivation**
This is the frontend counterpart to the backend Study Room + LiveKit meeting-token work, giving the group/room concepts a UI even though it isn't wired to the real backend yet.

**Scope**
- `StudyGroups` (group list) and `StudyGroupDetail` pages.
- `StudyRoom` meeting page: media controls, whiteboard tools, timer, participant list, right-panel tabs (chat/participants/notes) — all local mock state.

**Out of Scope**
- Any real data: no backend group/channel/study-room API calls, no real LiveKit connection (`livekit-client` is not a dependency), no real chat (no Supabase Realtime subscription). See "Integrate Study Group & Channel APIs into frontend", "Integrate Study Room APIs into frontend", "Integrate messaging with backend and Supabase Realtime", and "Integrate LiveKit video meetings into the Study Room frontend" (all future tasks).

**Acceptance Criteria**
- [x] `/groups` lists groups; `/groups/:id` shows a group detail page.
- [x] `/room/:id` renders a full meeting UI with working local toggle state for mute/camera/screen-share/hand-raise and a whiteboard mode switch.

**Dependencies**
"Scaffold React frontend shell".

**Related Code**
- `frontend/src/pages/StudyGroup/StudyGroups.tsx`, `frontend/src/pages/StudyGroup/StudyGroupDetail.tsx`, `frontend/src/pages/StudyGroup/StudyRoom.tsx`

**Evidence**
- `a34b1f1` "test chatbot makes fe" — initial `StudyGroupDetail`/`StudyGroups` stubs.
- `9487c95` "feat: Giao diện chi tiết cuộc họp" ("meeting detail UI") — adds the 840-line `StudyRoom.tsx` meeting UI.
- `4f21e4a` "feat: fix study room" — moves pages into `pages/StudyGroup/`, adds `Aim.tsx`, rewrites `StudyGroupDetail.tsx` (388 lines).
- Reading `frontend/src/pages/StudyGroup/StudyRoom.tsx`: `participants` is a hard-coded local array (`useState`), the session timer is a `setInterval` counting up from a fixed seed — confirms mock-only implementation.
- `frontend/package.json` has no `livekit-client` (or any WebRTC/video SDK) dependency.

**Testing**
No automated tests exist for these pages.

**Risks / Edge Cases**
None identified — intentionally a UI-first mock, per the pattern established across the whole frontend.

---

### Build mock Forum frontend UI (browse/post/comment)

**Status:** Done
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Forum browsing UI backed entirely by an in-memory mock API layer: a 3-column layout (category sidebar, post feed, right-hand widgets), post creation modal, post detail route, and threaded comments — refactored from an initial monolithic page into modular `pages/forum/{components,hooks,api,types}` structure. The title deliberately says "mock" — `forum.api.ts` never calls the real backend; see "Integrate Forum APIs into frontend" for the work that makes this real.

**Motivation**
Frontend counterpart to the backend Forum domain, built against a hand-authored mock API layer while the real backend integration is pending.

**Scope**
- Initial forum page and post/comment UI (part of `1674e7b`).
- Modular refactor into `components/`, `hooks/` (`useForumPosts`, `useComments`, `usePostActions`), `lib/forum.api.ts`, `types/forum.types.ts` (`debf24d`).
- 3-column scroll layout, right sidebar widgets, `/forum/post/:id` detail route (`44493f7`).
- Shared UI kit used across the app: `Avatar`, `Button`, `Dropdown`, `Modal`, `SearchInput`, `Hover` (`debf24d`).

**Out of Scope**
- Real backend data — `frontend/src/pages/forum/lib/forum.api.ts` is entirely in-memory mock data (`MOCK_CATEGORIES`, `MOCK_POSTS`, `MOCK_COMMENTS`, `MOCK_AUTHORS`) with `Promise.resolve(...)`-wrapped functions; it never calls `/forum/*`. See "Integrate Forum APIs into frontend" (Ready).

**Acceptance Criteria**
- [x] The forum page lists posts by category, with like/comment counts.
- [x] A logged-in user (per the mock `useAuth`) can create a post, like/unlike, and comment/reply.
- [x] `/forum/post/:id` renders a single post with its full comment thread.

**Dependencies**
"Scaffold React frontend shell".

**Related Code**
- `frontend/src/pages/forum/ForumPage.tsx`, `frontend/src/pages/forum/ForumPostDetail.tsx`
- `frontend/src/pages/forum/components/*`, `frontend/src/pages/forum/hooks/*`, `frontend/src/pages/forum/lib/forum.api.ts`, `frontend/src/pages/forum/types/forum.types.ts`
- `frontend/src/components/ui/*`

**Evidence**
- `1674e7b` "feat: diễn đàn fe" ("forum FE") — initial `HomePage` forum section.
- `debf24d` "feat(forum): refactor forum structure into modular page, hooks, api, and ui components" (merged via PR #16) — full modular split, adds `forum.api.ts` with mock data.
- `44493f7` "feat(forum): add 3-column scroll layout, right sidebar widgets, and post detail route" — layout/detail-route work.
- Reading `frontend/src/pages/forum/lib/forum.api.ts`: confirmed 100% mock, zero `fetch`/`axios` calls; `frontend/package.json` has no HTTP client dependency at all (repo-wide `grep` for `fetch(`, `axios`, `supabase` across `frontend/src` returns no matches).

**Testing**
No automated tests exist for the forum frontend.

**Risks / Edge Cases**
None identified — the DTO shapes in `forum.types.ts` already mirror the backend's `ForumPostResponse`/`CommentResponse`, which should ease the eventual swap to real API calls.

---

### Build mock Account Settings & Goal ("Aim") frontend UI

**Status:** Done
**Type:** Feature
**Priority:** Low
**Estimate:** Needs review
**Suggested GitHub item:** Draft task

**Description**
Two standalone, frontend-only, mock/local-state pages: `AccountSettingsPage` (user settings form) and `AimPage` (a personal study-goal tracking page), both reachable from the header nav and gated behind `ProtectedRoute`. The title deliberately says "mock" — neither page persists anything to the backend (there is no `/profiles` PUT call from `AccountSettingsPage`, and no backend concept of a "goal"/"aim" at all — see Risks).

**Motivation**
Product-side additions to round out the logged-in experience; neither corresponds to an existing backend domain (there is no `goals`/`aims` table or API in the backend, per `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md`).

**Scope**
- `AccountSettingsPage` (`4163568`).
- `AimPage` (introduced as part of `4f21e4a`, then substantially trimmed in `3374c63`, from 3702 to 168 lines).

**Out of Scope**
- Any backend persistence — both pages are local-state-only UI with no corresponding API.

**Acceptance Criteria**
- [x] `/settings` renders an account settings form.
- [x] `/aim` renders a goal-tracking page.

**Dependencies**
"Scaffold React frontend shell".

**Related Code**
- `frontend/src/pages/AccountSettingsPage.tsx`, `frontend/src/pages/Aim.tsx`

**Evidence**
- `4163568` "add account page".
- `9487c95`/`4f21e4a` introduce `Aim.tsx`; `3374c63` "Update goal page" cuts it from 3702 to 168 lines (net rewrite/simplification).

**Testing**
No automated tests exist for these pages.

**Risks / Edge Cases**
- There is no backend concept of a "goal"/"aim" at all — if this feature is meant to persist, it needs a new backend domain (not proposed here; no repository evidence indicates one is planned, per the "only propose future tasks with evidence" rule).

---

## Ready

### Remove plaintext test credentials from repository

**Status:** Ready
**Type:** Bug
**Priority:** Urgent
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
`docs/acc test login` is a tracked file containing five plaintext Supabase Auth test-account email/password pairs. Git history shows this same credential file — under different paths and with at least two different plaintext passwords over time — has been continuously present in tracked history since the project's very first authentication-related commit, and it is still tracked today with no `.gitignore` protection against re-committing this class of file.

**Motivation**
Anyone with read access to the repository (including its full clone history, which is exposed regardless of the current file's content) has working credentials for real Supabase Auth accounts on the specific project referenced by `.env.example`. This is a direct, no-exploit-required path to an authenticated session, unlike the authorization-gap tasks elsewhere in this catalog, which require calling a specific under-guarded endpoint. Because the file is tracked and has been continuously present since the first authentication commit, it meets this catalog's own bar for `Priority: Urgent`.

**Scope**
- Remove the plaintext credentials from `docs/acc test login`; replace with placeholder/example documentation of the *shape* of test accounts needed (e.g. "create N test users named user1@study.local.. yourself, with your own password — never commit the password") rather than real values.
- Add a `.gitignore` rule covering this file (and equivalent local-only credential files) so it cannot be re-committed by accident — today `.gitignore` only excludes `.env`/`.env.*`, nothing matches `docs/acc test login` or similar paths.
- Rotate or revoke the affected Supabase Auth accounts' passwords. **This is a manual action outside the repository** that cannot be performed or verified from static analysis — see Risks.
- Point contributors at the pattern the codebase already uses safely for this exact need: `tests/integration/conftest.py` reads `SUPABASE_TEST_USER_A/B/OUTSIDER_EMAIL`/`PASSWORD` from environment variables (never committed) — `docs/acc test login` is redundant with this safe pattern besides being unsafe.

**Out of Scope**
- Purging the credential values from git history (e.g. `git filter-repo`/BFG). History rewriting is a destructive, team-wide-coordination action (rewrites commit hashes, requires a force-push, and requires every collaborator to re-clone) — not proposed here without an explicit decision from the repository owner; rotating the credentials is the safe, non-destructive mitigation and should happen regardless of whether history is ever rewritten.
- Rotating any other secret in the repository. Incidental finding, noted for awareness only: `.env.example` (a file meant to hold placeholders) currently contains a real-looking `LIVEKIT_API_KEY` value rather than a placeholder — its paired `LIVEKIT_API_SECRET` is blank, so this is lower severity (a key ID alone is not usable without its secret) and is not folded into this task's remediation.

**Acceptance Criteria**
- [ ] `docs/acc test login` (or its replacement) no longer contains any real password.
- [ ] A `.gitignore` rule prevents this class of file from being committed again.
- [ ] The affected Supabase Auth test accounts' passwords have been rotated, or the accounts have been deleted/recreated (confirmed manually, outside the repository).
- [ ] Repository documentation tells contributors where real local test credentials belong instead (`.env`, already gitignored).

**Dependencies**
None identified.

**Related Code**
- `docs/acc test login`
- `.gitignore`
- `.env.example` (as the pattern this file should follow: template with placeholders, never real values)
- `tests/integration/conftest.py` (the existing safe pattern for equivalent test-account needs)

**Evidence**
- `git ls-files | grep "acc test login"` confirms `docs/acc test login` is currently tracked.
- History: created as `docs/db/mock account` (`cd0613b`, 2026-08-10) → renamed to `docs/db/test acc` (`b374ce3`, same day) → password changed in place (`5a7013f`, 2026-08-11 — the diff shows the file's password value was replaced with a different plaintext value, i.e. a second distinct password has also been exposed in history) → old path deleted (`d664e10`) and equivalent content re-added at the current path `docs/acc test login` (`d925105`), both 2026-08-14. The file has been continuously present in tracked history, under one path or another, since the project's first authentication commit.
- `.env.example`'s `DATABASE_URL`/`SUPABASE_URL` reference a specific, real Supabase project (`rncoptajwdtueqvtbgkw.supabase.co`) — circumstantial evidence (not proof) that these test accounts were created against a real, reachable project rather than a purely local/offline stub. Whether the accounts are still active cannot be confirmed from the repository alone (see Risks).
- `tests/integration/conftest.py` uses a *different*, already-safe mechanism (`SUPABASE_TEST_USER_A/B/OUTSIDER_EMAIL`/`PASSWORD` environment variables, never committed) for its own Supabase-backed tests, confirming the project already has a working safe pattern for this exact need.
- `.gitignore` contains only `.env`/`.env.*` (plus standard Python/Node/IDE ignores) — no rule matches `docs/acc test login` or any similar credential-shaped filename.

**Testing**
Not a traditional test — verify by confirming (a) `git ls-files`/`git status` no longer shows a plaintext-credential file being tracked, and (b) a fresh `git clone` of the *current* branch does not expose a usable password. Note this cannot undo exposure already present in historical commits without a history rewrite, which is explicitly out of scope pending an owner decision (see Out of Scope).

**Risks / Edge Cases**
- **Whether these credentials are still valid on a live Supabase project cannot be determined from the repository alone.** This requires manual verification — or rotation regardless of current validity, which is the safer default — by whoever holds Supabase project admin access. Do not assume the accounts are inert just because the project may be a dev/test environment; treat rotation as required, not optional, given the file has been exposed since the project's first commit.
- Rewriting git history to purge the values retroactively is a coordinated, destructive operation and is deliberately not proposed as part of this task (see Out of Scope); rotating the credentials themselves is the actionable, non-destructive mitigation this task should deliver.

**Notes**
Same underlying lesson as the "Secure ... authorization" tasks elsewhere in this catalog (trust nothing that isn't verified) — here the mitigation is credential hygiene rather than an authorization check.

---

### Secure Group & Channel authorization

**Status:** Ready
**Type:** Bug
**Priority:** Urgent
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
`app/groups/routers/group_router.py` and `app/channels/routers/channel_router.py` have **zero** authentication or authorization on any endpoint — no `get_current_user` dependency is used anywhere in either file. Any caller can create/update/delete any group, add/remove members, promote/demote roles (including granting themselves `owner`), ban/unban members, and create/delete channels or private-channel membership, by supplying arbitrary UUIDs.

**Motivation**
This is the exact bug class already fixed for Study Rooms in "Secure Study Room authorization" (`1250d29`, PR #17) — client-supplied identity trusted with no server-side verification — but for the top-level entity (`groups`) that every other domain (channels, study rooms, resources) nests under, making it the highest-impact instance of the pattern.

**Scope**
Every rule below is stated as a concrete, citable decision rather than left open — see Evidence for the exact spec citations.
- Require `get_current_user` on every mutating group/channel/membership endpoint; identity is always taken from the token, never from a request body/query field.
- `POST /groups`: owner is always the authenticated caller, not client-supplied `owner_id` (mirrors the `1250d29` fix to `StudyRoomsService.create`).
- `PUT/DELETE /groups/{id}` (edit group info / delete group): **owner-only**. Spec §6.1 lists "Sửa thông tin group" ("edit group info") and "Xóa group" ("delete group") explicitly under Owner's capabilities; §6.2's parallel Moderator capability list omits both — the two lists are presented side by side in the same section specifically to delineate what each role can/can't do, so the omission is meaningful, not an oversight.
- `PUT /groups/{id}/members/{user_id}/role` (Member ↔ Moderator role change): **owner-only**. Spec §6.2 states this as an explicit recommendation: "Owner: có quyền thay đổi role Member <-> Moderator. Moderator: không có quyền thay đổi role" ("Owner may change role Member↔Moderator. Moderator has no role-change permission").
- `POST/PUT/DELETE /channels*` (create/update/delete a channel): **owner OR moderator**. Spec §6.1 and §6.2 both explicitly list "Quản lý channel" ("manage channels") — this is one of the few capabilities granted to both roles.
- `POST /groups/{id}/members` (adding **another** user directly, e.g. a private-group invite) and `PUT /groups/{id}/members/{user_id}/status` (ban/reactivate/remove a member): **owner OR moderator**, per §6.2's "Quản lý thành viên" ("manage members") — **except** see Risks below for a narrower, deliberately-conservative interim rule on the ban/kick sub-case, and **except** the public-group self-join case immediately below, which needs no owner/moderator authority at all.
- A user may always self-serve `leave` (their own membership `status` → `left`) regardless of role — this needs no citation; it is definitionally always safe to let someone remove themselves.
- A user may always self-serve **join**: `POST /groups/{id}/members` succeeds with no owner/moderator authority when the target group has `is_public = true` (the schema default), provided `user_id` is forced to the authenticated caller and `role` is forced to `member` (never client-supplied). This is not a guess — `Group.is_public`/`Group.invite_code` (`app/groups/entities/group_entity.py`) and `GroupsService.list_public()` (already the default behind `GET /groups`'s `public_only=true`) only make sense if a self-service join path exists, and spec §1.1 lists "Tham gia nhóm" ("join a group") as a first-class user action alongside "Tạo nhóm học" ("create a group"). Joining a **private** (`is_public = false`) group via `invite_code` is explicitly left open by spec §42 ("Private group join bằng invite code hay phải approve?") — do not guess at that flow here; until it's decided, joining a private group continues to require an owner/moderator to add the member directly.
- Reuse the already-existing `is_active_group_member`/`is_group_manager` helpers in `app/core/permissions.py` rather than duplicating logic.

**Out of Scope**
- Forum, Resources, Notifications, Profiles authorization — separate tasks below.
- Group ownership transfer — spec §42 explicitly lists "Owner transfer ownership có được hỗ trợ không?" ("is ownership transfer supported?") as a question the team has not yet answered; no such endpoint exists today and none is proposed here.
- Any new group/channel features.

**Acceptance Criteria**
- [ ] A non-member cannot read/write a private group's channels or membership.
- [ ] Only the group owner can update group info, delete the group, or change a member's role between `member` and `moderator`.
- [ ] `groups.owner_id` is always the authenticated caller on creation; the DTO's `owner_id`/channel's `created_by` fields are ignored as an identity source in favor of the token.
- [ ] An owner or moderator can create/update/delete channels within their group; a non-member/non-manager cannot.
- [ ] Banning/reactivating a member requires owner authority (see Risks for why this is deliberately stricter than "owner or moderator" pending a product decision).
- [ ] A user can self-join a group where `is_public = true` via `POST /groups/{id}/members` with no owner/moderator authority, always as `role = member` and always for themselves (never a client-supplied `user_id`); joining a private group still requires owner/moderator authority.
- [ ] Full endpoint test coverage exists, matching the depth of `tests/test_study_rooms.py`.

**Dependencies**
"Implement Group & Channel management (CRUD + membership)" (Done); "Implement Supabase authentication" (Done); reuses `app/core/permissions.py` helpers built for "Refactor messaging to Conversation architecture".

**Related Code**
- `app/groups/routers/group_router.py`, `app/groups/services/group_service.py`, `app/groups/dto/group_dto.py`
- `app/channels/routers/channel_router.py`, `app/channels/services/channel_service.py`, `app/channels/dto/channel_dto.py`
- `app/core/permissions.py` (`is_active_group_member`, `is_group_manager`)
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §6.1, §6.2, §35, §42

**Evidence**
- `grep -n "get_current_user" app` returns matches only in `study_rooms`, `auth`, `messages`, `attachments`, `conversations` — never in `groups` or `channels`.
- `app/groups/dto/group_dto.py`: `GroupCreate.owner_id` is a plain client-supplied field, consumed directly by `GroupsService.create` with no cross-check.
- `app/channels/dto/channel_dto.py`: `ChannelCreate.created_by` is likewise client-supplied and unchecked.
- Direct precedent: `1250d29` fixed the identical pattern (`StudyRoomCreate.host_id`) in Study Rooms one commit before this gap was identified.
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §6.1/§6.2 role capability lists and §42's open-questions checklist, both quoted above, are the basis for every rule in Scope.
- `app/groups/entities/group_entity.py`: `Group.is_public` (default `true`) and `Group.invite_code` columns, plus `GroupsService.list_public()` (`app/groups/services/group_service.py`, already wired to `GET /groups`'s default `public_only=true` in `group_router.py`) — confirm a self-service public-group-join path is an intended, partially-built feature, not an invented one.
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §1.1 lists "Tham gia nhóm" as a core user action; the Group fields table documents `invite_code`/`is_public` explicitly ("Group công khai hay riêng tư" — "public or private group").
- `frontend/src/pages/StudyGroup/StudyGroups.tsx` renders a "Tham gia" (Join) button on every group card today with no `onClick` handler — confirming the frontend already assumes a self-join action exists to wire up (see "Integrate Study Group & Channel APIs into frontend").

**Testing**
No `tests/test_groups.py` or `tests/test_channels.py` exist today (confirmed absent from `tests/`); this task should add both, at a similar depth to `tests/test_study_rooms.py` (which grew to 722 lines covering exactly this class of check).

**Risks / Edge Cases**
- **Unresolved by spec — do not guess beyond the conservative default below.** Spec §42 explicitly lists three group-related questions the team has not yet agreed on: "Moderator có được kick member không?" ("can a moderator kick a member?"), "Moderator có được ban member không?" ("...ban a member?"), and "Moderator có được promote moderator khác không?" ("...promote another moderator?"). Because a real `moderator` role already exists in the schema (`GroupMemberRole.MODERATOR`), this is a genuine, currently-undecided product/security question — not something derivable from evidence. This task's Acceptance Criteria therefore deliberately restrict member-status changes (ban/kick) to **owner-only** as the strictest safe default, not as the final word: it closes the severe, unambiguous bug (today *anyone*, including non-members, can do this) without pre-empting the team's eventual decision on whether moderators should also get this power. Loosening it to include moderators is a follow-up, not a blocker for this task.
- Similarly, spec §42 asks "Ai có quyền add user vào private channel?" ("who may add a user to a private channel?") without an answer. This task's private-channel-membership rule (owner/moderator, per the general "Quản lý channel" grant) is the narrowest viable reading, not a confirmed final policy — flag for revisit once the team answers §42.
- The self-join rule above is deliberately scoped to **public** groups only; joining a private group by `invite_code` is a genuinely open product question (spec §42) and is not resolved by this task — do not extend self-join to private groups without a separate decision on how `invite_code` should be validated/consumed.
- Existing seed/test data created via the currently-open endpoints (if any live data exists) may have `owner_id`/`created_by` values that don't correspond to real memberships; verify before tightening.

**Notes**
Bundle this the same way PR #17 did: permission helpers + router guards + service changes + tests, in one PR.

---

### Secure Forum authorization

**Status:** Ready
**Type:** Bug
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
`app/forum/routers/forum_router.py` has no authentication anywhere. Any caller can create forum categories, and — critically — edit or delete any other user's post or comment, or like/unlike a post/comment as any user, simply by passing an `author_id`/`user_id` that doesn't match themselves.

**Motivation**
Same bug class as the Study Room fix (`1250d29`): client-supplied identity trusted with no ownership check. The forum is a site-wide, publicly-visible surface, so unauthorized edit/delete is directly user-facing and easy to exploit.

**Scope**
- Require `get_current_user` on `create_post`/`update_post`/`delete_post`/`create_comment`/`update_comment`/`delete_comment`/`like_post`/`unlike_post`/`like_comment`/`unlike_comment`.
- `author_id`/`user_id` always come from the authenticated caller, never the request body/query — this needs no policy citation, since there is no scenario in which acting as another user is ever correct.
- `update_post`/`delete_post`/`update_comment`/`delete_comment` require the caller to be the original author. This is the only viable rule, not merely the preferred one: the forum domain has no moderator/admin role or field anywhere in the schema (`app/forum/entities/forum_entity.py`, spec §25-29) to grant broader authority to even if desired, so "author-only" is what's actually implementable today, and it directly mirrors the sender-only pattern already shipped for messages (`app/messages/routers/message_router.py::update_message`).

**Out of Scope**
- Forum **category** create/update/delete authorization. No admin/staff/moderator concept exists anywhere in the schema for categories to hang an access rule off — this is a genuine gap, not a restatement of the obvious, and inventing a role here would be exactly the kind of unsupported policy call this catalog avoids. Leave `POST/PUT/DELETE /forum/categories` out of this task; it needs its own decision (e.g. a new `is_staff` flag, or making categories migration-seeded only with no mutating endpoint at all) before it can be secured. Track separately once that decision exists — not enough evidence to define that task yet.
- Automatic notification creation on like/comment/reply — separate task ("Wire up automatic notification creation for domain events").
- Groups/Channels, Resources, Notifications, Profiles authorization — separate tasks.

**Acceptance Criteria**
- [ ] A user cannot edit or delete another user's post or comment.
- [ ] Likes are always attributed to the authenticated caller.
- [ ] Full endpoint test coverage exists (no `tests/test_forum.py` currently exists).

**Dependencies**
"Implement Forum (categories, posts, comments, replies, likes)" (Done); "Implement Supabase authentication" (Done).

**Related Code**
- `app/forum/routers/forum_router.py`, `app/forum/services/forum_service.py`, `app/forum/dto/forum_dto.py`

**Evidence**
- `grep -n "get_current_user" app/forum` returns no matches.
- Reading `app/forum/routers/forum_router.py` in full confirms every endpoint accepts identity (`author_id` on `ForumPostCreate`/`CommentCreate`, `user_id` query param on the four like/unlike endpoints) with no cross-check against a verified caller, and `update_post`/`delete_post`/`update_comment`/`delete_comment` perform no ownership check at all — any caller can mutate any post/comment.
- `app/forum/entities/forum_entity.py` and spec §25-29 confirm no role/permission field exists on `ForumCategory`, `ForumPost`, or `Comment` — supporting the "author-only is the only implementable rule today" reasoning above.

**Testing**
No `tests/test_forum.py` exists; add one covering ownership checks on edit/delete and identity-forgery rejection on likes, at a similar depth to `tests/test_study_rooms.py`.

**Risks / Edge Cases**
- Category authorization is explicitly excluded (see Out of Scope) rather than guessed at — do not let this task's PR quietly add auth to category endpoints without a separate, deliberate decision first.

---

### Secure Resource authorization

**Status:** Ready
**Type:** Bug
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
`app/resources/routers/resource_router.py` has no authentication anywhere. Any caller can create/update/delete resource folders and files (metadata) in any group, and `ResourceCreate.uploader_id` is a client-supplied, unverified field.

**Motivation**
Same bug class as the Study Room fix. Resource folders/files are group-scoped (per spec §23-24); without a group-membership check, any caller can enumerate or tamper with any group's document metadata.

**Scope**
- Require `get_current_user` on every mutating resource/folder endpoint; identity always derived from the token, never from `ResourceCreate.uploader_id`/`ResourceFolderCreate.created_by`.
- Creating/reading/updating/deleting folders/files requires active membership in `group_id` — this mirrors the identical, already-implemented membership gate used for channels (`can_access_channel`) and study rooms (`can_access_room`); resources have no reason to be a structural exception, so this part needs no further decision.
- A member may update/delete a folder/file **they created**. This alone already closes the current bug (anyone, including non-members, can currently tamper with any group's resources).

**Out of Scope**
- Whether a group **owner or moderator** may also manage (update/delete) resources uploaded by *other* members. Spec §6.1 lists "Quản lý tài liệu" ("manage materials") under Owner's capabilities, but the phrase is generic enough (could mean "organizes the resource area" as much as "can delete anyone's individual upload") that treating it as a firm citation for a specific access-control rule would be over-reading it — unlike the group-update/delete or channel-management rules in "Secure Group & Channel authorization", where the owner/moderator capability lists are unambiguous and directly on-point. Leave cross-member resource management out of this task; revisit once the product clarifies what "manage materials" is meant to cover.
- Actual signed-upload-URL flow for resources (resources currently accept a plain `file_path` string with no Storage-existence check, unlike `app/attachments/`) — tracked separately as "Implement Resource file upload/download with Supabase Storage" (Ready), since it's independent, larger-scoped work (a new Storage bucket + signed-URL service) than an authorization fix. This task should land first or alongside it so the new upload flow can reuse whatever caller-identity/ownership checks land here for path namespacing.

**Acceptance Criteria**
- [ ] A non-member of a group cannot create/read/update/delete that group's resource folders/files.
- [ ] `uploader_id`/`created_by` always match the authenticated caller on creation.
- [ ] A member can update/delete a folder/file they created themselves.
- [ ] Full endpoint test coverage exists (no `tests/test_resources.py` currently exists).

**Dependencies**
"Implement Resource folders & files (metadata CRUD)" (Done); "Implement Supabase authentication" (Done).

**Related Code**
- `app/resources/routers/resource_router.py`, `app/resources/services/resource_service.py`, `app/resources/dto/resource_dto.py`
- `app/core/permissions.py` (`is_active_group_member`)
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §6.1, §23-24

**Evidence**
- `grep -n "get_current_user" app/resources` returns no matches.
- `app/resources/dto/resource_dto.py`: `ResourceCreate.uploader_id` and `ResourceFolderCreate.created_by` are both plain client-supplied UUID fields with no cross-check anywhere in `resource_service.py`/`resource_router.py`.

**Testing**
No `tests/test_resources.py` exists; add one covering group-membership gating and uploader/creator-identity enforcement.

**Risks / Edge Cases**
- Cross-member resource management authority is deliberately excluded from this task's scope (see Out of Scope) rather than resolved by analogy — do not extend delete/update rights beyond the uploader without a separate, explicit decision.

---

### Secure Profile authorization

**Status:** Ready
**Type:** Bug
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
`app/profiles/routers/profile_router.py` has no authentication anywhere. Any caller can update or delete **any** user's profile (including `username`, `display_name`, `avatar_url`, `bio`) by supplying that user's `profile_id`.

**Motivation**
Of all the unauthenticated domains, this one directly enables impersonation/defacement of another user's identity as displayed throughout the rest of the app (messages, forum posts, group membership all reference `profiles`) — arguably the most user-visible impact of the whole "no auth" pattern.

**Scope**
- Require `get_current_user` on `update_profile`/`delete_profile`.
- A caller may only update/delete their own profile (`profile_id == current_user.id`) — unambiguous; there is no legitimate case for editing or deleting someone else's profile.
- `POST /profiles` (create): restrict to `data.id == current_user.id`. This is not a genuinely open policy question — there is no evidenced legitimate reason for user A to be able to create a profile row under user B's UUID, and doing so would let A squat on/pre-empt B's profile before B ever registers it themselves.

**Out of Scope**
- `GET /profiles`/`GET /profiles/{id}` — reads are presumably meant to stay public (profiles are referenced all over the UI); not proposed for restriction without stronger evidence.

**Acceptance Criteria**
- [ ] A user cannot update or delete another user's profile.
- [ ] A user cannot create a profile row under another user's `id`.
- [ ] Full endpoint test coverage exists (no `tests/test_profiles.py` currently exists).

**Dependencies**
"Implement Supabase authentication" (Done).

**Related Code**
- `app/profiles/routers/profile_router.py`, `app/profiles/services/profile_service.py`, `app/profiles/dto/profile_dto.py`

**Evidence**
- `grep -n "get_current_user" app/profiles` returns no matches.
- Reading `app/profiles/routers/profile_router.py` in full: `update_profile`/`delete_profile` take only a path `profile_id` with no identity check against the caller; `create_profile` accepts `ProfileCreate.id` as a plain client-supplied field.

**Testing**
No `tests/test_profiles.py` exists; add one covering self-only create/update/delete.

**Risks / Edge Cases**
None identified — this task's scope is fully resolvable without any open product decision.

---

### Secure Notification authorization

**Status:** Ready
**Type:** Bug
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
`app/notifications/routers/notification_router.py` has no authentication anywhere. Any caller can list another user's notifications (`GET /notifications?user_id=...`), read/mark-read/delete any notification by ID, and create a notification claiming to be for/from anyone.

**Motivation**
Same bug class as the other domains, here manifesting mainly as an information-disclosure risk (another user's notification feed reveals who liked/commented/invited them, and to what) plus low-severity tampering (marking someone else's notifications read, or deleting them) — lower blast radius than the write-heavy domains above, hence Medium rather than High/Urgent.

**Scope**
- Require `get_current_user` on `list_notifications`/`get_notification`/`mark_read`/`delete_notification`.
- `list_notifications` always scopes to the authenticated caller (drop the `user_id` query parameter as a caller-supplied identity source).
- `get_notification`/`mark_read`/`delete_notification` verify the notification's `user_id` matches the caller.

**Out of Scope**
- `POST /notifications` (create) authorization. This is a genuinely open question, not a restatement of the obvious: unlike every other domain in this catalog, a notification's whole purpose is that `actor_id` (who did something) and `user_id` (who is notified) are usually two *different* people — so the "caller must match the identity field" rule that resolves every other task in this catalog does not straightforwardly apply here, and no repository evidence (spec or code) says who should be allowed to create a notification on someone else's behalf. **This is now concretely scoped, not just deferred:** "Wire up automatic notification creation for domain events" (Backlog) has been expanded to explicitly resolve `POST /notifications`'s fate (remove it, restrict it, or make it internal-only) once domain services create notifications internally — see that task's Scope. Do not guess at this rule here.
- Automatic notification creation from real domain events — separate task below.

**Acceptance Criteria**
- [ ] A user cannot list, read, mark-read, or delete another user's notifications.
- [ ] Full endpoint test coverage exists (no `tests/test_notifications.py` currently exists).

**Dependencies**
"Implement Notifications backend (CRUD)" (Done); "Implement Supabase authentication" (Done).

**Related Code**
- `app/notifications/routers/notification_router.py`, `app/notifications/services/notification_service.py`, `app/notifications/dto/notification_dto.py`

**Evidence**
- `grep -n "get_current_user" app/notifications` returns no matches.
- Reading `app/notifications/routers/notification_router.py` in full: `list_notifications` takes `user_id` as a plain query parameter; `get_notification`/`mark_read`/`delete_notification` take only a `notification_id` path parameter with no ownership check.

**Testing**
No `tests/test_notifications.py` exists; add one covering per-user scoping.

**Risks / Edge Cases**
- `POST /notifications` is left exactly as it is today (unauthenticated) by this task, since securing it requires a policy decision this task deliberately does not make (see Out of Scope) — do not read the read/mark-read/delete fixes here as having also addressed creation.

---

### Implement Resource file upload/download with Supabase Storage

**Status:** Ready
**Type:** Feature
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Add a real file-storage flow for the Resources domain: a private `group-resources` Supabase Storage bucket, signed upload/download URLs analogous to `app/attachments/`, and server-side verification that a `Resource.file_path` a client claims to have created actually exists in Storage. Today `ResourceCreate.file_path`/`file_type`/`file_size` are plain client-supplied strings/numbers with no relationship to any real object.

**Motivation**
`docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §41 (MVP Scope) explicitly lists "Upload" and "Download" as required Resources functionality, alongside Folder/Delete (already implemented) — this is spec'd MVP scope, not a nice-to-have, and it is currently entirely missing. §40 (File Storage Architecture) explicitly recommends a `group-resources` Storage bucket, distinct from the already-implemented `message-attachments` bucket. Without this, "Implement Resource folders & files (metadata CRUD)" only ever produces metadata rows pointing at files that were never verified to exist — Resources cannot be genuinely usable end-to-end no matter how much frontend or authorization work is layered on top of it.

**Scope**
- Create a private `group-resources` Storage bucket via a new tracked migration (`docs/db/migrations/008_create_group_resources_bucket.sql`), following the exact pattern of `003_create_message_attachments_bucket.sql`.
- Add a resources storage service with `build_object_path(group_id, folder_id, user_id, file_name)`, `create_signed_upload_url`, `create_signed_download_url`, `object_exists`, `delete_object` — mirroring `app/attachments/services/attachment_service.py`.
- `POST /resources/files` (or a new `POST /resources/files/upload-url` request step) verifies the referenced object actually exists in the `group-resources` bucket before creating the metadata row (mirrors the `object_exists` gating already used for message attachments).
- `GET /resources/files/{file_id}/download-url` issuing a short-lived signed download URL, mirroring `GET /messages/{id}/attachment-url`.
- Deleting a resource file also deletes the underlying Storage object.

**Out of Scope**
- Frontend wiring of the upload/download UI — see "Integrate Resources into frontend" (separate Ready task).
- Avatar (`avatars` bucket) or forum-image (`forum-images` bucket) storage — spec §40 lists these as separate future buckets; the avatar bucket is scoped instead under "Integrate Profile / Account Settings API into frontend", and no repository evidence supports a `forum-images` task yet.
- Resource authorization (group-membership gating, uploader-only update/delete) — covered by "Secure Resource authorization" (Ready); this task should land alongside or after it, since signed-upload issuance needs the caller's verified identity the same way `AttachmentsService.build_object_path` does.

**Acceptance Criteria**
- [ ] A private `group-resources` bucket exists (migration tracked and applied, matching the `003`/`007` pattern).
- [ ] A client can request a signed upload URL, upload directly to Storage, and only then create the `Resource` metadata row — the row is rejected if the object doesn't actually exist in Storage.
- [ ] A client can request a signed, short-lived download URL for an existing resource file.
- [ ] Deleting a resource file also removes the Storage object.
- [ ] Test coverage mirrors `tests/test_attachments.py`'s depth for the new signed-URL flow.

**Dependencies**
"Implement Resource folders & files (metadata CRUD)" (Done); "Secure Resource authorization" (Ready — shares the caller-identity requirement for path namespacing).

**Related Code**
- `app/resources/routers/resource_router.py`, `app/resources/services/resource_service.py`, `app/resources/dto/resource_dto.py`
- `app/attachments/services/attachment_service.py` (the pattern to mirror)
- (new) `docs/db/migrations/008_create_group_resources_bucket.sql` + `_preflight.sql`/`_verify.sql`/`_rollback.sql` companions, matching the `003`/`007` convention
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §24, §40, §41

**Evidence**
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §41 "Resources" lists `Folder`, `Upload`, `Download`, `Delete` as MVP scope — only `Folder`/`Delete` (as generic metadata CRUD) exist today.
- §40 "File Storage Architecture" recommends four buckets (`avatars`, `group-resources`, `message-attachments`, `forum-images`); only `message-attachments` exists (`docs/db/migrations/003_create_message_attachments_bucket.sql`) — confirmed via `grep` across `docs/db/migrations/*.sql` for `bucket`, which returns no `group-resources` reference anywhere.
- `app/resources/dto/resource_dto.py`: `ResourceCreate.file_path`/`file_type`/`file_size` are plain, unvalidated client-supplied fields — no call anywhere in `resource_service.py` to any Storage API (unlike `app/attachments/services/attachment_service.py`, which every message-attachment path goes through).
- The "Implement Resource folders & files (metadata CRUD)" (Done) task's own Risks section already flags this exact gap: "`ResourceCreate.file_path` is an unvalidated string — nothing confirms the referenced object actually exists in storage, unlike the attachment flow's `object_exists` check."

**Testing**
No `tests/test_resources.py` exists yet (see "Secure Resource authorization"); this task's signed-URL flow should be covered in the same new test file, at a depth similar to `tests/test_attachments.py`.

**Risks / Edge Cases**
- Namespacing the object path by `group_id`/`folder_id`/`user_id` (mirroring `build_object_path`) is necessary so "Secure Resource authorization"'s group-membership and uploader-identity checks can be enforced the same structural way attachments already are — sequence this task's path-naming scheme to match whatever "Secure Resource authorization" lands with, to avoid rework.

---

### Set up frontend API client and backend CORS

**Status:** Ready
**Type:** Infrastructure
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Add the shared plumbing every other frontend-integration task in this catalog depends on: CORS support on the backend, a small HTTP client wrapper on the frontend that attaches the bearer token, and environment configuration for the API base URL and Supabase URL/anon key. This is deliberately the first, most foundational slice of what used to be a single oversized "integrate the frontend" task.

**Motivation**
The frontend currently has no way to reach the backend at all — no HTTP client dependency, and the backend has no CORS middleware — so every other integration task (auth, groups/channels, study rooms, forum, messaging) needs this in place first. Splitting it out keeps it small, independently reviewable, and unblocks every downstream task without forcing them to duplicate this setup.

**Scope**
- Add `CORSMiddleware` to `app/main.py`, scoped to explicit allowed origins (the Vite dev origin, `http://localhost:5173`, and any future deployed frontend origin) — not a wildcard `allow_origins=["*"]`, since credentials/bearer tokens are involved.
- Add a small frontend HTTP client module (`fetch` or `axios` wrapper) under `frontend/src` that reads the API base URL from env and attaches `Authorization: Bearer <token>` when a session exists (the token itself comes from "Integrate Supabase Auth into frontend" — this task only needs to prove the header gets attached when *some* token is present).
- Add `frontend/.env.example` (does not exist today) documenting `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` as placeholders, mirroring the root `.env.example`'s "template, never real values" convention.

**Out of Scope**
- Any specific domain's data-fetching hooks/wiring (Groups/Channels, Study Rooms, Forum, Messaging — separate tasks below).
- Supabase Auth session management itself (separate task: "Integrate Supabase Auth into frontend") — this task proves the plumbing works, not that a real session exists yet.

**Acceptance Criteria**
- [ ] A request from the Vite dev server (`localhost:5173`) to the backend (`localhost:8000`) succeeds without a CORS error in the browser console — provable today using an already-public endpoint (e.g. `GET /forum/categories`, which requires no auth), so this task does not need to wait on any other frontend task.
- [ ] The frontend HTTP client attaches a bearer token to outgoing requests when a session is present, and omits it when not.
- [ ] `frontend/.env.example` documents every frontend env var with placeholder values.

**Dependencies**
None identified — deliberately proven using an already-public backend endpoint so this task doesn't wait on Auth or any other frontend task.

**Related Code**
- `app/main.py` (CORS)
- `frontend/package.json`
- (new) `frontend/.env.example`
- (new) an HTTP client module under `frontend/src`

**Evidence**
- `app/main.py`: no `CORSMiddleware` registered — a browser-based frontend on a different origin/port cannot currently call the API at all.
- `grep -riE "fetch\(|axios|supabase|localhost:8000|import\.meta\.env|livekit" frontend/src` returns **no matches at all** — confirmed zero network integration anywhere in the frontend today.
- `frontend/package.json` dependencies: only `lucide-react`, `react`, `react-dom`, `react-router-dom` — no HTTP client, no `@supabase/supabase-js`.
- `frontend/` has no `.env`/`.env.example` at all today (only the root one exists).

**Testing**
No frontend test runner exists yet; verify manually via the browser network tab (no CORS error; `Authorization` header present/absent as expected).

**Risks / Edge Cases**
Must not combine a wildcard CORS origin with `allow_credentials=True` — scope allowed origins explicitly.

---

### Integrate Supabase Auth into frontend

**Status:** Ready
**Type:** Feature
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Replace the frontend's `localStorage`-flag login/register with real Supabase Auth sign-in/sign-up via `@supabase/supabase-js`, and verify the resulting session against the backend's `GET /auth/me`.

**Motivation**
`LoginPage`/`RegisterPage` currently just set `localStorage.setItem('auth', 'true')` — there is no real identity behind "being logged in" on the frontend at all, even though the backend's Supabase-Auth-based identity system ("Implement Supabase authentication", Done) has been ready since 2026-08-10. Every other domain-integration task in this catalog needs a real, verifiable session to attach to its requests.

**Scope**
- Add the `@supabase/supabase-js` dependency.
- `LoginPage`/`RegisterPage` call Supabase Auth sign-in/sign-up instead of setting `localStorage.setItem('auth', 'true')`.
- `useAuth.ts` reflects a real Supabase session (e.g. via `onAuthStateChange`/`getSession()`) instead of `localStorage.getItem('auth')`.
- `ProtectedRoute` (`frontend/src/routes/index.tsx`) gates on the real session instead of the `localStorage` flag.
- Attach the Supabase access token to backend requests via the API client from "Set up frontend API client and backend CORS", and confirm it resolves correctly against `GET /auth/me`.
- Sign-out flow.

**Out of Scope**
- Any backend endpoint other than `GET /auth/me` (every other domain is its own task below).
- Password reset — `LoginPage.tsx`'s "Quên mật khẩu?" ("forgot password") link is currently a dead `Link to="#"`; no evidence a reset flow is scoped, so it isn't proposed as part of this task or a new one.

**Acceptance Criteria**
- [ ] A user can register a new account (or sign in with an existing seed account) via Supabase Auth from the frontend, with no `localStorage.setItem('auth', ...)` call anywhere in the flow.
- [ ] `useAuth()` reflects real Supabase session state (logged in/out) app-wide.
- [ ] `GET /auth/me`, called through the Task 2 API client with the session's access token, resolves to the same user UUID the frontend's Supabase session reports.
- [ ] Logging out clears the session and `ProtectedRoute` redirects to `/login` again.

**Dependencies**
"Set up frontend API client and backend CORS" (needs the API client + CORS to call `GET /auth/me`); "Implement Supabase authentication" (Done, backend).

**Related Code**
- `frontend/src/hooks/useAuth.ts`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx`, `frontend/src/routes/index.tsx` (`ProtectedRoute`)
- `app/auth/routers/auth_router.py` (`GET /auth/me`)

**Evidence**
- `frontend/src/hooks/useAuth.ts`: `isLoggedIn = localStorage.getItem('auth') === 'true'`, confirmed no real session anywhere.
- `frontend/src/pages/LoginPage.tsx`: `handleLogin` only calls `localStorage.setItem('auth', 'true')` then navigates — no network call.
- `frontend/package.json` has no `@supabase/supabase-js` dependency.

**Testing**
No frontend test runner exists yet; verify manually (sign in/out, confirm `GET /auth/me` round-trip).

**Risks / Edge Cases**
The dead "forgot password" link (see Out of Scope) will remain non-functional after this task; flagged for awareness, not proposed as new scope without stronger evidence of intent.

---

### Integrate Profile / Account Settings API into frontend

**Status:** Ready
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Wire `AccountSettingsPage` to the real `/profiles/{id}` backend endpoints: load the authenticated user's actual `username`/`display_name`/`avatar_url`/`bio` on mount, and persist edits via `PUT /profiles/{id}` instead of the current local-only `saved` boolean toggle.

**Motivation**
The backend Profile domain has existed since the very first backend commit and is explicitly listed under Authentication in `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §41 MVP Scope ("Login, Register, Profile"). Every other domain with a real backend counterpart has (or, after this catalog's other Ready tasks, will have) a frontend-integration task — Profile is the one exception: neither "Secure Profile authorization" (which only secures the backend) nor "Build mock Account Settings & Goal ('Aim') frontend UI" (Done, explicitly mock) nor any other catalog task wires `AccountSettingsPage` to real data. Without this task, the account settings screen remains permanently non-functional even after every other Ready/Backlog task is completed.

**Scope**
- On mount, fetch the authenticated user's profile via `GET /profiles/{id}` (using the ID from the real Supabase session established by "Integrate Supabase Auth into frontend") and populate the "Thông tin cá nhân" (personal info) fields from it.
- "Lưu thay đổi" ("Save changes") calls `PUT /profiles/{id}` with the edited `username`/`display_name`/`bio`, and reflects the backend's success/failure instead of unconditionally setting `saved = true`.
- Avatar upload ("Thay đổi" button): add a minimal signed-upload flow for a new private `avatars` Storage bucket (mirroring `app/attachments/`'s pattern at a much smaller scope — single bucket, single object per user), so `avatar_url` can be updated to a real uploaded image. This is a small, evidenced backend addition (`docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §40 explicitly lists `avatars` as one of four intended Storage buckets), not a new product feature.

**Out of Scope**
- The "Email", "Trường đại học / Tổ chức" (university/organization), "Xác thực hai yếu tố" (2FA), and "Ngôn ngữ" (language) fields currently rendered in `AccountSettingsPage` — none of these have any backing column on `Profile` (`app/profiles/entities/profile_entity.py` has only `id`/`username`/`display_name`/`avatar_url`/`bio`) or anywhere else in the schema, and no spec section proposes adding them. Email specifically belongs to Supabase Auth, not the `profiles` table, and updating it is an Auth operation, not a Profile one. Leave these fields either visually disabled/removed or explicitly marked "not yet supported" — do not fabricate backend support for them in this task.
- Password change ("Mật khẩu › Thay đổi") — no reset/change-password flow exists anywhere in this catalog's scope (see "Integrate Supabase Auth into frontend"'s Risks re: the dead "forgot password" link); not proposed here either.
- Deleting one's own account/profile via the UI — `DELETE /profiles/{id}` exists and is secured by "Secure Profile authorization", but no UI control for it exists in `AccountSettingsPage` today and none is evidenced as intended; not proposed here.

**Acceptance Criteria**
- [ ] `/settings` loads and displays the authenticated user's real `username`/`display_name`/`bio` from `GET /profiles/{id}`, not hard-coded values ("Alex Rivers" etc.).
- [ ] Editing and saving persists via `PUT /profiles/{id}` and survives a page reload.
- [ ] Uploading a new avatar image updates `avatar_url` via a real signed-upload flow to the `avatars` bucket and is visible after reload.
- [ ] Fields with no backend support (email/university/2FA/language) are not silently presented as if they save successfully.

**Dependencies**
"Integrate Supabase Auth into frontend" (Ready — needs the real session to know which profile to load); "Set up frontend API client and backend CORS" (Ready); "Secure Profile authorization" (Ready — this task should call the self-only-secured version of `PUT /profiles/{id}`, not the currently-open one).

**Related Code**
- `frontend/src/pages/AccountSettingsPage.tsx`
- `app/profiles/routers/profile_router.py`, `app/profiles/dto/profile_dto.py`
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §40, §41

**Evidence**
- Reading `frontend/src/pages/AccountSettingsPage.tsx` in full: every field uses `defaultValue`/local `useState`; "Lưu thay đổi" only calls `setSaved(true)`, no network call anywhere in the file.
- `app/profiles/entities/profile_entity.py`: confirmed schema has no `email`/`university`/`two_factor`/`language` columns — those four rendered fields have no backend counterpart at all.
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §41 lists "Profile" as required MVP scope under Authentication; no existing Ready/Backlog task wired it to the frontend prior to this audit.
- `grep -riE "fetch\(|axios|/profiles" frontend/src` returns no matches — confirmed zero integration today.

**Testing**
No frontend test runner exists yet; verify manually (load real profile, edit, reload, confirm persistence; upload an avatar, confirm it renders after reload).

**Risks / Edge Cases**
- If "Secure Profile authorization" hasn't landed yet, this task can still be built and manually tested against the currently-open `PUT /profiles/{id}` — but should be re-verified once that task lands, since the self-only restriction changes what a caller can pass.

---

### Integrate Study Group & Channel APIs into frontend

**Status:** Ready
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Wire the `StudyGroups`/`StudyGroupDetail` pages to the real `/groups` and `/channels` backend endpoints instead of local/mock state.

**Motivation**
The backend Group/Channel domain ("Implement Group & Channel management", Done) has no frontend consumer at all — `StudyGroups.tsx`/`StudyGroupDetail.tsx` render whatever mock/local state was scaffolded when the pages were first built (see "Build mock Study Groups & Study Room frontend UI").

**Scope**
- List groups from `GET /groups`.
- Create a group via `POST /groups`; view group detail via `GET /groups/{id}`.
- List channels for a group via `GET /channels?group_id=...`.
- Wire the "Tham gia" (Join) button on `StudyGroups.tsx`'s group cards to the self-join case of `POST /groups/{id}/members` (added to "Secure Group & Channel authorization"'s Scope) for groups where `is_public = true`.

**Out of Scope**
- Study Room-specific data (separate task: "Integrate Study Room APIs into frontend").
- Chat/messages inside a channel (separate task: "Integrate messaging with backend and Supabase Realtime").
- Fixing the backend's current lack of Group/Channel authorization ("Secure Group & Channel authorization", separate Ready task) — this task wires up whatever the backend currently accepts/returns; it does not change backend behavior. Note this means, until that task lands, the frontend will be able to call these endpoints as literally any identity — treat that as a backend concern, not something to work around here.

**Acceptance Criteria**
- [ ] `/groups` renders real groups from the backend, not mock data.
- [ ] `/groups/:id` renders real group details and the real channel list for that group.
- [ ] Creating a group via the frontend persists via `POST /groups` and is visible on reload.
- [ ] Clicking "Tham gia" on a public group's card calls the real self-join endpoint and the user's membership is visible on the group detail page afterward.

**Dependencies**
"Integrate Supabase Auth into frontend"; "Set up frontend API client and backend CORS"; "Implement Group & Channel management (CRUD + membership)" (Done, backend); "Secure Group & Channel authorization" (Ready — the public-group self-join rule this task's Join button relies on is defined there).

**Related Code**
- `frontend/src/pages/StudyGroup/StudyGroups.tsx`, `frontend/src/pages/StudyGroup/StudyGroupDetail.tsx`
- `app/groups/routers/group_router.py`, `app/channels/routers/channel_router.py`

**Evidence**
- Reading `frontend/src/pages/StudyGroup/StudyGroups.tsx`/`StudyGroupDetail.tsx`: no network calls; `grep` for `fetch(`/`axios`/`supabase` across `frontend/src` returns no matches anywhere.
- `frontend/src/pages/StudyGroup/StudyGroups.tsx` renders a "Tham gia" (Join) button on every group card with no `onClick` handler — confirmed via reading the file.

**Testing**
No frontend test runner exists yet; verify manually against the running backend.

**Risks / Edge Cases**
None identified beyond the noted backend-authorization sequencing awareness.

---

### Integrate Study Room APIs into frontend

**Status:** Ready
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Wire study room list/detail/join/leave/start/end to the real `/study-rooms` endpoints, and replace `StudyRoom.tsx`'s hard-coded mock participant list and fake session timer with real membership data.

**Motivation**
The backend Study Room domain, including its authorization fix ("Implement Study Rooms" and "Secure Study Room authorization", both Done), has no frontend consumer — the meeting page's participant list, host badges, and hand-raise state are all local `useState` mock data (see "Build mock Study Groups & Study Room frontend UI").

**Scope**
- Wire room list/detail/join/leave/start/end to `/study-rooms/*`.
- Replace `StudyRoom.tsx`'s mock `participants` array with real data from `GET /study-rooms/{id}/members`.
- Handle the 403s the now-secured backend endpoints correctly return (e.g. only the host can start/end a room) by reflecting that in the UI rather than assuming every action always succeeds.
- Wire the meeting page's mute/kick/raise-hand controls to `POST /study-rooms/{room_id}/moderation` (action types `mute`/`unmute`/`kick`/`raise_hand`/`lower_hand`) and member role changes to `PUT /study-rooms/{room_id}/members/{user_id}/role`, instead of leaving them as local-only toggle state. Reflect the backend's authority checks in the UI (e.g. a moderator cannot act on the host, per "Secure Study Room authorization", Done).

**Out of Scope**
- LiveKit video connection itself (separate Backlog task: "Integrate LiveKit video meetings into the Study Room frontend").
- In-room chat (separate task: "Integrate messaging with backend and Supabase Realtime").

**Acceptance Criteria**
- [ ] Study room list/detail reflect real backend data.
- [ ] Joining/leaving a room via the frontend calls the real `POST /study-rooms/{id}/join`/`leave` endpoints and updates UI state accordingly.
- [ ] The meeting page's participant list reflects real `study_room_members` data instead of the hard-coded mock array.
- [ ] A non-host attempting a host-only action (start/end/update) sees the backend's 403 reflected in the UI, not a silent failure.
- [ ] Mute/kick/raise-hand controls in the meeting UI call the real moderation endpoint and persist (visible to other members/on reload), not just local component state.

**Dependencies**
"Integrate Supabase Auth into frontend"; "Set up frontend API client and backend CORS"; "Implement Study Rooms" (Done, backend); "Secure Study Room authorization" (Done, backend — the endpoints this task calls already enforce host-only/participant checks).

**Related Code**
- `frontend/src/pages/StudyGroup/StudyRoom.tsx`, `frontend/src/pages/StudyGroup/StudyGroupDetail.tsx`
- `app/study_rooms/routers/study_room_router.py`

**Evidence**
- Reading `frontend/src/pages/StudyGroup/StudyRoom.tsx`: `participants` is a hard-coded local array (`useState`); the session timer is a `setInterval` counting up from a fixed seed — confirms mock-only implementation, no backend calls.
- `app/study_rooms/routers/study_room_router.py` exposes `POST`/`GET /{room_id}/moderation` (fully authorized, per "Secure Study Room authorization", Done) with no frontend caller anywhere in `frontend/src` (confirmed via repo-wide grep) — the meeting UI's mute/raise-hand buttons in `StudyRoom.tsx` are local `useState` toggles only.

**Testing**
No frontend test runner exists yet; verify manually against the running backend, including a non-host attempting a host-only action and a moderator attempting to act on the host.

**Risks / Edge Cases**
None identified beyond the noted 403-handling requirement.

---

### Integrate Resources into frontend

**Status:** Ready
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Build a real folder/file browser for a group's Resources, replacing the hard-coded "Tài liệu đính kèm" (attached files) list in `StudyGroupDetail.tsx` with data from `GET /resources/folders`/`GET /resources/files`, and wire uploading/downloading through the signed-URL flow added by "Implement Resource file upload/download with Supabase Storage".

**Motivation**
The Resources domain (folders + files) is Done on the backend and is explicitly listed as core MVP scope (§41), but has no frontend consumer of any kind today — not even a read-only, metadata-only browse view. `StudyGroupDetail.tsx`'s sidebar renders two entirely fake, hard-coded file entries ("Bai_Giang_Chuong_1.pdf", "Ghi_chep_nhom.docx") that are not backed by any state or click handler. Without this task, Resources would remain completely unreachable through normal product usage even after every other catalog task is completed.

**Scope**
- List a group's folders/files via `GET /resources/folders?group_id=...`/`GET /resources/files?group_id=...`, including subfolder navigation via `GET /resources/folders/{folder_id}/subfolders`.
- Create a folder via `POST /resources/folders`.
- Upload a file through the signed-upload-URL flow from "Implement Resource file upload/download with Supabase Storage"; download via the signed-download-URL endpoint.
- Delete a folder/file the current user created (reflecting "Secure Resource authorization"'s uploader/creator-only rule).

**Out of Scope**
- The backend signed-URL flow itself — see "Implement Resource file upload/download with Supabase Storage" (this task consumes it, doesn't build it).
- Cross-member resource management (owner/moderator managing another member's upload) — explicitly out of scope of "Secure Resource authorization" pending a product decision; this task should not build UI for a permission that doesn't exist yet.

**Acceptance Criteria**
- [ ] A group's real folders/files render in `StudyGroupDetail.tsx` (or an equivalent Resources view), replacing the two hard-coded mock entries.
- [ ] A user can create a folder, upload a file into it, and download a file they or another member uploaded (subject to group membership).
- [ ] A user can delete a file/folder they created; attempting to delete another member's file is rejected by the backend and reflected in the UI.

**Dependencies**
"Implement Resource file upload/download with Supabase Storage" (Ready); "Secure Resource authorization" (Ready); "Integrate Study Group & Channel APIs into frontend" (Ready — needs a real group to scope to); "Integrate Supabase Auth into frontend"; "Set up frontend API client and backend CORS".

**Related Code**
- `frontend/src/pages/StudyGroup/StudyGroupDetail.tsx`
- `app/resources/routers/resource_router.py`

**Evidence**
- Reading `frontend/src/pages/StudyGroup/StudyGroupDetail.tsx`: the "Tài liệu đính kèm" list is two static `<div>` blocks with hard-coded filenames/sizes and no `onClick` handler wired to anything real, no `useState`/props driving it, and no reference anywhere in the file to `/resources`.
- `grep -riE "resource" frontend/src` confirms the only two hits are this decorative sidebar and an unrelated mock chat message mentioning "tài liệu chương 4" in `StudyGroupDetail.tsx`'s hard-coded messages array.
- No existing Ready/Backlog task in this catalog mentioned `/resources` prior to this audit.

**Testing**
No frontend test runner exists yet; verify manually against the running backend (folder create, file upload, download, delete-permission enforcement).

**Risks / Edge Cases**
None identified beyond the noted dependency sequencing.

---

### Integrate Forum APIs into frontend

**Status:** Ready
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Replace `forum.api.ts`'s in-memory mock implementation with real calls to `/forum/*` (categories, posts, comments, likes), keeping the existing DTO-shaped mapping functions (`mapPost`/`mapComment`) since they already mirror the backend's response shapes.

**Motivation**
The backend Forum domain ("Implement Forum...", Done) has no frontend consumer — `forum.api.ts` is entirely `MOCK_*` in-memory data (see "Build mock Forum frontend UI").

**Scope**
- `getCategories`/`getPosts`/`createPost`/`likePost`/`unlikePost`/`getComments`/`createComment`/`likeComment`/`unlikeComment` in `forum.api.ts` call the real `/forum/*` endpoints instead of mutating `MOCK_POSTS`/`MOCK_COMMENTS`.
- Remove `MOCK_CATEGORIES`/`MOCK_POSTS`/`MOCK_COMMENTS`/`MOCK_AUTHORS` once real data is wired.

**Out of Scope**
- Fixing the backend's current lack of Forum authorization ("Secure Forum authorization", separate Ready task) — this task wires up whatever the backend currently accepts/returns.
- Category management UI — the backend has no resolved authorization policy for who may manage categories (see "Secure Forum authorization"'s Out of Scope), so building a frontend for it is premature.

**Acceptance Criteria**
- [ ] The forum page loads real categories/posts from `/forum/categories`/`/forum/posts` instead of `MOCK_*` data.
- [ ] Creating a post/comment/like calls the real backend and persists across a page reload.
- [ ] `MOCK_CATEGORIES`/`MOCK_POSTS`/`MOCK_COMMENTS`/`MOCK_AUTHORS` no longer exist in `forum.api.ts`.

**Dependencies**
"Integrate Supabase Auth into frontend"; "Set up frontend API client and backend CORS"; "Implement Forum (categories, posts, comments, replies, likes)" (Done, backend).

**Related Code**
- `frontend/src/pages/forum/lib/forum.api.ts`, `frontend/src/pages/forum/hooks/*`, `frontend/src/pages/forum/ForumPage.tsx`, `frontend/src/pages/forum/ForumPostDetail.tsx`
- `app/forum/routers/forum_router.py`

**Evidence**
- Reading `frontend/src/pages/forum/lib/forum.api.ts` in full: confirmed 100% mock, zero `fetch`/`axios` calls, `Promise.resolve(...)`-wrapped mock mutations.

**Testing**
No frontend test runner exists yet; verify manually against the running backend.

**Risks / Edge Cases**
`ForumPostResponse`/`CommentResponse` only carry `author_id`, not a display name — `forum.api.ts` currently resolves author names via a hard-coded `MOCK_AUTHORS` map (confirmed by reading the file). Real integration needs a separate profile lookup (`GET /profiles/{id}`) per author; this is a direct, evidenced consequence of the existing DTO shape, not a new feature — account for it in this task's estimate.

---

### Integrate messaging with backend and Supabase Realtime

**Status:** Ready
**Type:** Feature
**Priority:** High
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Build real chat UI wired to `GET/POST /conversations/{id}/messages` for channel/room/direct conversations, with live updates via a Supabase Realtime subscription on `messages`, per the README's documented Realtime architecture, plus attachment upload/download through the signed-URL flow.

**Motivation**
This is the frontend counterpart to the largest, most-tested slice of backend work in this catalog ("Refactor messaging to Conversation architecture", "Add Study Room chat and authorization", "Add Direct Messaging", all Done) — none of it has a frontend consumer today. `StudyRoom.tsx`'s "chat" tab is mock UI with no message-list component at all, so this task involves building new UI, not just wiring an existing one.

**Scope**
- Render real message history via `GET /conversations/{id}/messages` (cursor-paginated) for channel, room, and direct conversations.
- Send messages via `POST /conversations/{id}/messages`.
- Subscribe to Supabase Realtime (Postgres Changes on `messages`) for live updates without polling.
- Attachments: upload via `POST /conversations/{id}/attachments/upload-url` + direct-to-Storage upload, and download via `GET /messages/{id}/attachment-url`.
- Direct messages: start/list DMs via `POST`/`GET /conversations/direct`.

**Out of Scope**
- LiveKit video (separate Backlog task).
- Fixing backend authorization — unlike Groups/Forum/Resources/Notifications/Profiles, the messaging/conversation endpoints are already fully authenticated and authorized ("Refactor messaging to Conversation architecture" §Evidence), so there is no backend gap to work around here.

**Acceptance Criteria**
- [ ] A channel/room/direct conversation renders real message history with cursor pagination.
- [ ] Sending a message persists via the backend and appears for other connected clients via Supabase Realtime without a page reload.
- [ ] File attachments can be uploaded and downloaded through the signed-URL flow.
- [ ] Starting a DM via `POST /conversations/direct` reuses the same conversation on repeat calls, matching the backend's idempotent get-or-create behavior.

**Dependencies**
"Integrate Supabase Auth into frontend"; "Set up frontend API client and backend CORS"; "Integrate Study Group & Channel APIs into frontend" (channel chat needs a real channel to attach to); "Integrate Study Room APIs into frontend" (room chat needs a real room); "Refactor messaging to Conversation architecture", "Add Study Room chat and authorization", "Add Direct Messaging (1:1 DM)" (all Done, backend).

**Related Code**
- `app/messages/`, `app/conversations/`, `app/attachments/`
- Frontend: no existing chat UI component beyond the mock "chat" tab in `frontend/src/pages/StudyGroup/StudyRoom.tsx` — this task requires new frontend code, not just rewiring.

**Evidence**
- README §Realtime documents the intended `FastAPI (history) + Supabase Realtime (live updates)` split this task implements.
- `grep -riE "fetch\(|axios|supabase|realtime" frontend/src` returns no matches — confirmed no chat UI or Realtime subscription exists today.

**Testing**
No frontend test runner exists yet; manual two-browser verification is the realistic minimum for confirming realtime delivery.

**Risks / Edge Cases**
- Supabase Realtime requires the frontend to hold its own Supabase client session (from "Integrate Supabase Auth into frontend") with a JWT that Postgres RLS can evaluate directly — per the README, "the frontend connects to Realtime directly with its own Supabase access token." This is a second, independent authorization path from the backend's own checks; both need to keep working.
- This task is larger than the others in this split (message list + send + realtime + attachments + DM), kept as one unit since chat only becomes useful once all of history, sending, and live updates work together; if it proves too large for one PR in practice, splitting attachments and/or DM initiation into follow-up PRs is a reasonable implementation-time call, not a change to this catalog.

---

### Integrate Notifications into frontend

**Status:** Ready
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Build a real notification UI: a dropdown/panel off the header bell icon showing the authenticated user's notifications (`GET /notifications`), an unread-count badge, mark-as-read (`PUT /notifications/{id}/read`), and navigation to the relevant post/comment/group where applicable.

**Motivation**
`frontend/src/components/layout/Header.tsx` already renders a `<Bell>` icon next to the settings/avatar controls for logged-in users, but it has no `onClick`, no dropdown, no unread badge, and no state of any kind — a dead control implying a feature that was never built. The backend Notification CRUD ("Implement Notifications backend (CRUD)", Done) has zero frontend consumer today, and no existing Ready/Backlog task proposed building one — "Wire up automatic notification creation for domain events" (Backlog) only makes the backend feed meaningful, it doesn't render it anywhere.

**Scope**
- Fetch the authenticated user's notifications via `GET /notifications` (once "Secure Notification authorization" scopes it to the caller) with `unread_only` for the badge count.
- Render a dropdown/panel from the header bell with the notification list (type, actor, relative time, read/unread state).
- Mark-as-read on open/click via `PUT /notifications/{id}/read`.
- Where a notification carries a `post_id`/`comment_id`/`group_id`, clicking it navigates to that content (e.g. `/forum/post/:id`, `/groups/:id`).

**Out of Scope**
- Realtime push delivery of new notifications (e.g. via Supabase Realtime) — spec §42 leaves this as an open, undecided question; this task is poll/fetch-on-open only, not push.
- Automatic notification creation from domain events — separate Backlog task ("Wire up automatic notification creation for domain events"); this task will initially show a sparse/empty feed until that lands, which is expected and not a defect of this task.
- Deleting notifications from the UI — `DELETE /notifications/{id}` exists but no UI affordance for it is evidenced as needed for MVP; not proposed here.

**Acceptance Criteria**
- [ ] The header bell shows an unread-count badge reflecting `GET /notifications?unread_only=true`.
- [ ] Clicking the bell opens a panel listing the user's real notifications, not a no-op.
- [ ] Opening/clicking a notification marks it read via the backend and updates the badge.
- [ ] A notification with a `post_id` navigates to that forum post; one with a `group_id` navigates to that group.

**Dependencies**
"Secure Notification authorization" (Ready — this task should consume the caller-scoped version of `GET /notifications`, not the currently-open `user_id`-query-param version); "Integrate Supabase Auth into frontend"; "Set up frontend API client and backend CORS". Soft dependency (not blocking): "Wire up automatic notification creation for domain events" (Backlog) — needed for the feed to have realistic content, but this task can be built and tested against manually-created notifications in the meantime.

**Related Code**
- `frontend/src/components/layout/Header.tsx` (the existing, currently inert `<Bell>` icon)
- `app/notifications/routers/notification_router.py`

**Evidence**
- Reading `frontend/src/components/layout/Header.tsx`: `<Bell size={20} color="#444651" />` is rendered inside a `<div style={{cursor: 'pointer'}}>` with no `onClick` prop and no surrounding state — confirmed inert.
- `grep -riE "notif" frontend/src` returns no matches anywhere in the frontend — confirmed zero notification UI, hook, or API client exists.
- No existing Ready/Backlog task in this catalog proposed frontend notification UI prior to this audit.

**Testing**
No frontend test runner exists yet; verify manually by creating notifications via `POST /notifications` (or once "Wire up automatic notification creation for domain events" lands, via real actions) and confirming they appear/mark-read correctly.

**Risks / Edge Cases**
- Until "Wire up automatic notification creation for domain events" lands, the panel will mostly be empty in normal usage — don't mistake that for a bug in this task once built.

---

### Fix broken links to deleted integration docs

**Status:** Ready
**Type:** Documentation
**Priority:** Low
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
`docs/db/migrations/README.md` links to `../../chat-integration.md` and `../../storage-integration.md` (i.e. `docs/chat-integration.md`, `docs/storage-integration.md`), and `scripts/realtime_integration_check.py`'s docstring references `docs/chat-integration.md` for required env vars — but all five integration docs that once existed (`docs/chat-integration.md`, `docs/storage-integration.md`, `docs/auth-integration.md`, `docs/forum-integration.md`, `docs/group-integration.md`) were deleted in commit `40a600e` ("iii") and never replaced.

**Motivation**
These are currently dead links in otherwise-carefully-maintained documentation; low severity, but easy to fix and worth cleaning up before the frontend-integration tasks above ("Set up frontend API client and backend CORS" onward) start — those tasks' contributors will likely go looking for exactly this integration guidance.

**Scope**
- Either restore updated versions of the deleted docs (if their content is still relevant post-Conversation-refactor) or remove the dangling references in `docs/db/migrations/README.md` and `scripts/realtime_integration_check.py`.

**Out of Scope**
- Writing brand-new, comprehensive integration guides from scratch — only fix what's evidenced as broken; if full guides are wanted, that's better scoped alongside the frontend-integration tasks above once real integration work clarifies what needs documenting.

**Acceptance Criteria**
- [ ] `docs/db/migrations/README.md` contains no links to non-existent files.
- [ ] `scripts/realtime_integration_check.py`'s docstring points to a document that actually exists (or is rephrased to not require one).

**Dependencies**
None identified.

**Related Code**
- `docs/db/migrations/README.md`
- `scripts/realtime_integration_check.py`

**Evidence**
- `git log --all --diff-filter=D -- docs/chat-integration.md docs/storage-integration.md docs/auth-integration.md docs/forum-integration.md docs/group-integration.md` shows all five deleted in `40a600e` "iii" (2026-08-15), 789 lines removed, with no later commit restoring them.
- Current `docs/` tree (verified via `find`) contains only `docs/db/`, `docs/acc test login`, `docs/open_swagger.py` — none of the five files exist.
- `docs/db/migrations/README.md` §"What's still missing after 004-007" still references `[chat-integration.md](../../chat-integration.md)` and `[storage-integration.md](../../storage-integration.md)`.
- `scripts/realtime_integration_check.py` docstring: "Same env vars as `tests/integration/` (see docs/chat-integration.md)".

**Testing**
Not applicable (documentation only).

**Risks / Edge Cases**
None identified.

---

## Backlog

### Integrate LiveKit video meetings into the Study Room frontend

**Status:** Backlog
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
Replace the mock media controls and fake participant list in `frontend/src/pages/StudyGroup/StudyRoom.tsx` with a real LiveKit Cloud connection, using the token issued by `POST /study-rooms/{room_id}/meeting/token`.

**Motivation**
The backend LiveKit token endpoint ("Implement LiveKit meeting token API", Done) has no frontend consumer at all; the meeting UI exists but is entirely local mock state (hard-coded participants, a `setInterval` timer, boolean toggles with no media effect).

**Scope**
- Add `livekit-client` (or `@livekit/components-react`) to `frontend/package.json`.
- Call the token endpoint and connect to the room named by `study_room_livekit_name(room_id)` (`app/meetings/services/livekit_service.py`).
- Wire mute/camera/screen-share controls to real LiveKit track publish/unpublish calls.
- Render real remote participant video tracks instead of the mock `participants` array.

**Out of Scope**
- Whiteboard, recording, transcription, attendance tracking — README explicitly states these are not implemented on the backend either; no evidence they're planned.

**Acceptance Criteria**
- [ ] Two browser sessions joining the same room can see/hear each other via LiveKit.
- [ ] Mute/camera toggles actually affect published tracks.
- [ ] Leaving the room disconnects from LiveKit cleanly.

**Dependencies**
"Integrate Supabase Auth into frontend"; "Integrate Study Room APIs into frontend" (needs a real room and an authenticated session to reach the token endpoint); "Implement LiveKit meeting token API" (Done).

**Related Code**
- `frontend/src/pages/StudyGroup/StudyRoom.tsx`
- `app/study_rooms/routers/study_room_router.py` (`POST /{room_id}/meeting/token`), `app/meetings/services/livekit_service.py`

**Evidence**
- `frontend/package.json` has no `livekit-client` or any WebRTC/video SDK dependency.
- Reading `frontend/src/pages/StudyGroup/StudyRoom.tsx`: participant list and controls are local `useState`, not connected to any external call.
- Backend endpoint exists and is tested (`tests/test_meetings.py`) but nothing in `frontend/` calls it (confirmed via repo-wide grep for the route path/`livekit`).

**Testing**
No automated tests exist for this today; manual two-browser verification is the realistic minimum given LiveKit's real-time nature.

**Risks / Edge Cases**
None identified beyond the sequencing dependency noted above.

---

### Wire up automatic notification creation for domain events

**Status:** Backlog
**Type:** Feature
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
`NotificationType` already enumerates `post_like`, `post_comment`, `comment_reply`, `group_invite`, `group_role_changed`, `room_kicked`, and `mention`, and the DB spec (§34, "create_comment()") explicitly describes creating a `comment_reply` notification for the parent comment's author — but nothing in `forum_service.py`, `group_service.py`, or `study_room_service.py` ever calls `NotificationsService.create`. Today a notification can only be created by directly calling `POST /notifications`.

**Motivation**
Without this, the Notifications feature ("Implement Notifications backend (CRUD)", Done) is unreachable by normal product usage — it's a fully-built CRUD layer with no caller, evidenced directly by the DB spec describing the intended behavior and the code not implementing it. This task is also the natural place to resolve `POST /notifications`'s public-endpoint status, an open question "Secure Notification authorization" (Ready) deliberately leaves unresolved (see its Out of Scope) — see the last Scope bullet below.

**Scope**
- On post like/comment, create a `post_like`/`post_comment` notification for the post author (skip self-notifications).
- On comment reply, create a `comment_reply` notification for the parent comment's author (per spec §34), skipping self-replies.
- On group role change / member ban / invite, create `group_role_changed`/`group_invite` notifications as appropriate.
- On study room kick, create a `room_kicked` notification for the target user.
- Once domain services create notifications internally, resolve `POST /notifications`'s fate: either remove the public endpoint, restrict it to an internal/service-role-only caller, or otherwise ensure it can no longer be used by an arbitrary caller to fabricate a notification claiming to be from/to anyone. Do not leave it exactly as-is once internal creation exists — that would mean the real notification-creation path and a still-open bypass path both exist simultaneously.

**Out of Scope**
- Realtime push or email delivery of notifications — spec §42 leaves these as open questions, not committed scope.
- `mention` notifications — no evidence of an @-mention parser anywhere in the forum/message content handling; omit until that exists.

**Acceptance Criteria**
- [ ] Liking/commenting on a post creates a notification for the post's author (not for the actor themselves).
- [ ] Replying to a comment creates a notification for the parent comment's author.
- [ ] A study room kick creates a `room_kicked` notification for the kicked user.
- [ ] A group role change creates a `group_role_changed` notification for the affected member.
- [ ] `POST /notifications` is no longer callable by an arbitrary client to create an arbitrary notification for/from any user — it is either removed, made internal-only, or otherwise secured to match how the domain services above actually create notifications.

**Dependencies**
"Implement Notifications backend (CRUD)" (Done); "Secure Forum authorization" and "Secure Group & Channel authorization" (Ready) should land first so the triggering endpoints are already caller-authenticated.

**Related Code**
- `app/forum/services/forum_service.py`, `app/groups/services/group_service.py`, `app/study_rooms/services/study_room_service.py`
- `app/notifications/services/notification_service.py`, `app/notifications/routers/notification_router.py` (`POST /notifications`'s fate)
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §30, §34

**Evidence**
- `grep -rn "NotificationsService\|notification_service\|create_notification" app` returns matches only inside `app/notifications/` itself — confirmed no other domain service creates a notification.
- `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §34 documents `create_comment()` as needing to create a `comment_reply` notification when `parent_comment_id != NULL` — describing intended, not implemented, behavior.
- `app/db/enums.py`'s `NotificationType` enum values (`GROUP_ROLE_CHANGED`, `ROOM_KICKED`, etc.) exist with no corresponding creation call anywhere.
- "Secure Notification authorization" (Ready) explicitly leaves `POST /notifications` unauthenticated pending this task's resolution — see that task's Out of Scope.

**Testing**
Add coverage asserting a `Notification` row is created (with correct `type`/`actor_id`/`user_id`) as a side effect of the triggering action, for each event type in scope.

**Risks / Edge Cases**
- Watch for self-notification (liking/commenting on your own post) and duplicate-notification-on-retry if these calls aren't made idempotent/transactional with the triggering action.

---

### Execute the Supabase Realtime security check script against a live project

**Status:** Backlog
**Type:** Testing
**Priority:** Medium
**Estimate:** Needs review
**Suggested GitHub item:** GitHub Issue

**Description**
`scripts/realtime_integration_check.py` is a standalone (non-pytest) script that verifies Supabase Realtime actually enforces RLS for channel messages — that a user with channel access receives Postgres Changes INSERT events, and that an outsider subscribed to the same table/filter does not. Its own docstring states it has never been run: "this script has NOT been executed against a live project in this environment — no SUPABASE_TEST_USER_* credentials were available."

**Motivation**
This verifies the one thing FastAPI-layer permission checks structurally cannot enforce — the frontend will eventually connect to Supabase Realtime directly with its own access token (per the README's documented Realtime architecture), so RLS on the `messages` table is the only thing preventing an outsider from receiving another conversation's messages. It has been written but never verified, and it currently only covers channel-type conversations even though the same RLS policy also governs room and direct conversations (see Scope).

**Scope**
- Provision the required Supabase Auth test users (`SUPABASE_TEST_USER_A/B/OUTSIDER_EMAIL/PASSWORD`), matching the pattern already used by `tests/integration/`.
- Run `python scripts/realtime_integration_check.py` against a live project.
- Fix up anything in the script that doesn't match the current `realtime-py` client API (the script's own docstring flags this as a real possibility, since it was "written against the documented ... API" without having been executed).
- Extend the script (or add sibling scenarios) to also cover **room**- and **direct**-type conversations, not just channel: verify a room member receives Postgres Changes INSERT events for their room's conversation and a non-member doesn't; verify the same for a DM participant vs. a non-participant. `can_access_conversation()` (`app/core/permissions.py`) is the single RLS dispatch function behind all three conversation types' `messages_select` policy (per "Refactor messaging to Conversation architecture"), so a bug specific to the room or direct branch would be invisible to channel-only verification — and this project has already found two real RLS bugs in adjacent policies (`002_fix_can_access_channel_active_membership.sql`, `007_fix_room_moderation_select_policy.sql`), making this a credible, not merely hypothetical, risk rather than routine extra-mile coverage.
- Record the verified result (pass/fail, per conversation type) somewhere durable (e.g. update the script's docstring status line, or fold the finding into `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` §37 alongside the other RLS-verification notes).

**Out of Scope**
- Extending to conversation types beyond channel/room/direct — there are no others (`channel`/`room`/`direct` are the only `conversations.type` enum values, per spec §13); nor to tables beyond `messages` — no other table is exposed via Realtime today (per migration `001`).

**Acceptance Criteria**
- [ ] The script runs successfully against a live Supabase project and both scenarios (B: authorized user receives the event; C: outsider does not) pass for **channel** conversations.
- [ ] The same B/C scenarios pass for **room**-type and **direct**-type conversations, not just channel.
- [ ] Any client-API mismatches found while running it are fixed.
- [ ] The script's docstring no longer says "NOT been executed," and no longer scopes itself to channel-only.

**Dependencies**
Requires Supabase test user credentials/environment access (external dependency, not code) — this is why it's Backlog rather than Ready.

**Related Code**
- `scripts/realtime_integration_check.py`
- `tests/integration/conftest.py` (existing pattern for `SUPABASE_TEST_USER_*` env vars)
- `docs/db/migrations/004_refactor_chat_to_conversations.sql` (defines `can_access_conversation()` and the `messages_select` policy that delegates to it for all three conversation types)

**Evidence**
- `scripts/realtime_integration_check.py` docstring, lines 1-24: explicitly states it is "prepared-but-unverified tooling," "has NOT been executed against a live project in this environment," and describes itself as covering "Scenario B/C from the chat backend spec" for **channel** chat only — no room or direct coverage exists in the script today.
- `docs/db/migrations/004_refactor_chat_to_conversations.sql`: `create policy messages_select on public.messages ... using (public.can_access_conversation(conversation_id))` is the single policy/function pair governing SELECT access for channel, room, and direct messages alike — confirming a room- or direct-specific RLS bug would not be caught by the current channel-only script.
- The project has already found and fixed two real RLS bugs in this exact area (`docs/db/migrations/002_fix_can_access_channel_active_membership.sql`, `007_fix_room_moderation_select_policy.sql`) — this is a demonstrated risk category, not a hypothetical one.

**Testing**
This task *is* the testing work; no separate test suite is proposed on top of it.

**Risks / Edge Cases**
- The script opens real WebSocket connections and waits on wall-clock time (per its own docstring) — flaky in CI-like environments; it's explicitly meant to be run manually, not automated.
