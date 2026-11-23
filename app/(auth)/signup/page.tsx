import { SignupForm } from "../forms";
import styles from "../auth.module.css";

export default function SignupPage() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Criar sua conta</h1>
        <p className={styles.subtitle}>Leva menos de um minuto.</p>
      </header>
      <SignupForm />
    </>
  );
}
