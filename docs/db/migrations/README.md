# Database migrations — run order & status

Plain SQL files, run manually against Supabase (SQL Editor, or `psql`/
`supabase db query` pointed at the project's connection string). Nothing
here is auto-applied by the app or by CI. Status below confirmed live
2026-08-16 — update this table whenever a migration is actually run live.

| # | File | Status | What it does |
|---|---|---|---|
| 001 | `001_enable_realtime_messages.sql` | ✅ Applied live | Adds `messages` to the `supabase_realtime` publication, confirms RLS is on for `messages`/`channels`/`channel_members`/`group_members`. Idempotent, safe to re-run. |
| 002 | `002_fix_can_access_channel_active_membership.sql` | ✅ Fix live (via 004 §7) | Fixes a bug where a banned/left group member with a stale `channel_members` row could still read a private channel. 004 (§7) reapplies the identical fix idempotently — confirmed live by re-reading `can_access_channel()`'s function body. Running 002 standalone now would be a harmless no-op. |
| 003 | `003_create_message_attachments_bucket.sql` | ✅ Applied live | Creates the private `message-attachments` Storage bucket. Confirmed live: `storage.buckets` has `message-attachments` (`public=false`, 10MB limit). |
| 004 | `004_refactor_chat_to_conversations.sql` | ✅ Applied live, verified | Adds the `Conversation` abstraction (channel / room / direct) alongside the existing Channel-only schema. **Expand phase only** — see below. `004_verify.sql` confirmed 33/33 checks OK, 0 FAIL; `conversations` has 16 channel-type + 8 room-type rows, matching `channels`/`study_rooms` counts exactly. |
| 005 | `005_contract_messages_to_conversations.sql` | ✅ Applied live | Contract phase for 004 — dropped `messages.channel_id`, `messages_channel_id_fkey`, `idx_messages_channel_created`, and the `messages_sync_conversation_id` trigger/function. `messages.conversation_id` is now the sole column; backend (SQLAlchemy models, `MessagesService`, routers, `app/core/permissions.py`) was refactored and tested before this ran. |
| 006 | `006_direct_conversation_pair_uniqueness.sql` | ✅ Applied live | Adds `conversations.direct_user_min_id`/`direct_user_max_id` + CHECK + partial unique index, guaranteeing at most one `type='direct'` conversation per user pair — see `STUDY_PLATFORM_DATABASE_SPEC.md` § 15. |
| 007 | `007_fix_room_moderation_select_policy.sql` | ✅ Applied live | Fixes a tautology (`srm.room_id = srm.room_id`) in the `room_moderation_select` RLS policy on `room_moderation_actions`, which let any active member of *any* study room read another room's moderation log via direct Postgres/Realtime access. `007_verify.sql` confirmed the tautology is gone and RLS is still enabled — see `STUDY_PLATFORM_DATABASE_SPEC.md` § 37. |
| 008 | `008_track_group_owner_membership_trigger.sql` | ⏳ Written, not yet run live | Tracks (does not change behavior on the current live DB) the pre-existing `add_group_owner()` function + `groups_add_owner` AFTER INSERT trigger on `groups` — confirmed live via `pg_get_functiondef`/`pg_get_triggerdef` on 2026-08-17, but never captured in any migration file before now. Required so a fresh database built only from tracked migrations gets the same owner-membership auto-insert the current live DB already has out of band. Companion to the `GroupsService.create()` fix (removed a duplicate application-level insert that raced this trigger and hit `group_members_group_id_user_id_key`) — see `STUDY_PLATFORM_DATABASE_SPEC.md` § 8, § 34. |
| 009 | `009_soft_delete_channels.sql` | ⏳ Written, not yet run live | Adds `channels.deleted_at`/`channels.deleted_by` (soft delete, reusing the `forum_posts.deleted_at` convention). Updates `can_access_channel()` to deny outright once `deleted_at` is set (cascades to `channels_select`, `channel_members_select`, and via `can_access_conversation`: `conversations_select`/`messages_select`/Realtime). Drops `channels_delete_manager` (closes a live gap: any group manager could otherwise physically DELETE a channel row — and cascade-destroy its conversation/messages — directly via PostgREST, bypassing FastAPI's soft-delete entirely). Adds `deleted_at is null` to `channels_update_manager` (blocks editing or undeleting a deleted channel via direct Postgres) and to the manager branches of `channel_members_insert`/`channel_members_delete` (blocks managing membership on a deleted channel via direct Postgres) — see `STUDY_PLATFORM_DATABASE_SPEC.md` § 9. |

Full design/rationale for 004-006: `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` § 12–15. For 007: § 37. For 008: § 8, § 34. For 009: § 9.

**004_rollback.sql, 005_rollback.sql, 006_rollback.sql, 007_rollback.sql were NOT run** — all four migrations are live and working; each rollback exists only as a reviewed, ready-to-use undo path if one of them ever needs reverting.

## Running 009

```text
1. 009_preflight.sql   — READ-ONLY. Confirms channels/profiles exist, that
                          deleted_at/deleted_by are not already present
                          (informational only), and prints the CURRENT live
                          can_access_channel() body and the three RLS
                          policies 009 is about to change/drop, so they can
                          be diffed before running it.

2. 009_soft_delete_channels.sql
                        — The actual migration. Single transaction. Adds
                          channels.deleted_at/deleted_by, updates
                          can_access_channel() to deny deleted channels,
                          drops channels_delete_manager (no authenticated-role
                          physical delete of a channel is possible anymore),
                          and adds a deleted_at guard to channels_update_manager
                          and to the manager branches of
                          channel_members_insert/channel_members_delete.
                          Idempotent: safe to re-run.

3. 009_verify.sql      — READ-ONLY. Confirms the columns/FK exist, no
                          pre-existing channel was retroactively marked
                          deleted, can_access_channel()'s body has the new
                          guard, channels_delete_manager is gone, and the
                          other three policies carry the deleted_at check.
```

No `009_rollback.sql`: nothing in this migration deletes data or drops a
column, so reverting (if ever needed) is a short manual operation —
`alter table public.channels drop column deleted_at, drop column deleted_by;`
plus restoring the three previous policy bodies and the pre-009
`can_access_channel()` body from `004_refactor_chat_to_conversations.sql`
§ 8 — not worth a companion script for a change this size (same reasoning as
008's "no rollback" note).

Full design/rationale: `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` § 9.

## Running 008

```text
1. 008_preflight.sql   — READ-ONLY. Confirms groups/group_members exist and
                          their unique constraint is present, and prints the
                          CURRENT live add_group_owner() body and
                          groups_add_owner trigger definition (if any). On
                          the current live DB these are expected to already
                          be present — diff them against
                          008_track_group_owner_membership_trigger.sql before
                          running it. On a fresh DB (001-007 only, no 008),
                          the function/trigger checks are expected to show
                          not-found — that's the motivating case, not a
                          failure.

2. 008_track_group_owner_membership_trigger.sql
                        — The actual migration. Single transaction.
                          CREATE OR REPLACE FUNCTION add_group_owner(), then
                          DROP TRIGGER IF EXISTS + CREATE TRIGGER
                          groups_add_owner. Idempotent: re-running always
                          converges to the same function/trigger definition,
                          whether they existed before or not.

3. 008_verify.sql      — READ-ONLY. Confirms the function/trigger exist,
                          the function is SECURITY DEFINER with the expected
                          ON CONFLICT upsert body, the trigger is AFTER
                          INSERT/FOR EACH ROW and enabled, and that this
                          migration didn't disturb the unrelated
                          groups_set_updated_at trigger or the
                          group_members unique constraint.
```

No `008_rollback.sql`: dropping this trigger would reintroduce the exact bug
this migration exists to prevent reproducing on a fresh database (see
`app/groups/services/group_service.py`, `GroupsService.create()`'s docstring)
— it is not a "this migration turned out to be wrong" situation like
004-007's contract/policy changes, where a reasoned undo path makes sense.
If it ever genuinely needs reverting, `drop trigger if exists groups_add_owner
on public.groups; drop function if exists public.add_group_owner();` is the
whole operation — a one-liner, not worth a companion script.

On the current live database this migration is a **no-op state
normalization** — `008_preflight.sql`'s INFO rows show the function/trigger
already match what 008 (re-)creates, byte-for-byte (confirmed via
`pg_get_functiondef`/`pg_get_triggerdef` on 2026-08-17, the same definitions
reproduced in the migration file). It matters for a **fresh** database built
only from 001-007, where this trigger does not exist yet — that database
would otherwise create a `groups` row with no owner `group_members` row at
all, silently breaking the invariant this fix depends on.

## Running 005

Same run order as 004, three companion scripts:

```text
1. 005_preflight.sql   — READ-ONLY. Confirms conversations/messages data
                          integrity, and that both the legacy (channel_id,
                          its FK/index, the compat trigger+function) and the
                          new (conversation_id, its FK/index, conversations,
                          conversation_members) schema objects are present in
                          the state 005 expects. Anything FAIL means 005 is
                          not safe to run yet.

2. 005_contract_messages_to_conversations.sql
                        — The actual migration. Single transaction. Drops,
                          in dependency order: the compatibility trigger,
                          its function, the old channel_id-scoped index, the
                          channel_id FK, then the channel_id column itself.
                          Every DROP uses IF EXISTS, so re-running after a
                          successful apply is a no-op, not an error.

3. 005_verify.sql      — READ-ONLY. Confirms the legacy objects are gone,
                          the conversation_id-based schema is untouched, and
                          message row count / integrity / Realtime / RLS are
                          all unchanged from before 005 ran.
```

If something needs undoing: `005_rollback.sql`. Read its header first — it
refuses to run if any message already belongs to a room/direct conversation
(there is no channel to backfill `channel_id` from in that case), and its
reconstruction of `idx_messages_channel_created`'s exact original definition
is a documented best-effort guess (the original DDL predates every file in
this repo, so it isn't captured verbatim anywhere) rather than a verified
fact.

005 has since been run live (see the status table above) — this section is
kept as a record of the intended run procedure, not a pending TODO.

## Running 004

004 is bigger and reviewed independently of 001-003. It has its own
companion scripts — run in this exact order:

```text
1. 004_preflight.sql   — READ-ONLY. Sanity-checks current live state
                          (row counts, orphans, duplicate attachment_path,
                          required functions, etc). Anything reported FAIL
                          means 004 will abort partway through — fix first.

2. 004_refactor_chat_to_conversations.sql
                        — The actual migration. Single transaction
                          (BEGIN...COMMIT) — either all of it applies or
                          none of it does. Safe to re-run before a
                          successful apply; will fail fast (and safely,
                          rolling back) if run again *after* a successful
                          apply, since it expects messages.channel_id-only
                          rows to backfill from — that's expected, not a
                          bug, and means "already applied."

3. 004_verify.sql      — READ-ONLY. Confirms 004 actually reached the
                          state it was designed for. Everything should be
                          OK/INFO; any FAIL needs investigating before
                          building anything on top of this schema. Also
                          has a few commented-out manual test snippets at
                          the bottom (each writes a row and rolls it back)
                          for exercising the compatibility trigger by hand.
```

If something needs undoing: `004_rollback.sql`. Read its header first —
it refuses to run (raises an exception) if any message already belongs to
a room/direct conversation, and it does not revert the `can_access_channel()`
security fix even though 004 applied it. It's the reverse of 004's expand
phase, not a generic "undo everything" button.

## Why 004 doesn't just drop `messages.channel_id`

Expand/contract, not one-shot: the FastAPI backend (SQLAlchemy models,
`MessageService`) still reads and writes `messages.channel_id` exclusively
at the time 004 was written. Dropping that column in the same migration that
introduces `conversation_id` would break the running backend the moment the
migration commits. So 004 only *adds* — `messages.conversation_id` exists
alongside `channel_id`, kept in sync by a small trigger
(`messages_sync_conversation_id`) for whichever column whatever wrote the
row happened to set. The actual removal of `channel_id` (and that trigger)
is 005, run only after the backend refactor lands and is tested.

## What's still missing after 004-007 + backend refactor

See `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` § 12 for the full picture.
Done: SQLAlchemy models / `MessagesService` / routers refactored to
`conversation_id`; 005/006/007 run live; channel, room, and direct-message
API endpoints (routes, schemas, permission checks) all implemented and
dispatching through `can_access_conversation()`/`can_send_to_conversation()`.
Still not verified as done from this repo alone (frontend-side, not checked
in this pass):

- Frontend Realtime filter change (`channel_id=eq.` → `conversation_id=eq.`)
  — the backend now only understands `conversation_id`-based endpoints (see
  [chat-integration.md](../../chat-integration.md)), so this is no longer
  optional once the frontend is updated to match.
- Attachment Storage object path convention change — see
  [storage-integration.md](../../storage-integration.md).
