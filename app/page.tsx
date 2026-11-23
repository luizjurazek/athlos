import { redirect } from "next/navigation";

// The proxy already redirects "/" based on the session; this is a fallback.
// /dashboard itself sends signed-out users to /login.
export default function Home() {
  redirect("/dashboard");
}
