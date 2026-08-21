-- Adds groups.background_url (nullable) for the Group background-image feature: group
-- owner AND active moderator (public.is_group_manager, pre-existing function -- see
-- STUDY_PLATFORM_DATABASE_SPEC.md § 34) may set/clear it, deliberately looser than the
-- rest of Group settings (name/description/is_public stay owner-only via update_group) --
-- see app/groups/routers/group_router.py POST/DELETE /groups/{group_id}/background.
-- Purely additive, no backfill/contract phase needed.
alter table public.groups add column if not exists background_url text;

-- Storage bucket for the uploaded background images. Public -- a group's background is
-- displayed to any visitor viewing the group, same visibility as avatar_url/profile
-- avatars -- mirrors 017_create_profile_avatars_bucket.sql's public-bucket shape exactly,
-- just a different bucket id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-backgrounds', 'group-backgrounds', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Only an active group owner/moderator may upload into groups/<group_id>/... .
-- is_group_manager(p_group_id, p_user_id default auth.uid()) is a pre-existing function
-- (used since 002/004 for can_access_channel etc.) -- called here with just the group id,
-- so it reads auth.uid() internally; not a new arbitrary-user-probe function.
drop policy if exists "Group managers can upload group background" on storage.objects;
create policy "Group managers can upload group background"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'group-backgrounds'
  and (storage.foldername(name))[1] = 'groups'
  and public.is_group_manager(((storage.foldername(name))[2])::uuid)
);
