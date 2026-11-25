import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/app/utils/supabase/server";
import { getGoals, syncGoalStatuses } from "../goals/data";
import { GoalCard, toGoalCard } from "../goals/goal-card";
import { QuickEntryGoal } from "./quick-entry-goal";
import styles from "./dashboard.module.css";

export async function GoalsSummary({ today }: { today: string }) {
  const supabase = createClient(await cookies());
  let goals;
  try {
    goals = await syncGoalStatuses(supabase, await getGoals(supabase), today);
  } catch (error) {
    console.error("Failed to load goals for today", error);
    return null;
  }

  const active = goals.filter((goal) => goal.status === "active");
  if (active.length === 0) return null;

  return (
    <section className={styles.goals} aria-labelledby="active-goals-title">
      <div className={styles.goalsHeader}>
        <h2 id="active-goals-title" className={styles.sectionTitle}>
          Metas ativas
        </h2>
        <Link className={styles.goalsLink} href="/goals">
          Ver todas
        </Link>
      </div>
      <ul className={styles.goalsList}>
        {active.map((goal) => {
          const card = toGoalCard(goal, today);
          return (
            <li key={goal.id}>
              {card.quickEntry ? (
                <QuickEntryGoal card={card} />
              ) : (
                <GoalCard card={card} showObjectives={false} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
