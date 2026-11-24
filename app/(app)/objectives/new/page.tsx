import { Suspense } from "react";
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
      <Suspense fallback={<p className={styles.muted}>Carregando...</p>}>
        <NewObjectiveForm />
      </Suspense>
    </main>
  );
}

async function NewObjectiveForm() {
  await requireUser();
  return <ObjectiveForm action={createObjective} submitLabel="Criar objetivo" />;
}
