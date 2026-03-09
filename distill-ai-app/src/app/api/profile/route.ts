import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

/** GET: Load current user's profile. Creates empty row if none. */
export async function GET() {
  const [user, authError] = await getAuthUser();
  if (authError) return authError;

  const supabase = await createClient();
  const { data: row, error: fetchError } = await supabase
    .from("user_profiles")
    .select("id, name, role, industry, comfort, goals, ai_tools, topics_muted, topics_boosted")
    .eq("id", user.id)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (row) {
    return NextResponse.json({
      name: row.name ?? "",
      role: row.role ?? "",
      industry: row.industry ?? "",
      comfort: row.comfort ?? "beginner",
      goals: Array.isArray(row.goals) ? row.goals : ["stay-informed"],
      aiTools: Array.isArray(row.ai_tools) ? row.ai_tools : [],
      topicsMuted: Array.isArray(row.topics_muted) ? row.topics_muted : [],
      topicsBoosted: Array.isArray(row.topics_boosted) ? row.topics_boosted : [],
    });
  }

  const { error: insertError } = await supabase.from("user_profiles").insert({
    id: user.id,
    name: null,
    role: null,
    industry: null,
    comfort: "beginner",
    goals: [],
    ai_tools: [],
    topics_muted: [],
    topics_boosted: [],
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    name: "",
    role: "",
    industry: "",
    comfort: "beginner",
    goals: ["stay-informed"],
    aiTools: [],
    topicsMuted: [],
    topicsBoosted: [],
  });
}

/** POST: Upsert current user's profile (on onboarding complete or settings save). */
export async function POST(req: Request) {
  const [user, authError] = await getAuthUser();
  if (authError) return authError;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name : "";
  const role = typeof body.role === "string" ? body.role : "";
  const industry = typeof body.industry === "string" ? body.industry : "";
  const comfort =
    typeof body.comfort === "string" && ["skeptic", "beginner", "active", "power"].includes(body.comfort)
      ? body.comfort
      : "beginner";
  const goals = Array.isArray(body.goals) ? body.goals.filter((g: unknown) => typeof g === "string") : ["stay-informed"];
  const aiTools = Array.isArray(body.aiTools) ? body.aiTools.filter((t: unknown) => typeof t === "string") : [];
  const topicsMuted = Array.isArray(body.topicsMuted) ? body.topicsMuted.filter((t: unknown) => typeof t === "string") : [];
  const topicsBoosted = Array.isArray(body.topicsBoosted) ? body.topicsBoosted.filter((t: unknown) => typeof t === "string") : [];

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        name: name || null,
        role: role || null,
        industry: industry || null,
        comfort,
        goals,
        ai_tools: aiTools,
        topics_muted: topicsMuted,
        topics_boosted: topicsBoosted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
