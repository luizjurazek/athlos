-- A stage can be closed by hand before reaching its target, and so can the whole goal.
alter table public.goals add column completed_manually_on date;

alter table public.goal_stages
  add column completed_manually_on date,
  add constraint goal_stages_completed_manually_before_due check (completed_manually_on <= due_on),
  add constraint goal_stages_id_goal_id_user_id_key unique (id, goal_id, user_id);

-- Optional per-objective targets of a stage. A stage with rows here only completes when every
-- objective reaches its own target, and its target_count holds their sum.
create table public.goal_stage_targets (
  stage_id uuid not null,
  goal_id uuid not null,
  objective_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_count integer not null,
  primary key (stage_id, objective_id),
  constraint goal_stage_targets_target_positive check (target_count > 0),
  constraint goal_stage_targets_stage_fkey foreign key (stage_id, goal_id, user_id)
    references public.goal_stages (id, goal_id, user_id) on delete cascade,
  constraint goal_stage_targets_link_fkey foreign key (goal_id, objective_id)
    references public.goal_objectives (goal_id, objective_id) on delete cascade
);

create index goal_stage_targets_goal_id_objective_id_idx
  on public.goal_stage_targets (goal_id, objective_id);
create index goal_stage_targets_user_id_idx on public.goal_stage_targets (user_id);

alter table public.goal_stage_targets enable row level security;

create policy "Users can view their own stage targets"
  on public.goal_stage_targets for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own stage targets"
  on public.goal_stage_targets for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own stage targets"
  on public.goal_stage_targets for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own stage targets"
  on public.goal_stage_targets for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.goal_stage_targets to authenticated;

-- RN-08 with manual completion: a stage closed by hand ends on that day, and the next stage's
-- window starts right after it instead of after the original deadline.
create or replace view public.goal_stage_progress
with (security_invoker = true)
as
with windows as (
  select
    s.goal_id,
    s.id as stage_id,
    s.position,
    coalesce(
      lag(least(s.due_on, coalesce(s.completed_manually_on, s.due_on)))
        over (partition by s.goal_id order by s.position) + 1,
      g.starts_on
    ) as window_start,
    s.due_on,
    s.target_count,
    least(s.due_on, coalesce(s.completed_manually_on, s.due_on)) as window_end
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
      and c.day between w.window_start and w.window_end
  )::integer as checks_count,
  w.window_end
from windows w;

create view public.goal_stage_objective_progress
with (security_invoker = true)
as
select
  t.goal_id,
  t.stage_id,
  t.objective_id,
  t.target_count,
  (
    select count(*)
    from public.objective_checks c
    where c.objective_id = t.objective_id
      and c.day between p.window_start and p.window_end
  )::integer as checks_count
from public.goal_stage_targets t
join public.goal_stage_progress p on p.stage_id = t.stage_id;

grant select on public.goal_stage_objective_progress to authenticated;

-- Same as before, plus each stage's optional `targets` array of {objective_id, target_count}.
-- Targets are rewritten on every save, matched to stages by position.
create or replace function public.save_goal(goal jsonb, stages jsonb, objective_ids uuid[])
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

  delete from public.goal_stage_targets where goal_id = saved_id;

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

  insert into public.goal_stage_targets (stage_id, goal_id, objective_id, target_count)
  select
    s.id,
    saved_id,
    (target ->> 'objective_id')::uuid,
    (target ->> 'target_count')::integer
  from jsonb_array_elements(stages) with ordinality as stage(value, ord)
  join public.goal_stages s on s.goal_id = saved_id and s.position = stage.ord
  cross join jsonb_array_elements(coalesce(stage.value -> 'targets', '[]'::jsonb)) as target;

  return saved_id;
end;
$$;
