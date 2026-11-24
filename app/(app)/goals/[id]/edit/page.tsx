import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/components/BackLink";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../../../dashboard/day-objectives";
import ui from "../../../objectives/objectives.module.css";
import { abandonGoal, saveGoal } from "../../actions";
import { getGoal, getSelectableObjectives } from "../../data";
import { AbandonGoalPanel } from "../../abandon-goal-panel";
import { GoalForm } from "../../goal-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditGoalPage({ params }: PageProps<"/goals/[id]/edit">) {
  return (
    <main className={ui.content}>
      <Suspense fallback={<p className={ui.muted}>Carregando...</p>}>
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

  return (
    <>
      <BackLink href={`/goals/${id}`} label={goal.title} />
      <h1 className={ui.title}>Editar meta</h1>
      <GoalForm
        action={saveGoal.bind(null, id)}
        goal={goal}
        objectives={objectives}
        today={getUserToday(timezone)}
        submitLabel="Salvar meta"
      />
      {goal.status === "active" && <AbandonGoalPanel action={abandonGoal.bind(null, id)} />}
    </>
  );
}
