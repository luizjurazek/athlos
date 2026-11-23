import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  return (
    <main className={styles.content}>
      {/* Session reads happen at request time, so they stream in behind Suspense. */}
      <Suspense fallback={<p className={styles.muted}>Carregando...</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}

async function DashboardContent() {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return <h1 className={styles.title}>Olá, {profile?.full_name || user.email}</h1>;
}
