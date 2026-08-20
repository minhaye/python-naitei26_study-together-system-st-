-- Personal tasks. Each policy and grant is intentionally scoped to the owner.
begin;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  due_date date not null,
  priority smallint not null check (priority between 1 and 3),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_user_due_date_idx on public.tasks (user_id, due_date);

revoke all on table public.tasks from anon, authenticated;
grant select, insert, update on table public.tasks to authenticated;
alter table public.tasks enable row level security;

create policy tasks_select_owner on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy tasks_insert_owner on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy tasks_update_owner on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
commit;
