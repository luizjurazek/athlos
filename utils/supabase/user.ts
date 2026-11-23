import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

async function UserData() {
  const supabase = createClient(await cookies());
  // TODO: fetch data with supabase here
  return null;
}
