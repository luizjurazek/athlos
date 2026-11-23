import { Suspense } from "react";
import { requireUser } from "@/app/utils/supabase/user";
import { ResetPasswordForm } from "../forms";
import styles from "../auth.module.css";

export default function ResetPasswordPage() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Definir nova senha</h1>
        <p className={styles.subtitle}>Escolha uma senha com pelo menos 8 caracteres.</p>
      </header>
      <Suspense fallback={<p className={styles.subtitle}>Carregando...</p>}>
        <ResetPasswordGate />
      </Suspense>
    </>
  );
}

async function ResetPasswordGate() {
  // The recovery link creates a session in /auth/confirm before landing here.
  await requireUser();
  return <ResetPasswordForm />;
}
