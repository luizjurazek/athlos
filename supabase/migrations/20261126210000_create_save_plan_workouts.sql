-- Replaces a plan's workouts in one transaction, positioned by array order, so reordering and
-- swapping labels pass through the deferred uniques. Workouts missing from the list are deleted;
-- the Server Action refuses that for workouts with history (RN-26) before calling this.
--   workouts: [{ "id": uuid | null, "label": "A", "description": "Peito" }]
create function public.save_plan_workouts(plan_id uuid, workouts jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  workout jsonb;
  workout_position integer;
  workout_id uuid;
begin
  delete from public.workouts w
  where w.plan_id = save_plan_workouts.plan_id
    and w.id not in (
      select (item ->> 'id')::uuid
      from jsonb_array_elements(save_plan_workouts.workouts) item
      where item ->> 'id' is not null
    );

  for workout, workout_position in
    select item.value, item.ordinality
    from jsonb_array_elements(save_plan_workouts.workouts) with ordinality item
  loop
    workout_id := (workout ->> 'id')::uuid;
    if workout_id is null then
      insert into public.workouts (plan_id, label, description, position)
      values (
        save_plan_workouts.plan_id,
        upper(btrim(workout ->> 'label')),
        nullif(btrim(workout ->> 'description'), ''),
        workout_position
      );
    else
      update public.workouts w
      set
        label = upper(btrim(workout ->> 'label')),
        description = nullif(btrim(workout ->> 'description'), ''),
        position = workout_position
      where w.id = workout_id and w.plan_id = save_plan_workouts.plan_id;
      if not found then
        raise exception 'Workout % is not in plan %', workout_id, save_plan_workouts.plan_id
          using errcode = 'foreign_key_violation';
      end if;
    end if;
  end loop;
end;
$$;

revoke execute on function public.save_plan_workouts(uuid, jsonb) from public, anon;
grant execute on function public.save_plan_workouts(uuid, jsonb) to authenticated;
