import { Suspense } from "react";
import { cookies } from "next/headers";
import { logout } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import styles from "./settings.module.css";

export default function SettingsPage() {
  return (
    <main className={styles.content}>
      <h1 className={styles.title}>Ajustes</h1>
      <div className={styles.columns}>
        <Suspense fallback={<p className={styles.muted}>Carregando...</p>}>
          <AccountSection />
        </Suspense>
        <div className={styles.column}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Aparência</h2>
            <ul className={styles.group}>
              <li className={styles.row}>
                <span>Tema claro / escuro</span>
                <ThemeToggle />
              </li>
            </ul>
          </section>
          <form action={logout} className={styles.section}>
            <div className={styles.group}>
              <button className={styles.logout} type="submit">
                Sair
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

async function AccountSection() {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
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
  );
}
