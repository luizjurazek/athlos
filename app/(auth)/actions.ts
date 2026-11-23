"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type FormState = { error?: string; message?: string } | undefined;

const MIN_PASSWORD_LENGTH = Number(
  process.env.NEXT_PUBLIC_MIN_PASSWORD_LENGTH ?? 8,
);

async function getOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const headersList = await headers();
  const origin = headersList.get("origin");
  if (origin) return origin;
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validatePassword(password: string, confirm?: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (confirm !== undefined && password !== confirm) {
    return "As senhas não coincidem.";
  }
  return null;
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = getString(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe email e senha." };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirme seu email antes de entrar." };
    }
    return { error: "Email ou senha inválidos." };
  }

  redirect("/dashboard");
}

export async function signup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fullName = getString(formData, "full_name");
  const email = getString(formData, "email");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  if (!email) return { error: "Informe o email." };

  const passwordError = validatePassword(password, confirm);
  if (passwordError) return { error: passwordError };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await getOrigin()}/auth/confirm`,
      data: { full_name: fullName || null },
    },
  });
  if (error) return { error: error.message };

  return {
    message: "Conta criada! Verifique seu email para confirmar o cadastro.",
  };
}

export async function logout() {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = getString(formData, "email");
  if (!email) return { error: "Informe o email." };

  const supabase = createClient(await cookies());
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getOrigin()}/auth/confirm?next=/reset-password`,
  });

  // Same response whether or not the email exists, to avoid user enumeration.
  return {
    message:
      "Se o email estiver cadastrado, você receberá um link para redefinir a senha.",
  };
}

export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  const passwordError = validatePassword(password, confirm);
  if (passwordError) return { error: passwordError };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}
