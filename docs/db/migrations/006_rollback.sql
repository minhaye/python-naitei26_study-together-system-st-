-- Rollback for 006_direct_conversation_pair_uniqueness.sql.
--
-- Straightforward, unlike 004/005's rollbacks: 006 only ADDED two nullable
-- columns, one CHECK constraint, and one partial unique index -- nothing
-- else was touched, nothing was backfilled, no other object depends on any
-- of these three (RLS/can_access_conversation's direct branch reads
-- conversation_members, not these columns). Drop order: index and check
-- constraint before the columns they're defined on.
--
-- Safe to run even if `conversation_members`-based direct conversations
-- already exist and are in use by the application -- those rows are
-- untouched by this rollback (this migration's columns are redundant with,
-- not a replacement for, conversation_members). The only behavior change
-- after rolling back: a duplicate direct-conversation pair could theoretically
-- be created again in a race (the DB-level guard 006 added is gone) -- do not
-- roll this back while the DM feature is deployed and reachable.

begin;

drop index if exists public.conversations_direct_pair_key;

alter table public.conversations
  drop constraint if exists conversations_direct_pair_check;

alter table public.conversations
  drop column if exists direct_user_min_id;

alter table public.conversations
  drop column if exists direct_user_max_id;

commit;
