-- Adds conversation_members.last_read_at (timestamptz), the per-user "mark this direct
-- conversation as read" state used to compute unread DM badge counts (see
-- app/conversations/services/conversation_service.py: mark_read/count_unread_for_user).
-- Purely additive -- no existing code reads or writes this column yet, so this single file
-- is both the "expand" and "contract" phase at once (unlike 004/005's split).
alter table public.conversation_members add column if not exists last_read_at timestamptz;

-- Backfill tradeoff (explicit): every EXISTING row is backfilled to now(), not NULL/epoch.
-- Any message sent before this migration runs is treated as already-read for every existing
-- member, even if they never opened it -- rollout does NOT retroactively surface a flood of
-- months-old "unread" counts across every existing DM. The alternative (epoch/NULL) would do
-- exactly that the instant this ships, which is worse UX here.
update public.conversation_members set last_read_at = now() where last_read_at is null;

alter table public.conversation_members alter column last_read_at set default now();
alter table public.conversation_members alter column last_read_at set not null;

-- No RLS change needed: conversation_members_select (migration 004) already lets a member
-- read this column same as every other column on this table. No authenticated
-- INSERT/UPDATE/DELETE policy is added -- FastAPI's postgres-role connection remains the
-- sole writer (via the new POST /conversations/{id}/read endpoint), consistent with how
-- every row on this table is already written today (ConversationsService.get_or_create_direct
-- is the only inserter).
