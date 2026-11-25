-- Stage targets become cumulative milestones of the goal (6 books -> 12 books): a stage's target is
-- the total to reach since the goal start, and its progress counts everything since the goal start
-- through the end of its window, so progress carries over from one stage to the next.

-- Existing stages held per-window targets; their running sum keeps the same plan in the new model.
-- Goals whose targets already increase stage by stage were saved by the cumulative form (or have a
-- single stage, where nothing changes), so only goals with a non-increasing step are converted.
update public.goal_stage_targets t
set target_count = running.total
from (
  select
    t2.stage_id,
    t2.objective_id,
    sum(t2.target_count) over (
      partition by t2.goal_id, t2.objective_id
      order by s.position
    ) as total
  from public.goal_stage_targets t2
  join public.goal_stages s on s.id = t2.stage_id
) running
where running.stage_id = t.stage_id
  and running.objective_id = t.objective_id
  and t.goal_id in (
    select goal_id
    from (
      select
        goal_id,
        target_count,
        lag(target_count) over (partition by goal_id order by position) as previous
      from public.goal_stages
    ) steps
    where target_count <= previous
  );

update public.goal_stages s
set target_count = coalesce(per_objective.total, running.total)
from (
  select id, sum(target_count) over (partition by goal_id order by position) as total
  from public.goal_stages
) running
left join (
  select stage_id, sum(target_count) as total
  from public.goal_stage_targets
  group by stage_id
) per_objective on per_objective.stage_id = running.id
where running.id = s.id
  and s.goal_id in (
    select goal_id
    from (
      select
        goal_id,
        target_count,
        lag(target_count) over (partition by goal_id order by position) as previous
      from public.goal_stages
    ) steps
    where target_count <= previous
  );

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
    g.starts_on as goal_start,
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
        and e.day between w.goal_start and w.window_end
    )
    else (
      select count(distinct c.id)
      from public.goal_objectives go
      join public.objective_checks c on c.objective_id = go.objective_id
      where go.goal_id = w.goal_id
        and c.day between w.goal_start and w.window_end
    )
  end::integer as checks_count,
  w.window_end
from windows w;

create or replace view public.goal_stage_objective_progress
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
      and c.day between g.starts_on and p.window_end
  )::integer as checks_count
from public.goal_stage_targets t
join public.goal_stage_progress p on p.stage_id = t.stage_id
join public.goals g on g.id = t.goal_id;
