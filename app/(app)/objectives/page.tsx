import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays } from "@/app/utils/weekdays";
import { ObjectiveBadge } from "./objective-badge";
import type { Objective } from "./options";
import styles from "./objectives.module.css";

export default function ObjectivesPage() {
  return (
    <main className={styles.content}>
      <h1 className={styles.title}>Objetivos</h1>
      <Suspense fallback={<p className={styles.muted}>Carregando...</p>}>
        <ObjectivesList />
      </Suspense>
    </main>
  );
}

async function ObjectivesList() {
  await requireUser();
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("objectives")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load objectives", error);
    return <p className={styles.error}>Não foi possível carregar seus objetivos.</p>;
  }

  const active = data.filter((objective) => !objective.archived_at);
  const archived = data.filter((objective) => objective.archived_at);

  return (
    <>
      <section className={styles.section}>
        {active.length > 0 ? (
          <ObjectiveRows objectives={active} />
        ) : (
          <p className={styles.empty}>
            Nenhum objetivo ainda. Crie o primeiro para montar sua rotina.
          </p>
        )}
        <Link className={styles.button} href="/objectives/new">
          Novo objetivo
        </Link>
      </section>

      {archived.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Arquivados</h2>
          <ObjectiveRows objectives={archived} />
        </section>
      )}
    </>
  );
}

function ObjectiveRows({ objectives }: { objectives: Objective[] }) {
  return (
    <ul className={styles.list}>
      {objectives.map((objective) => (
        <li key={objective.id}>
          <Link className={styles.row} href={`/objectives/${objective.id}/edit`}>
            <ObjectiveBadge color={objective.color} icon={objective.icon} />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{objective.title}</span>
              <span className={styles.rowMeta}>
                {formatWeekdays(objective.weekdays)}
                {objective.reschedulable && " · Pode mudar de dia"}
              </span>
            </span>
            <svg className={styles.rowChevron} viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}
