import { SignupForm } from "../forms";
import styles from "../auth.module.css";

export default function SignupPage() {
  return (
    <>
      <h1 className={styles.title}>Criar conta</h1>
      <SignupForm />
    </>
  );
}
