-- Run once in Supabase SQL Editor. Images are public because avatar URLs are used across the app.
-- Authenticated users may insert only into their own `users/<auth.uid()>` directory.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own profile avatar" on storage.objects;
create policy "Users can upload their own profile avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
);
