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
  if (state?.message) return <p className={styles.success} role="status">{state.message}</p>;
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
        <div className={styles.group}>
          <input className={styles.input} name="email" type="email" inputMode="email" autoComplete="email" placeholder="Email" aria-label="Email" required />
          <input className={styles.input} name="password" type="password" autoComplete="current-password" placeholder="Senha" aria-label="Senha" required />
        </div>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Entrando..." : "Entrar"}
        </button>
        <Link className={styles.inlineLink} href="/forgot-password">
          Esqueceu a senha?
        </Link>
      </form>
      <p className={styles.footer}>
        Não tem uma conta? <Link href="/signup">Criar conta</Link>
      </p>
    </>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <>
      <form action={action} className={styles.form}>
        <Feedback state={state} />
        <div className={styles.group}>
          <input className={styles.input} name="full_name" type="text" autoComplete="name" placeholder="Nome" aria-label="Nome" />
          <input className={styles.input} name="email" type="email" inputMode="email" autoComplete="email" placeholder="Email" aria-label="Email" required />
        </div>
        <div className={styles.group}>
          <input className={styles.input} name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Senha (mín. 8 caracteres)" aria-label="Senha" required />
          <input className={styles.input} name="confirm_password" type="password" autoComplete="new-password" minLength={8} placeholder="Confirmar senha" aria-label="Confirmar senha" required />
        </div>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar conta"}
        </button>
      </form>
      <p className={styles.footer}>
        Já tem uma conta? <Link href="/login">Entrar</Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <>
      <form action={action} className={styles.form}>
        <Feedback state={state} />
        <div className={styles.group}>
          <input className={styles.input} name="email" type="email" inputMode="email" autoComplete="email" placeholder="Email" aria-label="Email" required />
        </div>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Enviar link"}
        </button>
      </form>
      <p className={styles.footer}>
        Lembrou a senha? <Link href="/login">Entrar</Link>
      </p>
    </>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className={styles.form}>
      <Feedback state={state} />
      <div className={styles.group}>
        <input className={styles.input} name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Nova senha" aria-label="Nova senha" required />
        <input className={styles.input} name="confirm_password" type="password" autoComplete="new-password" minLength={8} placeholder="Confirmar nova senha" aria-label="Confirmar nova senha" required />
      </div>
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar senha"}
      </button>
    </form>
  );
}
