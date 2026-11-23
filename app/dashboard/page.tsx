import { Suspense } from "react";
import { cookies } from "next/headers";
import { logout } from "@/app/(auth)/actions";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.navbar}>
        <span className={styles.brand}>Athlos</span>
        <form action={logout}>
          <button className={styles.logout} type="submit">
            Sair
          </button>
        </form>
      </nav>
      <main className={styles.content}>
        {/* Session reads happen at request time, so they stream in behind Suspense. */}
        <Suspense fallback={<p className={styles.muted}>Carregando...</p>}>
          <DashboardContent />
        </Suspense>
      </main>
    </div>
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

  return (
    <>
      <h1 className={styles.title}>Olá, {profile?.full_name || user.email}</h1>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Conta</h2>
        <ul className={styles.group}>
          {profile?.full_name && (
            <li className={styles.row}>
              <span>Nome</span>
              <span className={styles.rowValue}>{profile.full_name}</span>
            </li>
          )}
          <li className={styles.row}>
            <span>Email</span>
            <span className={styles.rowValue}>{user.email}</span>
          </li>
        </ul>
      </section>
    </>
  );
}
