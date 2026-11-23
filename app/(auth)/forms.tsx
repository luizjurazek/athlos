"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  login,
  requestPasswordReset,
  signup,
  updatePassword,
  type FormState,
} from "./actions";
import styles from "./auth.module.css";

function Feedback({ state }: { state: FormState }) {
  if (state?.error) return <p className={styles.error} role="alert">{state.error}</p>;
  if (state?.message) return <p className={styles.success}>{state.message}</p>;
  return null;
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState(
    login,
    initialError ? { error: initialError } : undefined,
  );
  return (
    <>
      <form action={action} className={styles.form}>
        <Feedback state={state} />
        <label className={styles.field}>
          Email
          <input className={styles.input} name="email" type="email" autoComplete="email" required />
        </label>
        <label className={styles.field}>
          Senha
          <input className={styles.input} name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <div className={styles.links}>
        <Link href="/signup">Criar conta</Link>
        <Link href="/forgot-password">Esqueci a senha</Link>
      </div>
    </>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <>
      <form action={action} className={styles.form}>
        <Feedback state={state} />
        <label className={styles.field}>
          Nome
          <input className={styles.input} name="full_name" type="text" autoComplete="name" />
        </label>
        <label className={styles.field}>
          Email
          <input className={styles.input} name="email" type="email" autoComplete="email" required />
        </label>
        <label className={styles.field}>
          Senha
          <input className={styles.input} name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className={styles.field}>
          Confirmar senha
          <input className={styles.input} name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar conta"}
        </button>
      </form>
      <div className={styles.links}>
        <Link href="/login">Já tenho conta</Link>
      </div>
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <>
      <form action={action} className={styles.form}>
        <Feedback state={state} />
        <label className={styles.field}>
          Email
          <input className={styles.input} name="email" type="email" autoComplete="email" required />
        </label>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Enviar link"}
        </button>
      </form>
      <div className={styles.links}>
        <Link href="/login">Voltar ao login</Link>
      </div>
    </>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className={styles.form}>
      <Feedback state={state} />
      <label className={styles.field}>
        Nova senha
        <input className={styles.input} name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className={styles.field}>
        Confirmar nova senha
        <input className={styles.input} name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar senha"}
      </button>
    </form>
  );
}
