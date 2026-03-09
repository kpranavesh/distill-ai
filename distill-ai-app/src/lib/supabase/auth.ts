import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Get current user in an API route. Returns [null, 401 Response] if unauthenticated.
 */
export async function getAuthUser(): Promise<
  [User, null] | [null, NextResponse]
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return [
      null,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    ];
  }
  return [user, null];
}
