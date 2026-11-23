-- IANA timezone that defines the user's "day" for checks (RN-04).
alter table public.profiles
  add column timezone text not null default 'America/Sao_Paulo';

-- Daily objectives, repeated on the selected weekdays (0 = Sunday).
create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  color text,
  icon text,
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  reschedulable boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint objectives_title_length check (char_length(btrim(title)) between 1 and 80),
  constraint objectives_weekdays_valid check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]
  ),
  -- Target of the composite FK that keeps checks owned by the objective's owner.
  constraint objectives_id_user_id_key unique (id, user_id)
);

create index objectives_user_id_idx on public.objectives (user_id);

create trigger objectives_set_updated_at
  before update on public.objectives
  for each row execute function public.set_updated_at();

alter table public.objectives enable row level security;

create policy "Users can view their own objectives"
  on public.objectives for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own objectives"
  on public.objectives for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own objectives"
  on public.objectives for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own objectives"
  on public.objectives for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- One row per objective per day it was done (RN-02).
create table public.objective_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  objective_id uuid not null,
  -- Computed by the app in the user's timezone; never now()::date, which is UTC on the server.
  day date not null,
  checked_at timestamptz not null default now(),
  constraint objective_checks_objective_id_day_key unique (objective_id, day),
  -- Composite FK: a check can only point to an objective of the same user, even if RLS is bypassed.
  constraint objective_checks_objective_fkey foreign key (objective_id, user_id)
    references public.objectives (id, user_id) on delete cascade
);

create index objective_checks_user_id_day_idx on public.objective_checks (user_id, day);

alter table public.objective_checks enable row level security;

create policy "Users can view their own checks"
  on public.objective_checks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own checks"
  on public.objective_checks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own checks"
  on public.objective_checks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own checks"
  on public.objective_checks for delete
  to authenticated
  using ((select auth.uid()) = user_id);
