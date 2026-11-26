import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/components/BackLink";
import { SkeletonForm } from "@/app/components/Skeleton";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../../../dashboard/day-objectives";
import ui from "../../../objectives/objectives.module.css";
import { updatePlan } from "../../actions";
import { getGymObjectives, getPlan, getWorkoutsWithHistory } from "../../data";
import { PlanForm } from "../../plan-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditPlanPage({ params }: PageProps<"/workouts/[id]/edit">) {
  return (
    <main className={ui.content}>
      <Suspense fallback={<SkeletonForm />}>
        <EditPlan params={params} />
      </Suspense>
    </main>
  );
}

async function EditPlan({ params }: Pick<PageProps<"/workouts/[id]/edit">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [plan, objectives, timezone] = await Promise.all([
    getPlan(supabase, id),
    getGymObjectives(supabase),
    getUserTimezone(supabase, user.id),
  ]);
  if (!plan) notFound();
  if (plan.endedOn) redirect(`/workouts/${id}`);
  const today = getUserToday(timezone);
  const locked = await getWorkoutsWithHistory(
    supabase,
    plan.workouts.map((workout) => workout.id),
    today,
  );

  return (
    <>
      <BackLink href={`/workouts/${id}`} label={plan.title} />
      <h1 className={ui.title}>Editar ficha</h1>
      <PlanForm
        mode="edit"
        action={updatePlan.bind(null, id)}
        objectives={objectives}
        today={today}
        planId={id}
        lockedWorkoutIds={[...locked]}
        hasSchedule={plan.schedule.length > 0}
        initial={{
          title: plan.title,
          startedOn: plan.startedOn,
          objectiveId: plan.objectiveId,
          workouts: plan.workouts,
        }}
      />
    </>
  );
}
