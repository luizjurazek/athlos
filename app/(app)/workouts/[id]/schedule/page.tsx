import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/components/BackLink";
import { LoadingStatus, SkeletonList } from "@/app/components/Skeleton";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays, normalizeWeekdays } from "@/app/utils/weekdays";
import ui from "../../../objectives/objectives.module.css";
import { getPlan } from "../../data";
import { ScheduleEditor } from "../../schedule-editor";
import styles from "../../workouts.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SchedulePage({ params }: PageProps<"/workouts/[id]/schedule">) {
  return (
    <main className={ui.content}>
      <Suspense
        fallback={
          <>
            <LoadingStatus />
            <SkeletonList rows={7} badge={false} />
          </>
        }
      >
        <Schedule params={params} />
      </Suspense>
    </main>
  );
}

async function Schedule({ params }: Pick<PageProps<"/workouts/[id]/schedule">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await requireUser();
  const supabase = createClient(await cookies());
  const plan = await getPlan(supabase, id);
  if (!plan) notFound();
  if (plan.endedOn || !plan.objectiveId || !plan.objectiveWeekdays) redirect(`/workouts/${id}`);

  return (
    <>
      <BackLink href={`/workouts/${id}`} label={plan.title} />
      <div>
        <h1 className={ui.title}>Agenda</h1>
        <p className={styles.subtitle}>
          Dias da {plan.objectiveTitle}: {formatWeekdays(plan.objectiveWeekdays).toLowerCase()}
        </p>
      </div>
      <ScheduleEditor
        planId={plan.id}
        planTitle={plan.title}
        objectiveTitle={plan.objectiveTitle ?? "Academia"}
        weekdays={normalizeWeekdays(plan.objectiveWeekdays)}
        workouts={plan.workouts}
        schedule={plan.schedule}
      />
    </>
  );
}
