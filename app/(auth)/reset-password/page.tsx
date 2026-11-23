import { Suspense } from "react";
import { requireUser } from "@/utils/supabase/user";
import { ResetPasswordForm } from "../forms";
import styles from "../auth.module.css";

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className={styles.title}>Definir nova senha</h1>
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
