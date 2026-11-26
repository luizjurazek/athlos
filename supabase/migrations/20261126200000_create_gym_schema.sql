-- RN-32: the activity type lives on the objective; null = a regular objective. Running, football etc.
-- become new values here plus child detail tables of activity_sessions.
create type public.activity_type as enum ('gym');

alter table public.objectives add column activity_type public.activity_type;

-- RN-33: never two active objectives of the same activity type on one weekday. Enforced here as a
-- safety net; the Server Actions validate first and show the reason under the field.
create function public.check_objective_activity_weekdays()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.activity_type is not null and new.archived_at is null and exists (
    select 1
    from public.objectives other
    where other.user_id = new.user_id
      and other.id <> new.id
      and other.activity_type = new.activity_type
      and other.archived_at is null
      and other.weekdays && new.weekdays
  ) then
    raise exception 'Another active objective of this activity type shares a weekday'
      using errcode = 'check_violation', constraint = 'objectives_activity_weekdays_overlap';
  end if;
  return new;
end;
$$;

create trigger objectives_check_activity_weekdays
  before insert or update of activity_type, weekdays, archived_at on public.objectives
  for each row execute function public.check_objective_activity_weekdays();

-- Workout plan ("ficha"): free (no objective) or linked to one gym objective (RN-25).
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  objective_id uuid,
  title text not null,
  started_on date not null,
  ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_plans_title_length check (char_length(btrim(title)) between 1 and 60),
  constraint workout_plans_period check (ended_on is null or ended_on >= started_on),
  constraint workout_plans_id_user_id_key unique (id, user_id),
  -- Deleting the objective keeps the plan as a free one (RN-25); only objective_id is cleared.
  constraint workout_plans_objective_fkey foreign key (objective_id, user_id)
    references public.objectives (id, user_id) on delete set null (objective_id)
);

create unique index workout_plans_one_active_per_objective
  on public.workout_plans (objective_id)
  where objective_id is not null and ended_on is null;
create index workout_plans_user_id_idx on public.workout_plans (user_id);

create trigger workout_plans_set_updated_at
  before update on public.workout_plans
  for each row execute function public.set_updated_at();

-- Workouts A, B, C… of a plan (RN-26).
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null,
  label text not null,
  description text,
  position smallint not null,
  constraint workouts_label_length check (char_length(btrim(label)) between 1 and 3),
  constraint workouts_description_length check (
    description is null or char_length(btrim(description)) between 1 and 60
  ),
  constraint workouts_position_positive check (position > 0),
  -- Deferred so reordering or swapping labels can pass through duplicates inside one transaction.
  constraint workouts_plan_id_label_key unique (plan_id, label) deferrable initially deferred,
  constraint workouts_plan_id_position_key unique (plan_id, position) deferrable initially deferred,
  constraint workouts_id_user_id_key unique (id, user_id),
  -- Lets the schedule require a workout of the same plan.
  constraint workouts_id_plan_id_user_id_key unique (id, plan_id, user_id),
  constraint workouts_plan_fkey foreign key (plan_id, user_id)
    references public.workout_plans (id, user_id) on delete cascade
);

create index workouts_user_id_idx on public.workouts (user_id);

-- Exercise snapshot saved on the workout (RN-26, RN-31): never depends on the search API afterwards.
create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null,
  position smallint not null,
  name text not null,
  notes text,
  source text,
  source_id text,
  image_url text,
  muscles text[],
  equipment text,
  -- Exercise of the previous plan this one was copied from (RN-30), so evolution crosses plans.
  copied_from_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_exercises_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint workout_exercises_notes_length check (notes is null or char_length(notes) <= 280),
  constraint workout_exercises_position_positive check (position > 0),
  constraint workout_exercises_source_id_requires_source check (source_id is null or source is not null),
  constraint workout_exercises_id_user_id_key unique (id, user_id),
  constraint workout_exercises_workout_fkey foreign key (workout_id, user_id)
    references public.workouts (id, user_id) on delete cascade,
  constraint workout_exercises_copied_from_fkey foreign key (copied_from_id, user_id)
    references public.workout_exercises (id, user_id) on delete set null (copied_from_id)
);

create index workout_exercises_workout_id_idx on public.workout_exercises (workout_id, position);
create index workout_exercises_copied_from_id_idx on public.workout_exercises (copied_from_id);
create index workout_exercises_user_id_idx on public.workout_exercises (user_id);

create trigger workout_exercises_set_updated_at
  before update on public.workout_exercises
  for each row execute function public.set_updated_at();

-- RN-27: one load per exercise, versioned by day. A version is valid until the next one.
create table public.workout_exercise_loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_exercise_id uuid not null,
  -- Day in the user's timezone, like objective_checks.day.
  effective_from date not null,
  sets smallint not null,
  reps smallint not null,
  -- Null = body weight.
  load_kg numeric(6, 2),
  created_at timestamptz not null default now(),
  constraint workout_exercise_loads_sets_positive check (sets > 0),
  constraint workout_exercise_loads_reps_positive check (reps > 0),
  constraint workout_exercise_loads_load_not_negative check (load_kg is null or load_kg >= 0),
  constraint workout_exercise_loads_workout_exercise_id_effective_from_key
    unique (workout_exercise_id, effective_from),
  constraint workout_exercise_loads_exercise_fkey foreign key (workout_exercise_id, user_id)
    references public.workout_exercises (id, user_id) on delete cascade
);

create index workout_exercise_loads_user_id_idx on public.workout_exercise_loads (user_id);

-- Which workout falls on each weekday of the linked objective (RN-28). 0 = Sunday.
create table public.workout_schedule (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null,
  weekday smallint not null,
  workout_id uuid not null,
  constraint workout_schedule_pkey primary key (plan_id, weekday),
  constraint workout_schedule_weekday_valid check (weekday between 0 and 6),
  constraint workout_schedule_plan_fkey foreign key (plan_id, user_id)
    references public.workout_plans (id, user_id) on delete cascade,
  constraint workout_schedule_workout_fkey foreign key (workout_id, plan_id, user_id)
    references public.workouts (id, plan_id, user_id) on delete cascade
);

create index workout_schedule_workout_id_idx on public.workout_schedule (workout_id);
create index workout_schedule_user_id_idx on public.workout_schedule (user_id);

-- What was done on a day (RN-29). Generic on purpose: other activity types add child tables.
create table public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  objective_id uuid not null,
  day date not null,
  activity_type public.activity_type not null,
  workout_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_sessions_objective_id_day_key unique (objective_id, day),
  constraint activity_sessions_objective_fkey foreign key (objective_id, user_id)
    references public.objectives (id, user_id) on delete cascade,
  constraint activity_sessions_workout_fkey foreign key (workout_id, user_id)
    references public.workouts (id, user_id) on delete set null (workout_id)
);

create index activity_sessions_user_id_day_idx on public.activity_sessions (user_id, day);
create index activity_sessions_workout_id_idx on public.activity_sessions (workout_id);

create trigger activity_sessions_set_updated_at
  before update on public.activity_sessions
  for each row execute function public.set_updated_at();

-- The schedule follows the objective's weekdays: a plan that changes (or loses) its objective drops
-- it, and weekdays removed from the objective drop their rows (RN-25, task 16).
create function public.clear_workout_schedule_on_plan_objective_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.workout_schedule s where s.plan_id = new.id;
  return new;
end;
$$;

create trigger workout_plans_clear_schedule
  after update of objective_id on public.workout_plans
  for each row
  when (old.objective_id is distinct from new.objective_id)
  execute function public.clear_workout_schedule_on_plan_objective_change();

create function public.clear_workout_schedule_on_weekdays_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.workout_schedule s
  using public.workout_plans p
  where p.id = s.plan_id
    and p.objective_id = new.id
    and s.weekday <> all (new.weekdays);
  return new;
end;
$$;

create trigger objectives_clear_workout_schedule
  after update of weekdays on public.objectives
  for each row
  when (old.weekdays is distinct from new.weekdays)
  execute function public.clear_workout_schedule_on_weekdays_change();

alter table public.workout_plans enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_exercise_loads enable row level security;
alter table public.workout_schedule enable row level security;
alter table public.activity_sessions enable row level security;

create policy "Users can view their own workout plans"
  on public.workout_plans for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own workout plans"
  on public.workout_plans for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own workout plans"
  on public.workout_plans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own workout plans"
  on public.workout_plans for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own workouts"
  on public.workouts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own workouts"
  on public.workouts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own workouts"
  on public.workouts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own workouts"
  on public.workouts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own workout exercises"
  on public.workout_exercises for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own workout exercises"
  on public.workout_exercises for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own workout exercises"
  on public.workout_exercises for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own workout exercises"
  on public.workout_exercises for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own workout loads"
  on public.workout_exercise_loads for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own workout loads"
  on public.workout_exercise_loads for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own workout loads"
  on public.workout_exercise_loads for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own workout loads"
  on public.workout_exercise_loads for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own workout schedule"
  on public.workout_schedule for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own workout schedule"
  on public.workout_schedule for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own workout schedule"
  on public.workout_schedule for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own workout schedule"
  on public.workout_schedule for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own activity sessions"
  on public.activity_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own activity sessions"
  on public.activity_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own activity sessions"
  on public.activity_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own activity sessions"
  on public.activity_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.workout_plans to authenticated;
grant select, insert, update, delete on table public.workouts to authenticated;
grant select, insert, update, delete on table public.workout_exercises to authenticated;
grant select, insert, update, delete on table public.workout_exercise_loads to authenticated;
grant select, insert, update, delete on table public.workout_schedule to authenticated;
grant select, insert, update, delete on table public.activity_sessions to authenticated;

-- RN-27: the load of each exercise of the plan on a day = the version with the latest
-- effective_from <= day. Archived exercises are included so past days keep their history.
create function public.workout_loads_on(plan_id uuid, day date)
returns table (
  workout_exercise_id uuid,
  workout_id uuid,
  effective_from date,
  sets smallint,
  reps smallint,
  load_kg numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (l.workout_exercise_id)
    l.workout_exercise_id, e.workout_id, l.effective_from, l.sets, l.reps, l.load_kg
  from public.workout_exercise_loads l
  join public.workout_exercises e on e.id = l.workout_exercise_id
  join public.workouts w on w.id = e.workout_id
  where w.plan_id = workout_loads_on.plan_id
    and l.effective_from <= workout_loads_on.day
  order by l.workout_exercise_id, l.effective_from desc;
$$;

revoke execute on function public.workout_loads_on(uuid, date) from public, anon;
grant execute on function public.workout_loads_on(uuid, date) to authenticated;

-- RN-27: upsert the version of that day. A version equal to the one in force the day before is
-- deleted instead, so history only records real changes. Returns whether a version was kept.
create function public.save_workout_load(
  workout_exercise_id uuid,
  day date,
  sets integer,
  reps integer,
  load_kg numeric default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous record;
begin
  select l.sets, l.reps, l.load_kg into previous
  from public.workout_exercise_loads l
  where l.workout_exercise_id = save_workout_load.workout_exercise_id
    and l.effective_from < save_workout_load.day
  order by l.effective_from desc
  limit 1;

  if found
    and previous.sets = save_workout_load.sets
    and previous.reps = save_workout_load.reps
    and previous.load_kg is not distinct from save_workout_load.load_kg
  then
    delete from public.workout_exercise_loads l
    where l.workout_exercise_id = save_workout_load.workout_exercise_id
      and l.effective_from = save_workout_load.day;
    return false;
  end if;

  insert into public.workout_exercise_loads (workout_exercise_id, effective_from, sets, reps, load_kg)
  values (
    save_workout_load.workout_exercise_id,
    save_workout_load.day,
    save_workout_load.sets,
    save_workout_load.reps,
    save_workout_load.load_kg
  )
  on conflict on constraint workout_exercise_loads_workout_exercise_id_effective_from_key
  do update set sets = excluded.sets, reps = excluded.reps, load_kg = excluded.load_kg;
  return true;
end;
$$;

revoke execute on function public.save_workout_load(uuid, date, integer, integer, numeric) from public, anon;
grant execute on function public.save_workout_load(uuid, date, integer, integer, numeric) to authenticated;

-- RN-30/RN-34: creates a plan with its workouts and schedule in one transaction. With an
-- objective, the objective's active plan ends the day before. A workout with
-- `copy_from_workout_id` brings that workout's active exercises (with `copied_from_id`) and their
-- current load as the first version on `started_on`.
--   workouts: [{ "label": "A", "description": "Peito", "copy_from_workout_id": uuid | null }]
--   schedule: [{ "weekday": 1, "workout_index": 0 }]  (index into workouts)
create function public.start_workout_plan(
  objective_id uuid,
  title text,
  started_on date,
  workouts jsonb,
  schedule jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_plan_id uuid;
  new_workout_id uuid;
  new_workout_ids uuid[] := '{}';
  workout jsonb;
  workout_position integer;
  source_workout_id uuid;
  objective_weekdays smallint[];
begin
  if start_workout_plan.objective_id is not null then
    select o.weekdays into objective_weekdays
    from public.objectives o
    where o.id = start_workout_plan.objective_id and o.activity_type = 'gym';
    if not found then
      raise exception 'Objective is not a gym objective' using errcode = 'foreign_key_violation';
    end if;

    update public.workout_plans p
    set ended_on = start_workout_plan.started_on - 1
    where p.objective_id = start_workout_plan.objective_id and p.ended_on is null;
  elsif jsonb_array_length(start_workout_plan.schedule) > 0 then
    raise exception 'A free plan has no schedule' using errcode = 'check_violation';
  end if;

  insert into public.workout_plans (objective_id, title, started_on)
  values (start_workout_plan.objective_id, btrim(start_workout_plan.title), start_workout_plan.started_on)
  returning id into new_plan_id;

  for workout, workout_position in
    select w.value, w.ordinality from jsonb_array_elements(start_workout_plan.workouts) with ordinality w
  loop
    insert into public.workouts (plan_id, label, description, position)
    values (
      new_plan_id,
      upper(btrim(workout ->> 'label')),
      nullif(btrim(workout ->> 'description'), ''),
      workout_position
    )
    returning id into new_workout_id;
    new_workout_ids := new_workout_ids || new_workout_id;

    source_workout_id := (workout ->> 'copy_from_workout_id')::uuid;
    if source_workout_id is not null then
      with copied as (
        insert into public.workout_exercises (
          workout_id, position, name, notes, source, source_id, image_url, muscles, equipment,
          copied_from_id
        )
        select
          new_workout_id,
          row_number() over (order by e.position, e.created_at),
          e.name, e.notes, e.source, e.source_id, e.image_url, e.muscles, e.equipment, e.id
        from public.workout_exercises e
        where e.workout_id = source_workout_id and e.archived_at is null
        returning id, copied_from_id
      )
      insert into public.workout_exercise_loads (workout_exercise_id, effective_from, sets, reps, load_kg)
      select c.id, start_workout_plan.started_on, current_load.sets, current_load.reps, current_load.load_kg
      from copied c
      cross join lateral (
        select l.sets, l.reps, l.load_kg
        from public.workout_exercise_loads l
        where l.workout_exercise_id = c.copied_from_id
        -- The version in force on the new start; a source whose history starts later falls back
        -- to its latest version.
        order by (l.effective_from <= start_workout_plan.started_on) desc, l.effective_from desc
        limit 1
      ) current_load;
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(start_workout_plan.schedule) s
    where (s.value ->> 'weekday')::smallint <> all (objective_weekdays)
  ) then
    raise exception 'Schedule weekday outside the objective weekdays' using errcode = 'check_violation';
  end if;

  insert into public.workout_schedule (plan_id, weekday, workout_id)
  select
    new_plan_id,
    (s.value ->> 'weekday')::smallint,
    new_workout_ids[(s.value ->> 'workout_index')::integer + 1]
  from jsonb_array_elements(start_workout_plan.schedule) s;

  return new_plan_id;
end;
$$;

revoke execute on function public.start_workout_plan(uuid, text, date, jsonb, jsonb) from public, anon;
grant execute on function public.start_workout_plan(uuid, text, date, jsonb, jsonb) to authenticated;
