-- `bio` already exists in public.profiles. This adds the only new profile field.
alter table public.profiles add column if not exists organization text;
