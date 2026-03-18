import "server-only";

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import type { DepthPreference, SeniorityLevel } from "../../../../recommender/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
};

interface PodcastItem {
  title: string;
  topic: string;
  comfortSummary?: string;
  whyItMatters?: string;
  relevanceScore?: number;
}

interface PodcastProfile {
  role: string;
  industry: string;
  seniority: SeniorityLevel;
  depth: DepthPreference;
  goals: string[];
}

const SENIORITY_INSTRUCTION: Record<SeniorityLevel, string> = {
  new: "Assume the listener is new to AI. Explain every acronym. Keep analogies simple.",
  mid: "Assume working knowledge of AI tools. Skip basics, focus on implications.",
  senior: "Assume deep familiarity. Go straight to nuance and second-order effects.",
  executive: "Focus on business impact, risk, and strategic positioning. Skip implementation details.",
};

const DEPTH_INSTRUCTION: Record<DepthPreference, string> = {
  practical: "Focus on what the listener can do or change this week.",
  strategic: "Focus on market shifts, competitive dynamics, and what to watch.",
  technical: "Include implementation details and technical nuance. Don't oversimplify.",
  research: "Go deep on methodology, limitations, and what the findings actually prove.",
};

const MAX_SCRIPT_CHARS = 6000;
const MIN_TURNS = 12;

function truncateTurnsToMaxChars(
  turns: { speaker: string; text: string }[],
  maxChars: number,
): { speaker: string; text: string }[] {
  let total = 0;
  const out: { speaker: string; text: string }[] = [];
  let didTruncate = false;
  for (const t of turns) {
    if (total + t.text.length + 1 > maxChars) {
      const remaining = maxChars - total - 50;
      if (remaining > 20) {
        const slice = t.text.slice(0, remaining);
        const lastPeriod = slice.lastIndexOf(".");
        const trimmed = lastPeriod > slice.length * 0.5 ? slice.slice(0, lastPeriod + 1) : slice;
        if (trimmed.trim()) out.push({ speaker: t.speaker, text: trimmed.trim() });
      }
      didTruncate = true;
      break;
    }
    total += t.text.length + 1;
    out.push(t);
  }
  if (didTruncate && out.length > 0) {
    const last = out[out.length - 1];
    if (!last.text.endsWith(".")) out.push({ speaker: last.speaker, text: "That's it for today." });
  }
  return out;
}

function buildPodcastScriptPrompt(
  items: PodcastItem[],
  profile: PodcastProfile,
): string {
  const seniorityInstruction = SENIORITY_INSTRUCTION[profile.seniority] ?? SENIORITY_INSTRUCTION.mid;
  const depthInstruction = DEPTH_INSTRUCTION[profile.depth] ?? DEPTH_INSTRUCTION.practical;
  const goals = (profile.goals && profile.goals.length) ? profile.goals.join(", ") : "stay informed";

  const articlesJson = items
    .slice(0, 8)
    .map(
      (a, i) =>
        `${i + 1}. [${a.topic}] ${a.title} — ${(a.comfortSummary || "").slice(0, 120)}${a.whyItMatters ? ` Why it matters: ${a.whyItMatters.slice(0, 80)}` : ""}${a.relevanceScore != null ? ` (relevance: ${a.relevanceScore}%)` : ""}`,
    )
    .join("\n");

  return `You are writing a two-host AI news podcast script for a daily briefing app.

Hosts:
- Alex: curious professional, asks questions from the listener's perspective, occasionally pushes back or asks "but what does that actually mean for me?"
- Jordan: clear explainer, ties news to practical implications, avoids jargon unless the user profile requests depth

User profile:
- Role: ${profile.role || "professional"}
- Industry: ${profile.industry || "your industry"}
- Seniority: ${seniorityInstruction}
- Depth preference: ${depthInstruction}
- Goals: ${goals}

MANDATORY STRUCTURAL ELEMENTS — all four must appear:

1. SYNTHESIS PASS: At least once, explicitly connect two separate articles with a thematic thread. Example: "That's interesting because the Anthropic safety paper from earlier actually speaks directly to this..." Do not just list articles in order.

2. REACTION TURNS: Include 3–4 short reaction exchanges (1 sentence each) where Alex responds to something Jordan just said with genuine surprise or skepticism:
   - "Wait — really? I assumed that was already the case."
   - "Hm. That's more concerning than I expected."
   - "I don't know if I buy that framing, but go on."
   These must feel unscripted. Do not use the same reaction opener twice.

3. PERSONALIZED OPENER: The very first Alex turn must reference the listener's role or context naturally. Example (for a product manager in healthcare): "So Jordan, I feel like this week's news has a lot of 'watch carefully' energy for someone trying to ship AI features in a regulated space..." Do not use the user's role as a label — weave it in conversationally.

4. "I DON'T KNOW" MOMENT: Jordan must say some version of "I don't know" or "I'm genuinely unsure about this one" exactly once — about a real ambiguity in one of the articles. This builds trust. Do not fake it on unambiguous facts.

Additional rules:
- Keep each speaker turn to 2–4 sentences max
- Alternate speakers. Never have the same host speak 3 times in a row
- Reference specific details from each article — not vague categories
- Use natural transitions: "Speaking of which...", "That ties into...", "Before we move on..."
- Include natural fillers sparingly: "right", "exactly", "interesting"
- Do NOT use stage directions, parentheticals, or markdown formatting
- Cover all ${Math.min(items.length, 8)} articles. Spend proportionally more time on higher-scored articles
- End with a brief 2-turn wrap-up that gives the listener one concrete thing to act on today

Target: 720–800 words total, ≥20 turns, ≥3 reaction turns

Return ONLY a valid JSON array: [{"speaker": "Alex"|"Jordan", "text": "..."}]
No preamble, no markdown, no explanation.

Articles (ordered by relevance, highest first):
${articlesJson}`;
}

async function generateScript(
  items: PodcastItem[],
  profile: PodcastProfile,
): Promise<{ speaker: string; text: string }[]> {
  const prompt = buildPodcastScriptPrompt(items, profile);
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY is not set");

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Groq script failed: ${res.status} ${await res.text()}`);

    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content?.trim() ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      if (attempt === 0) continue;
      throw new Error("Podcast script JSON invalid after retry");
    }

    if (!Array.isArray(parsed) || parsed.length < MIN_TURNS) {
      if (attempt === 0) continue;
      throw new Error(`Podcast script had ${Array.isArray(parsed) ? parsed.length : 0} turns, need ≥${MIN_TURNS}`);
    }

    const turns = parsed
      .filter((t): t is { speaker?: string; text?: string } => t != null && typeof t === "object")
      .map((t) => ({
        speaker: typeof t.speaker === "string" && (t.speaker === "Alex" || t.speaker === "Jordan") ? t.speaker : "Alex",
        text: typeof t.text === "string" ? t.text.trim() : "",
      }))
      .filter((t) => t.text.length > 0);

    if (turns.length >= MIN_TURNS) return turns;
    if (attempt === 0) continue;
    throw new Error("Podcast script had too few valid turns after retry");
  }

  throw new Error("Podcast script generation failed after retry");
}

async function synthesizeTurn(text: string, speaker: "Alex" | "Jordan"): Promise<Buffer> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY is not set");

  const voice = speaker === "Alex" ? "echo" : "nova";
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input: text.slice(0, 4096),
      response_format: "mp3",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const fallback = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        voice,
        input: text.slice(0, 4096),
      }),
      cache: "no-store",
    });
    if (!fallback.ok) throw new Error(`OpenAI TTS failed: ${res.status}`);
    return Buffer.from(await fallback.arrayBuffer());
  }

  return Buffer.from(await res.arrayBuffer());
}

async function synthesizeTurnsInParallel(
  turns: { speaker: string; text: string }[],
  concurrency = 4,
): Promise<Buffer[]> {
  const safeConcurrency = Math.max(1, Math.min(6, Math.floor(concurrency)));
  const results: Array<Buffer | null> = new Array(turns.length).fill(null);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= turns.length) return;
      const turn = turns[i];
      if (!turn?.text) {
        results[i] = Buffer.from([]);
        continue;
      }
      results[i] = await synthesizeTurn(
        turn.text,
        (turn.speaker === "Jordan" ? "Jordan" : "Alex"),
      );
    }
  }

  await Promise.all(Array.from({ length: Math.min(safeConcurrency, turns.length) }, () => worker()));
  return results.filter((b): b is Buffer => !!b && b.length > 0);
}

export async function POST(req: Request) {
  const [, authError] = await getAuthUser();
  if (authError) return authError;

  let body: { items?: PodcastItem[]; profile?: PodcastProfile };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const profile = body.profile as PodcastProfile | undefined;

  if (items.length === 0) {
    return NextResponse.json({ error: "At least one briefing item is required" }, { status: 400 });
  }
  if (!profile?.role) {
    return NextResponse.json({ error: "Profile with role is required" }, { status: 400 });
  }

  const safeProfile: PodcastProfile = {
    role: String(profile.role),
    industry: String(profile.industry ?? ""),
    seniority: ["new", "mid", "senior", "executive"].includes(profile.seniority) ? profile.seniority : "mid",
    depth: ["practical", "strategic", "technical", "research"].includes(profile.depth) ? profile.depth : "practical",
    goals: Array.isArray(profile.goals) ? profile.goals.filter((g: unknown) => typeof g === "string") : [],
  };

  try {
    let turns = await generateScript(items, safeProfile);
    const totalChars = turns.reduce((s, t) => s + t.text.length, 0);
    if (totalChars > MAX_SCRIPT_CHARS) {
      turns = truncateTurnsToMaxChars(turns, 5500);
    }

    const concurrency = Number(process.env.PODCAST_TTS_CONCURRENCY ?? 4);
    const buffers = await synthesizeTurnsInParallel(turns, concurrency);

    const stitched = Buffer.concat(buffers);

    return new NextResponse(stitched, {
      headers: {
        "Content-Type": "audio/mpeg",
        ...NO_CACHE_HEADERS,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Podcast generation failed";
    console.error("[podcast]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
