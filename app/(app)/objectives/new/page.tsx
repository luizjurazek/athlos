import { Suspense } from "react";
import { SkeletonForm } from "@/app/components/Skeleton";
import { cookies } from "next/headers";
import { createClient } from "@/app/utils/supabase/server";
import { getLinkableGoals } from "../../goals/data";
import { getAlternativeOptions, getGymFormContext } from "../data";
import { requireUser } from "@/app/utils/supabase/user";
import { createObjective } from "../actions";
import { ObjectiveForm } from "../objective-form";
import { BackLink } from "@/app/components/BackLink";
import styles from "../objectives.module.css";

export default function NewObjectivePage() {
  return (
    <main className={styles.content}>
      <BackLink href="/objectives" label="Objetivos" />
      <h1 className={styles.title}>Novo objetivo</h1>
      <Suspense fallback={<SkeletonForm />}>
        <NewObjectiveForm />
      </Suspense>
    </main>
  );
}

async function NewObjectiveForm() {
  await requireUser();
  const supabase = createClient(await cookies());
  const [{ goals }, alternatives, gym] = await Promise.all([
    getLinkableGoals(supabase),
    getAlternativeOptions(supabase),
    getGymFormContext(supabase),
  ]);
  return (
    <ObjectiveForm
      action={createObjective}
      goals={goals}
      alternatives={alternatives.options}
      gym={gym}
      submitLabel="Criar objetivo"
    />
  );
}
