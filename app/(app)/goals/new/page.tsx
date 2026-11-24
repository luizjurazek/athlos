import { Suspense } from "react";
import { cookies } from "next/headers";
import { BackLink } from "@/app/components/BackLink";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../../dashboard/day-objectives";
import ui from "../../objectives/objectives.module.css";
import { saveGoal } from "../actions";
import { getSelectableObjectives } from "../data";
import { GoalForm } from "../goal-form";

export default function NewGoalPage() {
  return (
    <main className={ui.content}>
      <BackLink href="/goals" label="Metas" />
      <h1 className={ui.title}>Nova meta</h1>
      <Suspense fallback={<p className={ui.muted}>Carregando...</p>}>
        <NewGoalForm />
      </Suspense>
    </main>
  );
}

async function NewGoalForm() {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [objectives, timezone] = await Promise.all([
    getSelectableObjectives(supabase),
    getUserTimezone(supabase, user.id),
  ]);
  return (
    <GoalForm
      action={saveGoal.bind(null, null)}
      objectives={objectives}
      today={getUserToday(timezone)}
      submitLabel="Salvar meta"
    />
  );
}
