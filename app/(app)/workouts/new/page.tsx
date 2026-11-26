import { cookies } from "next/headers";
import { Suspense } from "react";
import { BackLink } from "@/app/components/BackLink";
import { SkeletonForm } from "@/app/components/Skeleton";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../../dashboard/day-objectives";
import ui from "../../objectives/objectives.module.css";
import { createPlan } from "../actions";
import { getGymObjectives, getPlan, toCopySource, type CopySource } from "../data";
import { PlanForm } from "../plan-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function NewPlanPage({ searchParams }: PageProps<"/workouts/new">) {
  return (
    <main className={ui.content}>
      <BackLink href="/workouts" label="Treinos" />
      <h1 className={ui.title}>Nova ficha</h1>
      <Suspense fallback={<SkeletonForm />}>
        <NewPlanForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function NewPlanForm({ searchParams }: Pick<PageProps<"/workouts/new">, "searchParams">) {
  const params = await searchParams;
  const from = typeof params.from === "string" && UUID.test(params.from) ? params.from : null;
  const preselected =
    typeof params.objective === "string" && UUID.test(params.objective) ? params.objective : null;
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [objectives, timezone] = await Promise.all([
    getGymObjectives(supabase),
    getUserTimezone(supabase, user.id),
  ]);
  const today = getUserToday(timezone);

  const sourceIds = new Set(objectives.flatMap((objective) => (objective.activePlan ? [objective.activePlan.id] : [])));
  if (from) sourceIds.add(from);
  const plans = await Promise.all([...sourceIds].map((id) => getPlan(supabase, id)));
  const copySources: Record<string, CopySource> = {};
  for (const plan of plans) {
    if (plan && !plan.endedOn) copySources[plan.id] = toCopySource(plan);
  }
  const fromPlan = from ? copySources[from] : undefined;
  const fromObjectiveId = plans.find((plan) => plan?.id === from)?.objectiveId ?? null;
  const objectiveId = fromPlan
    ? fromObjectiveId
    : objectives.some((objective) => objective.id === preselected)
      ? preselected
      : null;

  return (
    <PlanForm
      mode="create"
      action={createPlan.bind(null, fromPlan ? fromPlan.id : null)}
      objectives={objectives}
      today={today}
      copySources={copySources}
      sourcePlanId={fromPlan?.id ?? null}
      initial={{ title: "", startedOn: today, objectiveId, workouts: [] }}
    />
  );
}
