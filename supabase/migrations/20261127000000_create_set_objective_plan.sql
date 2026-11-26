-- The gym objective owns the link to its plan and the workout of each weekday; the plan only holds the
-- workouts. One transaction: switching to another plan ends the previous one (RN-30), "none" only
-- unlinks it, and the schedule is replaced.
--   schedule: [{ "weekday": 1, "workout_id": uuid }]  (weekdays without a fixed workout are omitted)
create function public.set_objective_plan(
  objective_id uuid,
  today date,
  plan_id uuid default null,
  schedule jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_plan record;
  objective_weekdays smallint[];
begin
  select o.weekdays into objective_weekdays
  from public.objectives o
  where o.id = set_objective_plan.objective_id and o.activity_type = 'gym';
  if not found then
    raise exception 'Objective is not a gym objective' using errcode = 'foreign_key_violation';
  end if;

  select p.id, p.started_on into current_plan
  from public.workout_plans p
  where p.objective_id = set_objective_plan.objective_id and p.ended_on is null;

  if current_plan.id is distinct from set_objective_plan.plan_id then
    if current_plan.id is not null then
      if set_objective_plan.plan_id is null then
        update public.workout_plans p set objective_id = null where p.id = current_plan.id;
      else
        update public.workout_plans p
        set ended_on = greatest(current_plan.started_on, set_objective_plan.today - 1)
        where p.id = current_plan.id;
      end if;
    end if;

    if set_objective_plan.plan_id is not null then
      update public.workout_plans p
      set objective_id = set_objective_plan.objective_id
      where p.id = set_objective_plan.plan_id and p.objective_id is null and p.ended_on is null;
      if not found then
        raise exception 'Plan is not free' using errcode = 'foreign_key_violation';
      end if;
    end if;
  end if;

  if set_objective_plan.plan_id is null then
    return;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(set_objective_plan.schedule) s
    where (s.value ->> 'weekday')::smallint <> all (objective_weekdays)
  ) then
    raise exception 'Schedule weekday outside the objective weekdays' using errcode = 'check_violation';
  end if;

  delete from public.workout_schedule s where s.plan_id = set_objective_plan.plan_id;
  -- The composite FK (workout_id, plan_id, user_id) refuses a workout of another plan.
  insert into public.workout_schedule (plan_id, weekday, workout_id)
  select set_objective_plan.plan_id, (s.value ->> 'weekday')::smallint, (s.value ->> 'workout_id')::uuid
  from jsonb_array_elements(set_objective_plan.schedule) s;
end;
$$;

revoke execute on function public.set_objective_plan(uuid, date, uuid, jsonb) from public, anon;
grant execute on function public.set_objective_plan(uuid, date, uuid, jsonb) to authenticated;
