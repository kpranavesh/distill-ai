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
    // Reverse-map legacy comfort values → new depth values
    const comfortToDepth: Record<string, string> = {
      beginner: "practical",
      skeptic:  "strategic",
      active:   "technical",
      power:    "research",
    };

    // seniority is stored as a "__seniority:X" tag in topics_boosted
    const boosted: string[] = Array.isArray(row.topics_boosted) ? row.topics_boosted : [];
    const seniorityTag = boosted.find((t) => t.startsWith("__seniority:"));
    const seniority = seniorityTag ? seniorityTag.replace("__seniority:", "") : "mid";

    return NextResponse.json({
      name: row.name ?? "",
      role: row.role ?? "",
      industry: row.industry ?? "",
      depth: comfortToDepth[row.comfort] ?? "practical",
      goals: Array.isArray(row.goals) ? row.goals : ["stay-informed"],
      seniority,
      negativeSignals: Array.isArray(row.topics_muted) ? row.topics_muted : [],
      aiTools: Array.isArray(row.ai_tools) ? row.ai_tools : [],
      topicsBoosted: boosted.filter((t) => !t.startsWith("__seniority:")),
    });
  }

  const { error: insertError } = await supabase.from("user_profiles").insert({
    id: user.id,
    name: null,
    role: null,
    industry: null,
    comfort: "beginner",  // "practical" mapped to legacy value
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
    depth: "practical",
    goals: ["stay-informed"],
    seniority: "mid",
    negativeSignals: [],
    aiTools: [],
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
  const depth =
    typeof body.depth === "string" && ["practical", "strategic", "technical", "research"].includes(body.depth)
      ? body.depth
      : "practical";
  const goals = Array.isArray(body.goals) ? body.goals.filter((g: unknown) => typeof g === "string") : ["stay-informed"];
  const seniority =
    typeof body.seniority === "string" && ["new", "mid", "senior", "executive"].includes(body.seniority)
      ? body.seniority
      : "mid";
  const negativeSignals = Array.isArray(body.negativeSignals) ? body.negativeSignals.filter((t: unknown) => typeof t === "string") : [];
  const aiTools = Array.isArray(body.aiTools) ? body.aiTools.filter((t: unknown) => typeof t === "string") : [];
  const topicsBoosted = Array.isArray(body.topicsBoosted) ? body.topicsBoosted.filter((t: unknown) => typeof t === "string") : [];

  // Map depth → legacy comfort values to satisfy the DB check constraint
  const depthToComfort: Record<string, string> = {
    practical:  "beginner",
    strategic:  "skeptic",
    technical:  "active",
    research:   "power",
  };
  const comfortValue = depthToComfort[depth] ?? "beginner";

  // Store seniority as a prefixed tag in topics_boosted to avoid schema changes
  const topicsBoostedWithSeniority = [`__seniority:${seniority}`, ...topicsBoosted];

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        name: name || null,
        role: role || null,
        industry: industry || null,
        comfort: comfortValue,  // depth mapped to legacy comfort values
        goals,
        ai_tools: aiTools,
        topics_muted: negativeSignals,
        topics_boosted: topicsBoostedWithSeniority,
      },
      { onConflict: "id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
