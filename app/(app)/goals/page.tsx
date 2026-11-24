import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../dashboard/day-objectives";
import ui from "../objectives/objectives.module.css";
import { getGoals, syncGoalStatuses, type Goal } from "./data";
import { toGoalCard } from "./goal-card";
import { GoalTabs } from "./goal-tabs";
import styles from "./goals.module.css";

export default function GoalsPage() {
  return (
    <main className={ui.content}>
      <header className={ui.header}>
        <h1 className={ui.title}>Metas</h1>
        <NewGoalLink className={ui.headerAction} />
      </header>
      <Suspense fallback={<p className={ui.muted}>Carregando...</p>}>
        <GoalsList />
      </Suspense>
    </main>
  );
}

function NewGoalLink({ className }: { className: string }) {
  return (
    <Link className={`${ui.button} ${styles.newGoal} ${className}`} href="/goals/new">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      Nova meta
    </Link>
  );
}

async function GoalsList() {
  const user = await requireUser();
  const supabase = createClient(await cookies());

  let goals: Goal[];
  let today: string;
  try {
    [goals, today] = await Promise.all([
      getGoals(supabase),
      getUserTimezone(supabase, user.id).then((timezone) => getUserToday(timezone)),
    ]);
  } catch (error) {
    console.error("Failed to load goals", error);
    return <p className={ui.error}>Não foi possível carregar suas metas.</p>;
  }

  const synced = await syncGoalStatuses(supabase, goals, today);
  const cards = synced.map((goal) => toGoalCard(goal, today));
  return (
    <>
      <GoalTabs
        active={cards.filter((card) => card.status === "active")}
        completed={cards.filter((card) => card.status === "completed")}
        closed={cards.filter((card) => card.status === "expired" || card.status === "abandoned")}
      />
      <NewGoalLink className={ui.bottomAction} />
    </>
  );
}
