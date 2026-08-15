-- Create the private Storage bucket used for message attachments.
-- Verified against storage.buckets (2026-08-13): no buckets exist yet in this project.
--
-- `public = false` -- objects are never served from a public URL; the only
-- access paths are FastAPI-issued short-lived signed upload/download URLs
-- (see app/attachments/services/attachment_service.py), generated with the
-- service_role key. storage.objects has RLS enabled with zero policies for
-- anon/authenticated (verified live), so this is deny-by-default for any
-- direct access outside of a signed URL -- no additional storage.objects
-- policies are needed for this MVP flow.
--
-- Keep file_size_limit / allowed_mime_types in sync with
-- app/attachments/constants.py (MAX_ATTACHMENT_SIZE_BYTES,
-- ALLOWED_ATTACHMENT_CONTENT_TYPES) if either changes.
--
-- Idempotent: ON CONFLICT DO NOTHING, safe to run multiple times.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
)
on conflict (id) do nothing;
