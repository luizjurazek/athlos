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
import { getPlan, toCopySource } from "../data";
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
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [source, timezone] = await Promise.all([
    from ? getPlan(supabase, from) : null,
    getUserTimezone(supabase, user.id),
  ]);
  const copySource = source ? toCopySource(source) : null;

  return (
    <PlanForm
      mode="create"
      action={createPlan.bind(null, copySource?.id ?? null)}
      copySource={copySource}
      initial={{ title: "", startedOn: getUserToday(timezone), workouts: [] }}
    />
  );
}
