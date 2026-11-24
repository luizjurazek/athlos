-- A goal is measured either by the checks of its objectives or by entries logged on the goal
-- itself (books read, "ran 5km"). In the second case the objectives are only supporting habits.
create type public.goal_progress_source as enum ('checks', 'entries');

alter table public.goals
  add column progress_source public.goal_progress_source not null default 'checks';

create table public.goal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  day date not null,
  amount integer not null default 1,
  note text,
  created_at timestamptz not null default now(),
  constraint goal_entries_amount_positive check (amount > 0),
  constraint goal_entries_note_length check (note is null or char_length(btrim(note)) between 1 and 120),
  constraint goal_entries_goal_fkey foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade
);

create index goal_entries_goal_id_day_idx on public.goal_entries (goal_id, day);
create index goal_entries_user_id_idx on public.goal_entries (user_id);

alter table public.goal_entries enable row level security;

create policy "Users can view their own goal entries"
  on public.goal_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own goal entries"
  on public.goal_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own goal entries"
  on public.goal_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own goal entries"
  on public.goal_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.goal_entries to authenticated;

-- checks_count keeps its name: for entry goals it is the sum of entries in the stage window.
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
    least(s.due_on, coalesce(s.completed_manually_on, s.due_on)) as window_end,
    g.progress_source
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
  case
    when w.progress_source = 'entries' then (
      select coalesce(sum(e.amount), 0)
      from public.goal_entries e
      where e.goal_id = w.goal_id
        and e.day between w.window_start and w.window_end
    )
    else (
      select count(distinct c.id)
      from public.goal_objectives go
      join public.objective_checks c on c.objective_id = go.objective_id
      where go.goal_id = w.goal_id
        and c.day between w.window_start and w.window_end
    )
  end::integer as checks_count,
  w.window_end
from windows w;

-- Same as before, plus `goal.progress_source`. Entry goals may have no objectives and never keep
-- per-objective targets.
create or replace function public.save_goal(goal jsonb, stages jsonb, objective_ids uuid[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid := (goal ->> 'id')::uuid;
  source public.goal_progress_source :=
    coalesce((goal ->> 'progress_source')::public.goal_progress_source, 'checks');
  linked uuid[] := coalesce(objective_ids, '{}');
  stage_count integer;
  last_due date;
begin
  if source = 'checks' and cardinality(linked) = 0 then
    raise exception 'A goal needs at least one objective' using errcode = '23514';
  end if;

  if jsonb_typeof(stages) is distinct from 'array' or jsonb_array_length(stages) = 0 then
    raise exception 'A goal needs at least one stage' using errcode = '23514';
  end if;

  stage_count := jsonb_array_length(stages);
  last_due := (stages -> (stage_count - 1) ->> 'due_on')::date;

  if saved_id is null then
    insert into public.goals (title, description, unit_label, starts_on, due_on, progress_source)
    values (
      goal ->> 'title',
      goal ->> 'description',
      goal ->> 'unit_label',
      (goal ->> 'starts_on')::date,
      last_due,
      source
    )
    returning id into saved_id;
  else
    update public.goals
    set
      title = goal ->> 'title',
      description = goal ->> 'description',
      unit_label = goal ->> 'unit_label',
      starts_on = (goal ->> 'starts_on')::date,
      due_on = last_due,
      progress_source = source
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
  where goal_id = saved_id and objective_id <> all (linked);

  insert into public.goal_objectives (goal_id, objective_id)
  select saved_id, unnest(linked)
  on conflict do nothing;

  if source = 'checks' then
    insert into public.goal_stage_targets (stage_id, goal_id, objective_id, target_count)
    select
      s.id,
      saved_id,
      (target ->> 'objective_id')::uuid,
      (target ->> 'target_count')::integer
    from jsonb_array_elements(stages) with ordinality as stage(value, ord)
    join public.goal_stages s on s.goal_id = saved_id and s.position = stage.ord
    cross join jsonb_array_elements(coalesce(stage.value -> 'targets', '[]'::jsonb)) as target;
  end if;

  return saved_id;
end;
$$;
