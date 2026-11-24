-- RN-13 to RN-15: one occurrence of an objective moved from a scheduled day to another day.
create table public.objective_reschedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  objective_id uuid not null,
  from_day date not null,
  to_day date not null,
  created_at timestamptz not null default now(),
  constraint objective_reschedules_objective_id_from_day_key unique (objective_id, from_day),
  constraint objective_reschedules_objective_id_to_day_key unique (objective_id, to_day),
  constraint objective_reschedules_days_differ check (from_day <> to_day),
  constraint objective_reschedules_objective_fkey foreign key (objective_id, user_id)
    references public.objectives (id, user_id) on delete cascade
);

create index objective_reschedules_user_id_to_day_idx on public.objective_reschedules (user_id, to_day);
create index objective_reschedules_user_id_from_day_idx on public.objective_reschedules (user_id, from_day);

alter table public.objective_reschedules enable row level security;

create policy "Users can view their own reschedules"
  on public.objective_reschedules for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can reschedule their own reschedulable objectives"
  on public.objective_reschedules for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.objectives o
      where o.id = objective_id
        and o.user_id = (select auth.uid())
        and o.reschedulable
    )
  );

create policy "Users can delete their own reschedules"
  on public.objective_reschedules for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on table public.objective_reschedules to authenticated;

-- Reschedule and, optionally, check the destination in one transaction ("Mudar e marcar feito").
create function public.reschedule_objective(
  objective_id uuid,
  from_day date,
  to_day date,
  mark_done boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reschedule_id uuid;
begin
  insert into public.objective_reschedules (objective_id, from_day, to_day)
  values (reschedule_objective.objective_id, reschedule_objective.from_day, reschedule_objective.to_day)
  returning id into reschedule_id;

  if mark_done then
    insert into public.objective_checks (objective_id, day)
    values (reschedule_objective.objective_id, reschedule_objective.to_day);
  end if;

  return reschedule_id;
end;
$$;

revoke execute on function public.reschedule_objective(uuid, date, date, boolean) from public, anon;
grant execute on function public.reschedule_objective(uuid, date, date, boolean) to authenticated;
