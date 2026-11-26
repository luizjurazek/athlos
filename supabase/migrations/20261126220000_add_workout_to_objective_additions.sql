-- RN-35: a gym extra or swap picks its workout in the same sheet; the choice becomes the day's
-- session, written in the same transaction as the addition (and the optional check).
drop function public.add_objective_to_day(uuid, date, uuid, boolean);

create function public.add_objective_to_day(
  objective_id uuid,
  day date,
  replaced_objective_id uuid default null,
  mark_done boolean default false,
  workout_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  addition_id uuid;
  objective_activity public.activity_type;
begin
  insert into public.objective_additions (objective_id, day, replaced_objective_id)
  values (
    add_objective_to_day.objective_id,
    add_objective_to_day.day,
    add_objective_to_day.replaced_objective_id
  )
  returning id into addition_id;

  if add_objective_to_day.workout_id is not null then
    select o.activity_type into objective_activity
    from public.objectives o
    where o.id = add_objective_to_day.objective_id;
    if objective_activity is null then
      raise exception 'Only activity objectives have sessions' using errcode = 'check_violation';
    end if;

    insert into public.activity_sessions (objective_id, day, activity_type, workout_id)
    values (
      add_objective_to_day.objective_id,
      add_objective_to_day.day,
      objective_activity,
      add_objective_to_day.workout_id
    )
    on conflict on constraint activity_sessions_objective_id_day_key
    do update set workout_id = excluded.workout_id;
  end if;

  if mark_done then
    insert into public.objective_checks (objective_id, day)
    values (add_objective_to_day.objective_id, add_objective_to_day.day);
  end if;

  return addition_id;
end;
$$;

revoke execute on function public.add_objective_to_day(uuid, date, uuid, boolean, uuid) from public, anon;
grant execute on function public.add_objective_to_day(uuid, date, uuid, boolean, uuid) to authenticated;
