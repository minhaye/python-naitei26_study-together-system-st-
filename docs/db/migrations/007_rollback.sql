-- Rollback for 007_fix_room_moderation_select_policy.sql.
--
-- WARNING: this deliberately RESTORES the known tautology bug
-- (`srm.room_id = srm.room_id`) documented in
-- docs/db/STUDY_PLATFORM_DATABASE_SPEC.md §37. It exists only for symmetry
-- with this project's other migrations and as an emergency escape hatch if
-- 007's new USING expression turns out to have an unrelated regression
-- (e.g. an unexpected interaction with `is_room_manager()`). Do not run this
-- as routine maintenance -- doing so re-opens the cross-room moderation-log
-- read documented as a security issue.
--
-- Straightforward: 007 only changed one policy's USING expression via
-- ALTER POLICY, so rollback is the same operation with the old (buggy)
-- expression restored. No column, index, or constraint was touched by 007,
-- so there is nothing else to revert.

begin;

alter policy room_moderation_select on public.room_moderation_actions
using (
  is_room_manager(room_id)
  or exists (
    select 1
    from study_room_members srm
    where srm.room_id = srm.room_id
      and srm.user_id = auth.uid()
      and srm.left_at is null
  )
);

commit;
