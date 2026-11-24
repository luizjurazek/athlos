import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/components/BackLink";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import {
  archiveObjective,
  deleteObjective,
  unarchiveObjective,
  updateObjective,
} from "../../actions";
import { ObjectiveActionsPanel } from "../../objective-actions-panel";
import { ObjectiveForm } from "../../objective-form";
import styles from "../../objectives.module.css";

export default function EditObjectivePage({ params }: PageProps<"/objectives/[id]/edit">) {
  return (
    <main className={styles.content}>
      <BackLink href="/objectives" label="Objetivos" />
      <h1 className={styles.title}>Editar objetivo</h1>
      <Suspense fallback={<p className={styles.muted}>Carregando...</p>}>
        <EditObjective params={params} />
      </Suspense>
    </main>
  );
}

async function EditObjective({ params }: Pick<PageProps<"/objectives/[id]/edit">, "params">) {
  const { id } = await params;
  await requireUser();
  const supabase = createClient(await cookies());
  // An invalid uuid makes Postgres error out; treat it like a missing row.
  const { data: objective } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!objective) notFound();

  return (
    <>
      <ObjectiveForm
        action={updateObjective.bind(null, id)}
        objective={objective}
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
