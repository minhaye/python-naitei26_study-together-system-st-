create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200), due_date date not null,
  priority smallint not null check (priority between 1 and 3), completed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists tasks_user_due_date_idx on public.tasks(user_id, due_date);
alter table public.tasks enable row level security;
drop policy if exists tasks_owner_access on public.tasks;
create policy tasks_owner_access on public.tasks for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
