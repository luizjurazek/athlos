import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default function Home() {
  return (
    <main>
      <h1>Teste</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <UserData />
      </Suspense>
    </main>
  );
}

// Request-time data (cookies) must stay inside <Suspense> so the rest of the page can be prerendered.
async function UserData() {
  const supabase = createClient(await cookies());
  // TODO: fetch data with supabase here
  return null;
}
