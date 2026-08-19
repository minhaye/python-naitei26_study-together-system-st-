-- One-time live-data cleanup: removes the stale 'mock-resource-%' rows from public.resources
-- described in 015_preflight.sql's header. These rows came from docs/db/data.csv (a raw seed
-- dump added in commit cd0613b and later untracked in commit d664e10 -- see that file's git
-- history for the original INSERT statements), predate the real `group-resources` Storage
-- bucket and upload path scheme, and have no corresponding Storage object -- every download
-- attempt against one fails. No code in the current repo creates or reintroduces these rows.
--
-- Run 015_preflight.sql FIRST and read every row in its mock_resources_matched output --
-- that list is the only record of exactly what this deletes. Do not run this if
-- mock_resources_have_legacy_path_shape reported FAIL.
--
-- Scoped narrowly on purpose: matches ONLY rows whose name has the literal
-- 'mock-resource-' prefix AND whose file_path does NOT look like a real upload (belt-and-
-- suspenders against ever matching genuine user data). Does not touch resource_folders (not
-- rendered by the current frontend, and resources.folder_id is ON DELETE SET NULL so nothing
-- depends on this cleanup order) or any other table.
--
-- No rollback file: this is a plain DELETE of confirmed-garbage seed rows, not a schema
-- change: there is nothing to structurally revert. Idempotent -- running it again deletes 0
-- rows.

delete from public.resources
where name like 'mock-resource-%'
  and file_path not like 'groups/%';
