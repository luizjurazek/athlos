import { Suspense } from "react";
import { LoginForm } from "../forms";
import styles from "../auth.module.css";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Entrar no Athlos</h1>
        <p className={styles.subtitle}>Use seu email e senha para continuar.</p>
      </header>
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithError searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginFormWithError({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  return <LoginForm initialError={typeof error === "string" ? error : undefined} />;
}
