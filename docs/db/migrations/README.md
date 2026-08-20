# Database migrations — run order & status

Plain SQL files, run manually against Supabase (SQL Editor, or `psql`/
`supabase db query` pointed at the project's connection string). Nothing
here is auto-applied by the app or by CI. Status below confirmed live
2026-08-19 (014, 015, 019) — update this table whenever a migration is actually run live.

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
| 010 | `010_soft_delete_study_rooms.sql` | ✅ Applied live | Adds `study_rooms.deleted_at`/`study_rooms.deleted_by` (same soft-delete shape as 009). Updates `can_access_room_conversation()` to deny outright once `deleted_at` is set (cascades to `conversations_select`/`messages_select`/Realtime for ROOM-type conversations), and adds an `sr.host_id = auth.uid()` OR branch closing a pre-existing Python/SQL parity gap (Python's `can_access_room()` has always granted the host unconditional access; this SQL function never had that branch — the non-host `study_room_members`+`is_group_member` branch is untouched). Drops any authenticated-role physical DELETE policy on `study_rooms` (discovered dynamically — names not tracked in this repo). Unlike 009, the base `study_rooms`/`study_room_members`/`room_moderation_actions` RLS policies were never captured in this repo, so instead of replacing unknown permissive policies, this migration adds new RESTRICTIVE `deleted_at IS NULL` policies (safe to add without knowing the existing permissive bodies, since a restrictive policy can only narrow access, never widen it) — see `STUDY_PLATFORM_DATABASE_SPEC.md` § 16. |
| 011 | `011_room_manage_authority_current_group_role.sql` | ✅ Applied live, verified | Follow-up authorization audit (2026-08-18) found `study_rooms.host_id` was being treated as a permanent, independent authorization grant rather than creator metadata — both for room MANAGEMENT (fixed Python-only, same commit, no SQL surface since FastAPI's Postgres connection bypasses RLS) and for room PARTICIPATION via `can_access_room_conversation()`, which Realtime/PostgREST evaluate directly. This migration removes the `sr.host_id = auth.uid()` OR branch 010 added, leaving only the pre-existing `is_group_member(...) AND active study_room_members row` branch untouched. Safe because `StudyRoomsService.create()` has always inserted an active HOST-role `study_room_members` row for the creator atomically with the room — a currently-participating host is unaffected; only a host who has since left the room loses the unconditional bypass — see `STUDY_PLATFORM_DATABASE_SPEC.md` § 16/§ 22. `011_verify.sql` confirmed live: host_id branch removed, `deleted_at`/`is_group_member`/active-membership branches all still present, `study_rooms_hide_deleted` RESTRICTIVE policy untouched, no authenticated DELETE policy on `study_rooms`. Row counts observed at verify time (historical, not an invariant): `study_rooms`=11, `study_room_members`=35. `011_preflight.sql` found 5 hosts without an active Room membership row, all reviewed manually and confirmed legitimate (`HOST_LEFT_ROOM` — each already had a `study_room_members` row with `left_at IS NOT NULL`); no backfill was needed. |
| 012 | `012_backfill_missing_room_conversations.sql` | ✅ Applied live, verified | Study Room → Conversation creation invariant fix (2026-08-18). 004 backfilled one `room`-type Conversation per Study Room that existed at the time, but `StudyRoomsService.create()` was never updated to create one for rooms created afterward — every Study Room created since 004 (until the same-commit application fix) had NO Conversation at all, breaking chat/attachments/meeting-token for it even though other room operations worked fine. This migration backfilled the missing `room`-type Conversation for every orphaned `study_rooms` row (active AND soft-deleted — see `STUDY_PLATFORM_DATABASE_SPEC.md` § 16 for why deleted rooms are included). It did NOT add a new unique constraint: `conversations_room_id_key` (partial unique index on `conversations.room_id`) and `conversations_type_target_check` already existed from 004 and already guaranteed at most one `room`-type Conversation per room — `012_verify.sql` confirmed both still present. The application-side fix (`StudyRoomsService.create()` now creates Room + host `study_room_members` + Conversation atomically in one transaction, mirroring `ChannelsService.create()`) is what prevents this gap from reopening for future rooms — see `app/study_rooms/services/study_room_service.py`. `012_verify.sql` confirmed live: every Study Room (including the soft-deleted one) has exactly one `room`-type Conversation, no room has more than one, backfilled `created_by` values match their room's `host_id`, soft-delete state was preserved, no `study_rooms`/pre-existing `conversations` rows were lost, and RLS remains enabled on `conversations`/`messages`/`study_rooms`. Row counts observed at verify time (historical, not an invariant): `study_rooms`=11, room-type conversations before=8, backfilled=3, after=11. |
| 013 | `013_create_invitations.sql` | ✅ Applied live, verified | Unified invitation system (2026-08-18) backing the new `app/invitations/` API — replaces the previously-fake "copy invite link" UX. Creates `invitation_method`/`invitation_status` enums and `invitations` (exactly one of `group_id`/`room_id`/`channel_id` set via CHECK; `secret_hash` is the only persisted form of the plaintext token/code, returned exactly once at creation). Adds `notifications.invitation_id` (nullable FK) and two `notification_type` values (`study_room_invitation`, `private_channel_invitation`) — `group_invite` is reused for Group invitations. Enables RLS on `invitations` from scratch (SELECT-own: creator or JWT-email-matching recipient), no write policy for `authenticated`. `notifications` RLS was found live (never tracked in any migration file before now) via `013_preflight.sql`: already enabled with `notifications_select_own`/`notifications_update_own`/`notifications_delete_own`. This migration kept `notifications_select_own` as-is and **explicitly dropped** `notifications_update_own`/`notifications_delete_own`, so `notifications` now matches `invitations`/`messages`/`channels`: FastAPI (`postgres` role) is the sole writer, no authenticated write policy remains on any of the four tables. `013_verify.sql` confirmed live: table/columns/CHECKs/unique constraint present, both new `notification_type` values present, RLS enabled on both tables, `invitations_select_own`/`notifications_select_own` present, `notifications_update_own`/`notifications_delete_own` gone, no authenticated write policy remains anywhere, `notifications` row count unchanged (135) with 0 rows unexpectedly carrying `invitation_id`, `invitations` had 0 rows immediately after (expected — nothing had used the API against this DB yet). Row counts observed at verify time (historical, not an invariant): `notifications`=135, `invitations`=0. See `docs/invitations.md` for the full API/lifecycle design and the RLS reconciliation rationale. |
| 014 | `014_create_group_resources_bucket.sql` | ✅ Applied live, verified | Creates the private `group-resources` Storage bucket backing `app/resources/services/resource_storage_service.py` (Group Resources upload/download signed URLs, part of the Resource frontend integration). Mirrors 003 exactly — same deny-by-default rationale, same idempotent `ON CONFLICT DO NOTHING` insert, just a different bucket id/mime allowlist (adds docx/xlsx/pptx on top of 003's set). Ships with `014_preflight.sql`/`014_verify.sql` (008-013 convention) — verify confirmed the bucket's public/file_size_limit/allowed_mime_types, no anon/authenticated write policy was introduced, and `message-attachments` plus every other bucket were left untouched. |
| 015 | `015_cleanup_stale_mock_resources.sql` | ✅ Applied live, verified | Live-data cleanup, not a schema change: deleted 20 stale legacy `public.resources` rows named `mock-resource-<n>-<m>.<ext>` that came from `docs/db/data.csv` (a raw seed dump added in commit `cd0613b`, then removed from git tracking — but never reverted live — by commit `d664e10`). Those rows predated the real `group-resources` bucket/upload path scheme and had no corresponding Storage object, so every download of one failed while real uploads worked fine. No code in the current repo creates or reintroduces them (confirmed via repo-wide search for `mock-resource-`). `015_verify.sql` confirmed live: `mock_resources_gone` → OK, 0 remaining; `resources_non_mock_row_count` → 3, unchanged from preflight (all 3 real/non-mock Resource rows preserved); `resources_total_row_count` → 3; `resource_folders_row_count` → 12, untouched. |
| 016 | `016_create_forum_tags.sql` | *(from origin/master, merged in — not part of the Notes work; see forum-hashtag history for details)* | Creates `tags`/`post_tags` for the Forum hashtag system. |
| 017 | `017_create_profile_avatars_bucket.sql` | *(from origin/master, merged in — not part of the Notes work)* | Creates the Storage bucket for profile avatar uploads. |
| 018 | `018_add_profile_organization.sql` | *(from origin/master, merged in — not part of the Notes work)* | Adds a profile organization field. |
| 019 | `019_create_group_notes.sql` | ✅ Applied live, verified | Creates `group_notes`: shared, Group-scoped Notes backing `app/notes/` (Owner/Moderator: read/create/edit/delete; Member: read-only; non-member/inactive membership: no access — enforced via `is_active_group_member`/`is_group_manager`, not note authorship). Originally numbered 016; renumbered to 019 while merging `origin/master` into `feat/notes-persistence`, since master had independently claimed 016-018 for the Forum-hashtag/Profile work above — no content changed, only the file names and their internal self-references. An earlier draft (before this branch's first commit) also scoped Notes to `study_rooms` (`room_notes`/`room_id`); it was corrected to the `groups`-scoped design below before ever being applied, so no `room_id`/`room_notes` schema or data ever existed to migrate away from. `title`/`content` length limits (100/2000 chars) are enforced in the Pydantic DTO, not as DB constraints. RLS enabled with zero policies for `authenticated` — FastAPI (`postgres` role) was the sole reader/writer at the time this ran, same precedent as invitations' write side (013); Notes had no Realtime/direct-client access. `019_verify.sql` confirmed live (run under this migration's original 016 filename before the merge-driven renumber): table and all 7 columns present, `idx_group_notes_group_id` index present, RLS enabled, no `authenticated` policy on `group_notes`, `room_notes` absent (confirms the discarded draft left no trace), 0 rows immediately after (expected — nothing had used the API against this DB yet). **Superseded for reads by 020 below**: "FastAPI is the sole reader" describes 019's own scope, not the current model once 020 is applied — 020 adds a real `authenticated` SELECT policy (active Group members only) and Realtime delivery under it; the write side (FastAPI-only, no `authenticated` write policy) is unchanged. |
| 020 | `020_enable_workspace_realtime_sync.sql` | ⏳ Written, not yet run live | Workspace-level Realtime sync (Channels/Study Rooms/Group Notes, `feat/workspace-realtime-sync`). Adds `channels` and `study_rooms` to the `supabase_realtime` publication — both already had correctly-scoped SELECT RLS (audited by 002/009/010/011), they were simply never published, so no INSERT/UPDATE event was ever broadcast for either. For `group_notes`, adds its first-ever `authenticated` policy (`group_notes_select_active_member`, SELECT via the pre-existing `is_group_member()`) — 019 shipped it with zero policies deliberately, out of scope at the time — then adds it to the publication too. Post-020 model: `authenticated` gets direct SELECT only where that policy allows (active Group members), Realtime delivery is gated by the same policy, and FastAPI remains the sole MUTATION/write boundary (no `authenticated` INSERT/UPDATE/DELETE policy exists) — see the migration's own "After this migration" section for the full breakdown. Deliberately does NOT set `group_notes` to `REPLICA IDENTITY FULL` (would leak deleted notes' full content to any subscriber, since Realtime never applies RLS to DELETE events) and does not attempt to fix the separate, accepted gap where a Channel/Study Room soft-delete (UPDATE, not DELETE) is not reliably broadcast to previously-subscribed clients, since Realtime evaluates RLS against the post-update row. See the migration's own header for full rationale. **Not yet run against the live database from this environment** (no Supabase credentials available here) — run `020_preflight.sql` → `020_enable_workspace_realtime_sync.sql` → `020_verify.sql` manually via the SQL Editor before relying on the new frontend Realtime hooks (`useGroupTableRealtime.ts`, `useGroupNotesRealtime.ts`); until then they subscribe but receive no events. |
| 021 | `021_create_roadmaps.sql` | ⏳ Pending | Creates personal roadmaps and ordered phases with owner-scoped RLS. Run `021_preflight.sql`, then this migration, then `021_verify.sql`. |
| 022 | `022_create_tasks.sql` | ⏳ Pending | Creates personal `tasks` with owner-scoped RLS policies and least-privilege authenticated grants. Run `022_preflight.sql`, then this migration, then `022_verify.sql`. |

Full design/rationale for 004-006: `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` § 12–15. For 007: § 37. For 008: § 8, § 34. For 009: § 9. For 010/011: § 16, § 22. For 012: § 14. For 013: `docs/invitations.md`. For 014/015: § 24. For 019 (Group Notes): `app/notes/` (see the row above; no separate design doc exists for Notes).

**004_rollback.sql, 005_rollback.sql, 006_rollback.sql, 007_rollback.sql were NOT run** — all four migrations are live and working; each rollback exists only as a reviewed, ready-to-use undo path if one of them ever needs reverting.

## Running 013

013 has since been run live and verified (see the status table above) —
this section is kept as a record of the intended run procedure, not a
pending TODO (same as 005's/011's/012's note).

A live preflight run (2026-08-18) found `notifications` was NOT wide-open as
originally assumed: RLS was already enabled with three existing policies
never captured in any migration file in this repo before then --
`notifications_select_own` (SELECT), `notifications_update_own` (UPDATE),
`notifications_delete_own` (DELETE) -- 135 rows. The migration file and
scripts below were updated to reconcile this: `notifications_select_own` was
kept as-is (same semantics), and `notifications_update_own`/
`notifications_delete_own` were **explicitly dropped** by
`013_create_invitations.sql` § 5, so `notifications` now matches
`invitations`/`messages`/`channels` -- FastAPI (`postgres` role) is the sole
writer, no authenticated write policy remains. See `docs/invitations.md`'s
RLS section for the full reasoning.

Live verify results (2026-08-18): every check OK -- `invitations` table,
all 14 required columns, `invitations_exactly_one_target` CHECK,
`invitations_email_recipient` CHECK, and the `secret_hash` unique constraint
all present; `study_room_invitation`/`private_channel_invitation`
`notification_type` values present; `notifications.invitation_id` column
present; RLS enabled on both `invitations` and `notifications`;
`invitations_select_own`/`notifications_select_own` present;
`notifications_update_own`/`notifications_delete_own` confirmed absent; no
authenticated write policy remains on either table. `notifications` row
count unchanged at 135, with 0 pre-existing rows unexpectedly carrying
`invitation_id`. `invitations` had 0 rows immediately after (expected --
nothing had used the API against this DB yet). These row counts are
historical observations from the verify run, not invariants to assert
against in future runs (same convention as 011's/012's notes above).

```text
1. 013_preflight.sql   — READ-ONLY. Confirms groups/study_rooms/channels/
                          profiles/notifications exist, confirms invitations
                          does not already exist, prints the FULL body
                          (USING/WITH CHECK) of every existing policy on
                          notifications -- READ EVERY ONE before proceeding,
                          expected to be exactly the three named above, each
                          a plain "user_id = auth.uid()" own-row check --
                          lists notification_type's current enum values,
                          confirms auth.users is reachable from the
                          connecting role (required for
                          InvitationsService.lookup_user_id_by_email), and
                          reports the current notifications row count (used
                          to confirm 013 doesn't change it).

                          If any policy body is not a plain own-row check, or
                          an unexpected policy name appears, or anything is
                          found to depend on writing to notifications via
                          PostgREST/Supabase client directly, STOP and
                          reconsider before running 013 as written.

2. 013_create_invitations.sql
                        — The actual migration (two transactions -- see the
                          file's own comment on why). Creates
                          invitation_method/invitation_status enums and the
                          invitations table (CHECK: exactly one target;
                          CHECK: recipient_email required iff method=email;
                          secret_hash unique). Adds notifications.
                          invitation_id (nullable) and two new
                          notification_type values. Enables RLS on
                          invitations from scratch (SELECT-own, no write
                          policy for authenticated). Recreates
                          notifications_select_own (idempotent, unchanged
                          semantics) and explicitly DROPS
                          notifications_update_own/notifications_delete_own.
                          Idempotent: safe to re-run.

3. 013_verify.sql      — READ-ONLY. Confirms the table/columns/CHECKs/unique
                          constraint exist, invitations has 0 rows (nothing
                          has used the API against this DB yet), every
                          pre-existing notifications row still has
                          invitation_id IS NULL and the row count is
                          unchanged from preflight, both new
                          notification_type values are present, RLS is
                          enabled on both tables, notifications_select_own
                          is present, notifications_update_own/
                          notifications_delete_own are GONE, and no
                          authenticated write policy remains on either
                          table.
```

No `013_rollback.sql`: no row is deleted, modified, or backfilled by this
migration (same reasoning 008/009/012 used to skip one) -- the only
non-additive part is removing two RLS *policy objects* (not data), which
013_preflight.sql's output captures the exact bodies of for the record. If
ever needed: `drop table public.invitations cascade; alter table
public.notifications drop column invitation_id;` plus dropping
`invitations_select_own`/`notifications_select_own` and recreating
`notifications_update_own`/`notifications_delete_own` from the bodies
captured in that preflight run -- the two new notification_type enum values
cannot be removed without recreating the type, which isn't worth scripting
for a change this size.

Full design/rationale: `docs/invitations.md`.

## Running 012

012 has since been run live and verified (see the status table above) —
this section is kept as a record of the intended run procedure, not a
pending TODO (same as 005's/011's note).

Live results: preflight found `study_rooms`=11, room-type conversations=8
before running (3 rooms with zero room-conversations, 0 rooms with more
than one). `012_verify.sql` confirmed OK on every check: every Study Room
(including the one soft-deleted room) has exactly one room-type
Conversation, no room has more than one, `study_rooms` row count and
soft-delete state unchanged, `conversations_room_id_key` and
`conversations_type_target_check` still present, backfilled `created_by`
values match their room's `host_id`, and RLS remains enabled on
`conversations`/`messages`/`study_rooms`. Room-type conversation count
after: 11 (8 pre-existing + 3 backfilled). These row counts are historical
observations from the verify run, not invariants to assert against in
future runs.

```text
1. 012_preflight.sql   — READ-ONLY. Reports study_rooms/room-type-conversation
                          row counts, confirms conversations_room_id_key and
                          conversations_type_target_check (both from 004) are
                          present, lists every room with ZERO room-conversations
                          (what 012 will backfill — room_id/name/group_id/
                          host_id/deleted_at for each), lists any room with
                          MORE THAN ONE room-conversation (must be
                          OK/none-found — see below), and checks for any
                          room-conversation referencing a nonexistent room
                          (should not be structurally possible given the FK,
                          included as defense-in-depth).

                          If `rooms_with_multiple_room_conversations` is not
                          OK/none-found: STOP. Do not run 012. That situation
                          needs manual review (affected room IDs, conversation
                          IDs, message count per conversation) before any
                          remediation — automatically picking one Conversation
                          and discarding the other(s) could split or hide real
                          message history. Report findings before proceeding.

2. 012_backfill_missing_room_conversations.sql
                        — The actual migration. Single transaction. INSERT
                          ... WHERE NOT EXISTS for every study_rooms row
                          (active or soft-deleted) with zero room-type
                          conversations. Idempotent: re-running after a
                          successful apply inserts zero rows. Does not add
                          any constraint (both relevant ones already exist),
                          does not touch study_rooms/study_room_members, and
                          does not modify any pre-existing Conversation or
                          Message.

3. 012_verify.sql      — READ-ONLY. Confirms every study_rooms row (including
                          soft-deleted ones) now has exactly one room-type
                          Conversation, no room has more than one, study_rooms
                          row count and soft-delete state are unchanged,
                          channel-type/direct-type conversation counts are
                          unchanged (only room-type may have grown),
                          conversations_room_id_key and
                          conversations_type_target_check are still present,
                          backfilled Conversations' created_by matches their
                          room's host_id, and RLS remains enabled on
                          conversations/study_rooms/messages.
```

No `012_rollback.sql`: this migration only INSERTs rows for rooms that had
zero room-Conversations — it never updates or deletes anything pre-existing.
If ever needed, reverting is `delete from public.conversations where type =
'room' and created_at = <backfill run time> and ...` scoped precisely to the
rows 012 inserted (identifiable via `012_preflight.sql`'s
`rooms_with_zero_room_conversations` output, captured before running) — not
worth a companion script for a plain, narrowly-scoped INSERT.

Full design/rationale: `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` § 14.

## Running 011

011 has since been run live (see the status table above) — this section is
kept as a record of the intended run procedure, not a pending TODO (same as
005's note below).

```text
1. 011_preflight.sql   — READ-ONLY. Confirms can_access_room_conversation()
                          exists, prints its CURRENT live body, confirms the
                          host_id branch 010 added is still present (expected
                          before running 011) and that the non-host
                          is_group_member branch is present (must be OK — the
                          thing 011 leaves untouched), and lists any room
                          whose host currently lacks an active
                          study_room_members row (informational — review any
                          rows here, since that host will lose unconditional
                          SQL/RLS conversation access once 011 commits; a
                          normally-created room's host always has one).

                          Live preflight (2026-08-18) found 5 such hosts; all
                          5 were reviewed manually and confirmed legitimate
                          (HOST_LEFT_ROOM — each already had a
                          study_room_members row with left_at IS NOT NULL,
                          not a missing row). No backfill was required.

2. 011_room_manage_authority_current_group_role.sql
                        — The actual migration. Single transaction.
                          CREATE OR REPLACE for can_access_room_conversation()
                          only — removes the `sr.host_id = auth.uid()` OR
                          branch 010 added, leaves the deleted_at guard and
                          the is_group_member/active-membership branch
                          byte-for-byte unchanged. Idempotent: safe to re-run.

3. 011_verify.sql      — READ-ONLY. Confirms the host_id branch is gone,
                          the deleted_at guard and the group-member/active-
                          membership branches are still present, 010's
                          RESTRICTIVE/DELETE-policy state is untouched, and
                          study_rooms/study_room_members row counts are
                          unchanged from before 011.

                          Live verify (2026-08-18) confirmed OK on every
                          check: can_access_room_conversation_host_branch_removed,
                          can_access_room_conversation_body_has_deleted_at_guard,
                          can_access_room_conversation_body_has_group_member_branch,
                          can_access_room_conversation_body_has_active_membership_check,
                          restrictive_policy_present:study_rooms_hide_deleted,
                          no_authenticated_delete_policy:study_rooms. Row
                          counts observed at that time (historical, not an
                          invariant to assert against in future runs):
                          study_rooms=11, study_room_members=35.
```

No `011_rollback.sql`: this migration only replaces a function body (no
column/policy/data change), so reverting — if ever needed — is restoring the
`sr.host_id = auth.uid()` OR branch from `010_soft_delete_study_rooms.sql`'s
body via the same `create or replace function` shape, not worth a companion
script for a change this size (same reasoning as 008/009's "no rollback"
notes).

## Python/SQL parity follow-up (2026-08-18, Python-only, no new migration)

011 fixed the SQL/RLS side of room PARTICIPATION authority (`is_group_member(...)
AND active study_room_members row`). A follow-up audit found the Python side,
`can_access_room()` (`app/core/permissions.py`), had never had the equivalent
Group-membership check — it only checked for an active `study_room_members`
row, so a user who left/was banned from the Group could keep reading/writing
a room's chat via FastAPI on a stale active Room membership alone, even
though migration 011 already denied the same request at the SQL/RLS layer
(Realtime, direct PostgREST). Fixed entirely in Python (`can_access_room()`
now also requires `is_active_group_member()`; `study_room_router.join_room`
gained the same check as its own join prerequisite, since a first-time
joiner has no Room membership yet to check). **No SQL/RLS change required —
migration 011 already implements the canonical participation rule**; this
was a Python-only parity fix. See `STUDY_PLATFORM_DATABASE_SPEC.md` § 16.

Full design/rationale: `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` § 16, § 22.

## Running 010

```text
1. 010_preflight.sql   — READ-ONLY. Confirms study_rooms/study_room_members/
                          room_moderation_actions/profiles exist, that
                          deleted_at/deleted_by are not already present
                          (informational only), and prints the CURRENT live
                          can_access_room_conversation() body and EVERY
                          existing policy on all three tables (names are not
                          tracked anywhere else in this repo — see the
                          migration's header for why this differs from 009).
                          Read every printed policy before running 010.

2. 010_soft_delete_study_rooms.sql
                        — The actual migration. Single transaction. Adds
                          study_rooms.deleted_at/deleted_by, updates
                          can_access_room_conversation() to deny deleted
                          rooms AND to grant the room host unconditional
                          access (closing a pre-existing Python/SQL parity
                          gap -- the non-host branch is untouched), drops any
                          authenticated-role physical DELETE policy on
                          study_rooms (found dynamically), and adds new
                          RESTRICTIVE deleted_at-guard policies to
                          study_rooms/study_room_members/
                          room_moderation_actions. Idempotent: safe to re-run.

3. 010_verify.sql      — READ-ONLY. Confirms the columns/FK exist, no
                          pre-existing room was retroactively marked deleted,
                          can_access_room_conversation()'s body has both the
                          deleted_at guard and the new host branch, no
                          authenticated DELETE policy remains on study_rooms,
                          and the four new RESTRICTIVE policies are present
                          with the expected shape.
```

No `010_rollback.sql`: nothing in this migration deletes data or drops a
column, same reasoning as 009's "no rollback" note. If ever needed:
`alter table public.study_rooms drop column deleted_at, drop column deleted_by;`,
`drop policy` the four new RESTRICTIVE policies, and restore the pre-010
`can_access_room_conversation()` body from `004_refactor_chat_to_conversations.sql`
§ 8. This migration never records what (if anything) the dropped
authenticated-role DELETE policy on `study_rooms` looked like, since its name
and body were never captured live before being removed — re-adding it, if
ever wanted, is a new decision, not a rollback.

Full design/rationale: `docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` § 16.

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
