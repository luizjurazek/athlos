import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const PROTECTED_PREFIXES = ["/dashboard", "/account", "/objectives", "/settings"];
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isGuestOnly = GUEST_ONLY_PATHS.includes(pathname);

  if (pathname === "/") {
    const target = isAuthenticated ? "/dashboard" : "/login";
    return redirectWithCookies(request, supabaseResponse, target);
  }

  if (!isAuthenticated && isProtected) {
    return redirectWithCookies(request, supabaseResponse, "/login");
  }
  if (isAuthenticated && isGuestOnly) {
    return redirectWithCookies(request, supabaseResponse, "/dashboard");
  }

  return supabaseResponse;
};

function redirectWithCookies(
  request: NextRequest,
  source: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const response = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}
