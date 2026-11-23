import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/utils/supabase/server";

function safeNext(next: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const code = searchParams.get("code");

  if ((tokenHash && type) || code) {
    const supabase = createClient(await cookies());

    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("error", "Link inválido ou expirado. Tente novamente.");
  return NextResponse.redirect(url);
}
