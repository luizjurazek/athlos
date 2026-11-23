import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/app/utils/supabase/server";

export type AuthUser = {
  id: string;
  email: string | undefined;
};

// Never use getSession() on the server: it does not validate the token.
export async function getUser(): Promise<AuthUser | null> {
  await connection();
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return { id: data.claims.sub, email: data.claims.email };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
