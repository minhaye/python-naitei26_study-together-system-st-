-- Create the private Storage bucket used for Group Resources (files uploaded to
-- resources.file_path). Mirrors 003_create_message_attachments_bucket.sql exactly, for the
-- same reasons -- see that file's header for the full rationale.
--
-- `public = false` -- objects are never served from a public URL; the only access paths are
-- FastAPI-issued short-lived signed upload/download URLs (see
-- app/resources/services/resource_storage_service.py), generated with the service_role key.
-- storage.objects has RLS enabled with zero policies for anon/authenticated (verified live
-- for message-attachments in 003; same project, same default), so this is deny-by-default
-- for any direct access outside of a signed URL -- no additional storage.objects policies
-- are needed for this MVP flow.
--
-- Keep file_size_limit / allowed_mime_types in sync with app/resources/constants.py
-- (MAX_RESOURCE_SIZE_BYTES, ALLOWED_RESOURCE_CONTENT_TYPES) if either changes.
--
-- Idempotent: ON CONFLICT DO NOTHING, safe to run multiple times. Note the resulting
-- semantics: if a `group-resources` bucket already exists (however it was created), this
-- INSERT silently no-ops -- it does NOT reconcile public/file_size_limit/allowed_mime_types
-- against the values below. Run 014_preflight.sql first; if it reports the bucket as
-- already-existing, review its reported config before assuming this migration made it match.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-resources',
  'group-resources',
  false,
  20971520, -- 20 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;
