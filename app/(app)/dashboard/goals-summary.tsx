import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/app/utils/supabase/server";
import { getGoals, syncGoalStatuses } from "../goals/data";
import { diffDays } from "@/app/utils/dates";
import { describeCompletion, GoalCard, getCompletedOn, toGoalCard } from "../goals/goal-card";
import { QuickEntryGoal } from "./quick-entry-goal";
import styles from "./dashboard.module.css";

/** Days a completed goal keeps showing on Hoje after the completion day. */
const CELEBRATION_DAYS = 2;

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
  // A completed goal stays on Hoje for a couple of days so the achievement gets noticed.
  const celebrated = goals.flatMap((goal) => {
    const completedOn = getCompletedOn(goal);
    if (!completedOn) return [];
    const ago = diffDays(completedOn, today);
    return ago >= 0 && ago <= CELEBRATION_DAYS
      ? [{ goal, message: describeCompletion(completedOn, today) }]
      : [];
  });
  if (active.length === 0 && celebrated.length === 0) return null;

  return (
    <section className={styles.goals} aria-labelledby="active-goals-title">
      <div className={styles.goalsHeader}>
        <h2 id="active-goals-title" className={styles.sectionTitle}>
          {celebrated.length > 0 ? "Metas" : "Metas ativas"}
        </h2>
        <Link className={styles.goalsLink} href="/goals">
          Ver todas
        </Link>
      </div>
      <ul className={styles.goalsList}>
        {celebrated.map(({ goal, message }) => (
          <li key={goal.id}>
            <GoalCard card={toGoalCard(goal, today)} showObjectives={false} celebration={message} />
          </li>
        ))}
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
