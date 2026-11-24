-- RN-21: objectives that may take another objective's place on a given day (e.g. Futebol -> Corrida).
create table public.objective_alternatives (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  objective_id uuid not null,
  alternative_id uuid not null,
  created_at timestamptz not null default now(),
  constraint objective_alternatives_pkey primary key (objective_id, alternative_id),
  constraint objective_alternatives_not_self check (objective_id <> alternative_id),
  constraint objective_alternatives_objective_fkey foreign key (objective_id, user_id)
    references public.objectives (id, user_id) on delete cascade,
  constraint objective_alternatives_alternative_fkey foreign key (alternative_id, user_id)
    references public.objectives (id, user_id) on delete cascade
);

create index objective_alternatives_user_id_idx on public.objective_alternatives (user_id);
create index objective_alternatives_alternative_id_idx on public.objective_alternatives (alternative_id);

alter table public.objective_alternatives enable row level security;

create policy "Users can view their own objective alternatives"
  on public.objective_alternatives for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own objective alternatives"
  on public.objective_alternatives for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own objective alternatives"
  on public.objective_alternatives for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on table public.objective_alternatives to authenticated;

-- RN-22/RN-23: an extra occurrence of an objective on one day, optionally taking another objective's place.
create table public.objective_additions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  objective_id uuid not null,
  day date not null,
  replaced_objective_id uuid,
  created_at timestamptz not null default now(),
  -- RN-14: never two occurrences of the same objective on one day.
  constraint objective_additions_objective_id_day_key unique (objective_id, day),
  -- Nulls are distinct, so this only limits substitutions: an occurrence is replaced at most once.
  constraint objective_additions_replaced_objective_id_day_key unique (replaced_objective_id, day),
  constraint objective_additions_not_self check (
    replaced_objective_id is null or replaced_objective_id <> objective_id
  ),
  constraint objective_additions_objective_fkey foreign key (objective_id, user_id)
    references public.objectives (id, user_id) on delete cascade,
  -- MATCH SIMPLE: skipped while replaced_objective_id is null.
  constraint objective_additions_replaced_objective_fkey foreign key (replaced_objective_id, user_id)
    references public.objectives (id, user_id) on delete cascade
);

create index objective_additions_user_id_day_idx on public.objective_additions (user_id, day);

alter table public.objective_additions enable row level security;

create policy "Users can view their own objective additions"
  on public.objective_additions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own objective additions"
  on public.objective_additions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own objective additions"
  on public.objective_additions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on table public.objective_additions to authenticated;

-- Add (or swap in) and, optionally, check the objective in one transaction ("Trocar e marcar feito").
create function public.add_objective_to_day(
  objective_id uuid,
  day date,
  replaced_objective_id uuid default null,
  mark_done boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  addition_id uuid;
begin
  insert into public.objective_additions (objective_id, day, replaced_objective_id)
  values (
    add_objective_to_day.objective_id,
    add_objective_to_day.day,
    add_objective_to_day.replaced_objective_id
  )
  returning id into addition_id;

  if mark_done then
    insert into public.objective_checks (objective_id, day)
    values (add_objective_to_day.objective_id, add_objective_to_day.day);
  end if;

  return addition_id;
end;
$$;

revoke execute on function public.add_objective_to_day(uuid, date, uuid, boolean) from public, anon;
grant execute on function public.add_objective_to_day(uuid, date, uuid, boolean) to authenticated;
