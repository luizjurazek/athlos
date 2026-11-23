import { ForgotPasswordForm } from "../forms";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Recuperar senha</h1>
        <p className={styles.subtitle}>Enviaremos um link para você definir uma nova senha.</p>
      </header>
      <ForgotPasswordForm />
    </>
  );
}
