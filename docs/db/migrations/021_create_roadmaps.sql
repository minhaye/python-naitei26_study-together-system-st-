-- Personal roadmaps with ordered learning phases.
begin;

create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  goal text not null check (char_length(btrim(goal)) between 1 and 500),
  due_date date,
  created_at timestamptz not null default now()
);
create index roadmaps_user_created_at_idx on public.roadmaps (user_id, created_at desc);

create table public.roadmap_phases (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  position smallint not null check (position >= 0),
  progress smallint not null default 0 check (progress between 0 and 100),
  unique (roadmap_id, position)
);
create index roadmap_phases_roadmap_position_idx on public.roadmap_phases (roadmap_id, position);

revoke all on table public.roadmaps, public.roadmap_phases from anon, authenticated;
grant select, insert, update on table public.roadmaps, public.roadmap_phases to authenticated;
alter table public.roadmaps enable row level security;
alter table public.roadmap_phases enable row level security;

create policy roadmaps_select_owner on public.roadmaps for select to authenticated using ((select auth.uid()) = user_id);
create policy roadmaps_insert_owner on public.roadmaps for insert to authenticated with check ((select auth.uid()) = user_id);
create policy roadmaps_update_owner on public.roadmaps for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy roadmap_phases_select_owner on public.roadmap_phases for select to authenticated using (
  exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = (select auth.uid()))
);
create policy roadmap_phases_insert_owner on public.roadmap_phases for insert to authenticated with check (
  exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = (select auth.uid()))
);
create policy roadmap_phases_update_owner on public.roadmap_phases for update to authenticated using (
  exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = (select auth.uid()))
);
commit;
