import { Suspense } from "react";
import { SkeletonForm } from "@/app/components/Skeleton";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/components/BackLink";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getLinkableGoals } from "../../../goals/data";
import { getAlternativeOptions, getGymFormContext } from "../../data";
import { getUserToday } from "@/app/utils/dates";
import { getUserTimezone } from "../../../dashboard/day-objectives";
import {
  archiveObjective,
  deleteObjective,
  unarchiveObjective,
  updateObjective,
} from "../../actions";
import { ObjectiveActionsPanel } from "../../objective-actions-panel";
import { ObjectiveForm } from "../../objective-form";
import styles from "../../objectives.module.css";

export default function EditObjectivePage({ params, searchParams }: PageProps<"/objectives/[id]/edit">) {
  return (
    <main className={styles.content}>
      <Suspense fallback={<SkeletonForm />}>
        <EditObjective params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function EditObjective({
  params,
  searchParams,
}: Pick<PageProps<"/objectives/[id]/edit">, "params" | "searchParams">) {
  const [{ id }, { plan: requestedPlan }] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const today = getUserToday(await getUserTimezone(supabase, user.id));
  // An invalid uuid makes Postgres error out; treat it like a missing row.
  const { data: objective } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!objective) notFound();
  const [{ goals, linkedIds }, alternatives, gym] = await Promise.all([
    getLinkableGoals(supabase, id),
    getAlternativeOptions(supabase, id),
    getGymFormContext(supabase, today, id),
  ]);

  return (
    <>
      <BackLink href={`/objectives/${id}`} label={objective.title} />
      <h1 className={styles.title}>Editar objetivo</h1>
      <ObjectiveForm
        action={updateObjective.bind(null, id)}
        objective={objective}
        goals={goals}
        linkedGoalIds={linkedIds}
        alternatives={alternatives.options}
        alternativeIds={alternatives.linkedIds}
        gym={gym}
        // "Nova ficha a partir desta" lands here with the new plan picked, to confirm each day's workout.
        initialPlanId={
          typeof requestedPlan === "string" && gym.plans.some((plan) => plan.id === requestedPlan)
            ? requestedPlan
            : undefined
        }
        submitLabel="Salvar"
      />
      <ObjectiveActionsPanel
        archived={Boolean(objective.archived_at)}
        archiveAction={archiveObjective.bind(null, id)}
        unarchiveAction={unarchiveObjective.bind(null, id)}
        deleteAction={deleteObjective.bind(null, id)}
      />
    </>
  );
}
