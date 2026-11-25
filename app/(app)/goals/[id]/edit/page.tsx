import { Suspense } from "react";
import { SkeletonForm } from "@/app/components/Skeleton";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/components/BackLink";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../../../dashboard/day-objectives";
import ui from "../../../objectives/objectives.module.css";
import { abandonGoal, saveGoal } from "../../actions";
import { getGoal, getObjectiveChecks, getSelectableObjectives } from "../../data";
import { AbandonGoalPanel } from "../../abandon-goal-panel";
import { GoalForm } from "../../goal-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditGoalPage({ params }: PageProps<"/goals/[id]/edit">) {
  return (
    <main className={ui.content}>
      <Suspense fallback={<SkeletonForm />}>
        <EditGoal params={params} />
      </Suspense>
    </main>
  );
}

async function EditGoal({ params }: Pick<PageProps<"/goals/[id]/edit">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const goal = await getGoal(supabase, id);
  if (!goal) notFound();

  const [objectives, timezone] = await Promise.all([
    getSelectableObjectives(
      supabase,
      goal.objectives.map((objective) => objective.id),
    ),
    getUserTimezone(supabase, user.id),
  ]);
  const today = getUserToday(timezone);
  // Linking an objective later recounts its past checks, so every selectable one gets a count.
  const checks = await getObjectiveChecks(
    supabase,
    objectives.map((objective) => objective.id),
    goal.startsOn,
    today,
  );
  const doneByObjective: Record<string, number> = {};
  for (const check of checks) {
    doneByObjective[check.objectiveId] = (doneByObjective[check.objectiveId] ?? 0) + 1;
  }

  return (
    <>
      <BackLink href={`/goals/${id}`} label={goal.title} />
      <h1 className={ui.title}>Editar meta</h1>
      <GoalForm
        action={saveGoal.bind(null, id)}
        goal={goal}
        objectives={objectives}
        doneByObjective={doneByObjective}
        today={today}
        submitLabel="Salvar meta"
      />
      {goal.status === "active" && <AbandonGoalPanel action={abandonGoal.bind(null, id)} />}
    </>
  );
}
