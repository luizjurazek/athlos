import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/components/BackLink";
import { LoadingStatus, SkeletonCard, SkeletonList } from "@/app/components/Skeleton";
import { formatDayMonth, formatNumericDate, getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatKg, formatLoad, getLoadOn, sameLoad } from "@/app/utils/workout-loads";
import { getUserTimezone } from "../../../dashboard/day-objectives";
import ui from "../../../objectives/objectives.module.css";
import { getExerciseEvolution, type EvolutionVersion } from "../../data";
import { ExerciseImage } from "../../exercise-image";
import { LoadChart } from "../../load-chart";
import styles from "../../workouts.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ExerciseEvolutionPage({ params }: PageProps<"/workouts/exercises/[exerciseId]">) {
  return (
    <main className={ui.content}>
      <Suspense
        fallback={
          <>
            <LoadingStatus />
            <SkeletonCard lines={2} />
            <SkeletonCard height="calc(var(--space-12) * 4)" />
            <SkeletonList rows={3} badge={false} />
          </>
        }
      >
        <Evolution params={params} />
      </Suspense>
    </main>
  );
}

function signed(value: number, unit: (amount: number) => string) {
  return `${value > 0 ? "+" : "−"}${unit(Math.abs(value))}`;
}

function describeChange(version: EvolutionVersion, previous: EvolutionVersion | undefined) {
  if (!previous) return "Primeira carga";
  if (version.planStart && sameLoad(version, previous)) return `Início da ${version.planTitle}, sem mudança`;
  const parts: string[] = [];
  if (version.loadKg != null && previous.loadKg != null && version.loadKg !== previous.loadKg) {
    parts.push(signed(version.loadKg - previous.loadKg, formatKg));
  } else if (version.loadKg !== previous.loadKg) {
    parts.push(version.loadKg == null ? "peso corporal" : "com carga");
  }
  if (version.reps !== previous.reps) {
    parts.push(signed(version.reps - previous.reps, (amount) => `${amount} ${amount === 1 ? "rep" : "reps"}`));
  }
  if (version.sets !== previous.sets) {
    parts.push(signed(version.sets - previous.sets, (amount) => `${amount} ${amount === 1 ? "série" : "séries"}`));
  }
  const change = parts.join(" · ") || "sem mudança";
  return version.planStart ? `${change} · início da ${version.planTitle}` : change;
}

async function Evolution({ params }: Pick<PageProps<"/workouts/exercises/[exerciseId]">, "params">) {
  const { exerciseId } = await params;
  if (!UUID.test(exerciseId)) notFound();
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [evolution, timezone] = await Promise.all([
    getExerciseEvolution(supabase, exerciseId),
    getUserTimezone(supabase, user.id),
  ]);
  if (!evolution) notFound();
  const today = getUserToday(timezone);
  const { versions } = evolution;
  const { current, previous } = getLoadOn(versions, today);
  const changes = versions.filter((version, index) => index === 0 || !sameLoad(version, versions[index - 1]));
  const weighted = versions.filter((version) => version.loadKg != null);
  const workoutName = `Treino ${evolution.workout.label}${evolution.workout.description ? ` · ${evolution.workout.description}` : ""}`;

  return (
    <>
      <BackLink href={`/workouts/${evolution.plan.id}/${evolution.workout.id}`} label={workoutName} />
      <div className={styles.workoutHeader}>
        <ExerciseImage src={evolution.imageUrl} size="md" />
        <div>
          <h1 className={ui.title}>{evolution.name}</h1>
          <p className={styles.planMeta}>
            <span>Evolução · {evolution.plan.title}</span>
            {evolution.archived && (
              <span className={styles.pill} data-tone="muted">
                removido
              </span>
            )}
          </p>
        </div>
      </div>

      {current && (
        <div className={styles.loadStats}>
          <div className={styles.loadStat} data-current="true">
            <span className={styles.loadStatLabel}>Atual</span>
            <span className={styles.loadStatValue}>{formatLoad(current)}</span>
            <span className={styles.loadStatMeta}>desde {formatNumericDate(current.effectiveFrom)}</span>
          </div>
          {previous && !sameLoad(previous, current) && (
            <div className={styles.loadStat}>
              <span className={styles.loadStatLabel}>Anterior</span>
              <span className={styles.loadStatValue}>{formatLoad(previous)}</span>
              <span className={styles.loadStatMeta}>de {formatDayMonth(previous.effectiveFrom)}</span>
            </div>
          )}
        </div>
      )}

      {changes.length <= 1 ? (
        <p className={ui.empty}>Sem alterações ainda.</p>
      ) : (
        <section className={ui.section} aria-labelledby="chart-title">
          <h2 id="chart-title" className={ui.sectionTitle}>
            Carga (kg)
          </h2>
          {weighted.length >= 2 ? (
            <div className={styles.chartCard}>
              <LoadChart versions={versions} today={today} />
            </div>
          ) : (
            <p className={ui.hint}>Peso corporal: a evolução fica nas séries e repetições da lista.</p>
          )}
        </section>
      )}

      {versions.length > 0 && (
        <section className={ui.section} aria-labelledby="versions-title">
          <h2 id="versions-title" className={ui.sectionTitle}>
            Alterações
          </h2>
          <ul className={`${ui.list} ${styles.list}`}>
            {versions
              .map((version, index) => ({ version, previous: versions[index - 1] }))
              .reverse()
              .map(({ version, previous: before }) => (
                <li key={`${version.exerciseId}-${version.effectiveFrom}`} className={styles.versionRow}>
                  <span className={styles.versionDate}>{formatNumericDate(version.effectiveFrom)}</span>
                  <span className={ui.rowText}>
                    <span className={styles.loadLine}>{formatLoad(version)}</span>
                    <span className={ui.rowMeta}>{describeChange(version, before)}</span>
                  </span>
                  {version === current && (
                    <span className={styles.pill}>atual</span>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </>
  );
}
