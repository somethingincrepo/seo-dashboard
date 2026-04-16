import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Temporary debug endpoint — delete after diagnosing login issue
export async function GET() {
  const secret = process.env.ADMIN_PASSWORD;

  const result: Record<string, unknown> = {
    admin_password_set: !!secret,
    admin_password_length: secret?.length ?? 0,
    // First and last char so we can verify it matches without revealing it
    admin_password_first_char: secret?.[0] ?? null,
    admin_password_last_char: secret ? secret[secret.length - 1] : null,
  };

  try {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from("admin_users")
      .select("*", { count: "exact", head: true });
    result.table_error = error?.message ?? null;
    result.user_count = count;
  } catch (e) {
    result.supabase_exception = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(result);
}
