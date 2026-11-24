create type public.goal_status as enum ('active', 'completed', 'expired', 'abandoned');

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  unit_label text,
  starts_on date not null,
  due_on date not null,
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_title_length check (char_length(btrim(title)) between 1 and 80),
  constraint goals_unit_label_length check (
    unit_label is null or char_length(btrim(unit_label)) between 1 and 24
  ),
  constraint goals_due_after_start check (due_on > starts_on),
  constraint goals_id_user_id_key unique (id, user_id)
);

create index goals_user_id_idx on public.goals (user_id);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

create table public.goal_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  position smallint not null,
  title text not null,
  target_count integer not null,
  due_on date not null,
  completed_at timestamptz,
  constraint goal_stages_goal_id_position_key unique (goal_id, position),
  constraint goal_stages_position_positive check (position > 0),
  constraint goal_stages_title_length check (char_length(btrim(title)) between 1 and 80),
  constraint goal_stages_target_positive check (target_count > 0),
  constraint goal_stages_goal_fkey foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade
);

create index goal_stages_user_id_idx on public.goal_stages (user_id);

create table public.goal_objectives (
  goal_id uuid not null,
  objective_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (goal_id, objective_id),
  constraint goal_objectives_goal_fkey foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  constraint goal_objectives_objective_fkey foreign key (objective_id, user_id)
    references public.objectives (id, user_id) on delete cascade
);

create index goal_objectives_objective_id_idx on public.goal_objectives (objective_id);
create index goal_objectives_user_id_idx on public.goal_objectives (user_id);

-- RN-06/RN-07 hold only for the goal as a whole, so the check is deferred to commit:
-- a goal and its stages are written in several statements of one transaction.
create function public.check_goal_stages()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_goal uuid;
  goal_start date;
  goal_due date;
  last_due date;
begin
  if tg_table_name = 'goals' then
    target_goal := new.id;
  elsif tg_op = 'DELETE' then
    target_goal := old.goal_id;
  else
    target_goal := new.goal_id;
  end if;

  select starts_on, due_on into goal_start, goal_due
  from public.goals
  where id = target_goal;

  if not found then
    return null;
  end if;

  select due_on into last_due
  from public.goal_stages
  where goal_id = target_goal
  order by position desc
  limit 1;

  if last_due is null then
    raise exception 'Goal % has no stages', target_goal using errcode = '23514';
  end if;

  if exists (
    select 1
    from (
      select due_on, lag(due_on) over (order by position) as previous_due
      from public.goal_stages
      where goal_id = target_goal
    ) stages
    where stages.due_on <= coalesce(stages.previous_due, goal_start)
  ) then
    raise exception 'Stage due dates of goal % must be increasing and after its start', target_goal
      using errcode = '23514';
  end if;

  if goal_due <> last_due then
    raise exception 'Goal % due date must match its last stage', target_goal using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke execute on function public.check_goal_stages() from public, anon, authenticated;

create constraint trigger goals_check_stages
  after insert or update of starts_on, due_on on public.goals
  deferrable initially deferred
  for each row execute function public.check_goal_stages();

create constraint trigger goal_stages_check_stages
  after insert or update or delete on public.goal_stages
  deferrable initially deferred
  for each row execute function public.check_goal_stages();

alter table public.goals enable row level security;
alter table public.goal_stages enable row level security;
alter table public.goal_objectives enable row level security;

create policy "Users can view their own goals"
  on public.goals for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own goals"
  on public.goals for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own goals"
  on public.goals for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own goals"
  on public.goals for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own goal stages"
  on public.goal_stages for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own goal stages"
  on public.goal_stages for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own goal stages"
  on public.goal_stages for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own goal stages"
  on public.goal_stages for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own goal links"
  on public.goal_objectives for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own goal links"
  on public.goal_objectives for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own goal links"
  on public.goal_objectives for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.goals to authenticated;
grant select, insert, update, delete on table public.goal_stages to authenticated;
grant select, insert, delete on table public.goal_objectives to authenticated;

-- RN-08: a stage's window runs from the day after the previous stage's deadline
-- (or the goal start, for the first stage) through its own deadline, inclusive.
create view public.goal_stage_progress
with (security_invoker = true)
as
with windows as (
  select
    s.goal_id,
    s.id as stage_id,
    s.position,
    coalesce(
      lag(s.due_on) over (partition by s.goal_id order by s.position) + 1,
      g.starts_on
    ) as window_start,
    s.due_on,
    s.target_count
  from public.goal_stages s
  join public.goals g on g.id = s.goal_id
)
select
  w.goal_id,
  w.stage_id,
  w.position,
  w.window_start,
  w.due_on,
  w.target_count,
  (
    select count(distinct c.id)
    from public.goal_objectives go
    join public.objective_checks c on c.objective_id = go.objective_id
    where go.goal_id = w.goal_id
      and c.day between w.window_start and w.due_on
  )::integer as checks_count
from windows w;

grant select on public.goal_stage_progress to authenticated;

-- Saves a goal with its stages and objective links in one transaction. Stages are positioned by
-- their order in the array, and the goal's due date is taken from the last one.
create function public.save_goal(goal jsonb, stages jsonb, objective_ids uuid[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid := (goal ->> 'id')::uuid;
  stage_count integer;
  last_due date;
begin
  if coalesce(cardinality(objective_ids), 0) = 0 then
    raise exception 'A goal needs at least one objective' using errcode = '23514';
  end if;

  if jsonb_typeof(stages) is distinct from 'array' or jsonb_array_length(stages) = 0 then
    raise exception 'A goal needs at least one stage' using errcode = '23514';
  end if;

  stage_count := jsonb_array_length(stages);
  last_due := (stages -> (stage_count - 1) ->> 'due_on')::date;

  if saved_id is null then
    insert into public.goals (title, description, unit_label, starts_on, due_on)
    values (
      goal ->> 'title',
      goal ->> 'description',
      goal ->> 'unit_label',
      (goal ->> 'starts_on')::date,
      last_due
    )
    returning id into saved_id;
  else
    update public.goals
    set
      title = goal ->> 'title',
      description = goal ->> 'description',
      unit_label = goal ->> 'unit_label',
      starts_on = (goal ->> 'starts_on')::date,
      due_on = last_due
    where id = saved_id;

    if not found then
      raise exception 'Goal % not found', saved_id using errcode = 'P0002';
    end if;
  end if;

  insert into public.goal_stages (goal_id, position, title, target_count, due_on)
  select
    saved_id,
    stage.ord,
    stage.value ->> 'title',
    (stage.value ->> 'target_count')::integer,
    (stage.value ->> 'due_on')::date
  from jsonb_array_elements(stages) with ordinality as stage(value, ord)
  on conflict (goal_id, position) do update
  set
    title = excluded.title,
    target_count = excluded.target_count,
    due_on = excluded.due_on;

  delete from public.goal_stages
  where goal_id = saved_id and position > stage_count;

  delete from public.goal_objectives
  where goal_id = saved_id and objective_id <> all (objective_ids);

  insert into public.goal_objectives (goal_id, objective_id)
  select saved_id, unnest(objective_ids)
  on conflict do nothing;

  return saved_id;
end;
$$;

revoke execute on function public.save_goal(jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.save_goal(jsonb, jsonb, uuid[]) to authenticated;
