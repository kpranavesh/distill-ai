import "server-only";

import Parser from "rss-parser";
import { unstable_noStore } from "next/cache";
import { NextResponse } from "next/server";
import { recommend, recommendWithExclusions } from "../../../../recommender/index";
import type { Goal, DepthPreference, SeniorityLevel } from "../../../../recommender/types";
import { getAuthUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

// Force dynamic rendering — no route-level caching
export const dynamic = "force-dynamic";
// Give RSS fetches enough time on Vercel — bumped to 60s to handle a larger feed pool
export const maxDuration = 60;

// Headers that kill caching at every layer:
// Cache-Control       — browser + proxies
// CDN-Cache-Control   — Vercel edge network specifically
// Surrogate-Control   — other CDN layers (Fastly, CloudFront, etc.)
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
};

// kept for buildComfortSummary compat — maps depth to display text
type AIComfortLevel = "skeptic" | "beginner" | "active" | "power";

const parser = new Parser({ timeout: 8000 });

const FEEDS = [
  // AI company blogs
  { id: "openai",          url: "https://openai.com/news/rss.xml",                               topic: "Models & assistants"    },
  { id: "import-ai",       url: "https://importai.substack.com/feed",                             topic: "AI research"            },
  { id: "last-week-in-ai", url: "https://lastweekin.ai/feed",                                     topic: "AI research"            },
  // Broad industry
  { id: "techcrunch",      url: "https://techcrunch.com/category/artificial-intelligence/feed/",  topic: "Industry news"          },
  { id: "the-verge",       url: "https://www.theverge.com/rss/index.xml",                         topic: "Industry news"          },
  { id: "venturebeat",     url: "https://venturebeat.com/category/ai/feed",                       topic: "Industry news"          },
  // Investment / funding (good for entrepreneurs + investors)
  { id: "crunchbase-news", url: "http://news.crunchbase.com/feed/",                          topic: "Investment & funding"   },
  { id: "techcrunch-venture", url: "https://techcrunch.com/category/venture/feed/",        topic: "Investment & funding"   },
  // Policy & accountability
  { id: "mit-tech-review", url: "https://www.technologyreview.com/feed/",                         topic: "Policy & society"       },
  { id: "the-markup",      url: "https://themarkup.org/feeds/rss.xml",                            topic: "AI accountability"      },
  // Design & creative
  { id: "creativebloq",    url: "https://www.creativebloq.com/feeds/all.xml",                     topic: "Design & creative tools"},
  // Media & entertainment
  { id: "variety",         url: "https://variety.com/feed/",                                      topic: "Media & entertainment"  },
  { id: "deadline",        url: "https://deadline.com/feed/",                                     topic: "Media & entertainment"  },
  // Biotech & life sciences
  { id: "stat-news",       url: "https://www.statnews.com/feed/",                                  topic: "Biotech & life sciences"},
  { id: "nature-biotech",  url: "https://www.nature.com/nbt.rss",                                  topic: "Biotech & life sciences"},
  // Data science & ML
  { id: "towards-ds",      url: "https://towardsdatascience.com/feed",                             topic: "Data science & ML"      },
  { id: "ars-technica",    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",        topic: "Developer & open source"},
  // Product & strategy
  { id: "lennys",          url: "https://www.lennysnewsletter.com/feed",                           topic: "Product & strategy"     },
  // Developer & open source
  { id: "hacker-news-ai",  url: "https://hnrss.org/newest?q=AI+LLM&count=20",                     topic: "Developer & open source"},
];

interface Article {
  id: string;
  title: string;
  link: string;
  source: string;
  published: string | null;
  topic: string;
  summary: string;
}

interface FeedStat {
  feedId: string;
  topic: string;
  fetchedCount: number;
  aiRelevantCount: number;
  aiRelevantRate: number; // 0-1
  avgSummaryLen: number;  // chars
  avgAgeDays: number | null; // null if no published dates
}

interface FeedRichnessStats {
  score: number; // 0-100
  factors: {
    volume: number;     // 0-40
    coverage: number;   // 0-25
    freshness: number;  // 0-20
    content: number;    // 0-15
    relevance: number;  // 0-10
  };
  totalFetched: number;
  totalAiRelevant: number;
  numFeedsWithAiRelevant: number;
  avgAgeDays: number | null;
  avgSummaryLen: number;
  feedsTopByAiRelevant: FeedStat[]; // top 5
}

function normaliseText(input: string | undefined | null): string {
  if (!input) return "";
  return input.replace(/\s+/g, " ").trim();
}

async function buildWhyItMattersBatch(
  profile: { role: string; industry: string; comfort: string; goal: string },
  articles: Array<{ title: string; summary: string }>,
): Promise<{ texts: string[]; source: "claude" | "fallback" }> {
  const role = profile.role || "professional";
  const industry = profile.industry || "your industry";
  const n = articles.length;

  const prompt = `You write personalized newsletter blurbs for Distill AI, an AI news briefing app.

User: ${role} in ${industry}, goal: ${profile.goal}, AI comfort: ${profile.comfort}

For each article below, write exactly ONE sentence (under 22 words) explaining why this specific article matters to this specific user. Rules:
- Reference what is actually in the article — not just the topic category
- Make every sentence meaningfully different: vary the angle, the stakes, the phrasing
- Be direct and concrete, no fluff
- Do not start more than one sentence the same way

Return only a JSON array of exactly ${n} strings, in the same order. No other text.

Articles:
${articles.map((a, i) => `${i + 1}. "${a.title}" — ${(a.summary || "").slice(0, 160)}`).join("\n")}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
      // Don't let Next.js cache this outbound fetch
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content?.trim() ?? "";
    // Strip markdown code fences if the model wraps the JSON
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length === n) {
      const texts = parsed.map((v: unknown) => (typeof v === "string" ? v : ""));
      return { texts, source: "claude" };
    }
    console.error("[briefing] Groq returned wrong shape/length:", typeof parsed, parsed?.length, "expected", n);
  } catch (err) {
    console.error("[briefing] Groq batch failed:", err instanceof Error ? err.message : err);
  }

  // Rule-based fallback — still role-aware
  const role_l = role.toLowerCase();
  const texts = articles.map(({ title, summary }) => {
    const corpus = `${title} ${summary}`.toLowerCase();
    if (role_l.includes("legal") || role_l.includes("compliance"))
      return `The compliance lens: does this create new liability or require updating your AI use policy in ${industry}?`;
    if (role_l.includes("executive") || role_l.includes("leadership"))
      return `Strategic question: does this shift your competitive position or cost structure in ${industry}?`;
    if (role_l.includes("engineering") || role_l.includes("technical"))
      return corpus.includes("api") || corpus.includes("sdk")
        ? `Worth reading for the API or capability changes — the useful detail is usually buried.`
        : `Does this unblock anything on your current roadmap, or is it a capability to bookmark?`;
    if (role_l.includes("product"))
      return `Does this change what users will expect, or what is now feasible to build within six months?`;
    if (role_l.includes("marketing") || role_l.includes("sales"))
      return `How does this change what buyers expect, or what you can automate in your pipeline?`;
    return `Notice the 2–3 shifts here that actually change how you work in ${industry} — ignore the rest.`;
  });
  return { texts, source: "fallback" };
}

function buildComfortSummary(opts: { comfort: AIComfortLevel; base: string }) {
  const base = normaliseText(opts.base);
  if (!base) return "";
  if (opts.comfort === "skeptic")
    return `${base} Think of this less as hype and more as a small, specific experiment you could run without committing your whole strategy.`;
  if (opts.comfort === "beginner")
    return `${base} If any jargon shows up when you read the full post, you can safely skip it — focus on the examples and screenshots.`;
  if (opts.comfort === "active")
    return `${base} The question for you is: does this meaningfully beat what you already use today, or is it just a sideways move?`;
  return `${base} Read this like a changelog: what concrete new capability does this unlock for you or your team this quarter?`;
}

async function loadArticles(): Promise<{ articles: Article[]; feedRichness: FeedRichnessStats }> {
  // Opt out of Next.js data cache for all fetch calls in this scope
  unstable_noStore();

  // ── AI relevance gate ─────────────────────────────────────────────────────
  // Distill is an AI news product. Drop any article that doesn't mention AI at
  // all — this prevents biotech/industry feeds from leaking non-AI stories.
  const AI_GATE_TERMS = [
    "ai", "artificial intelligence", "machine learning", "llm", "large language model",
    "gpt", "claude", "gemini", "chatgpt", "copilot", "midjourney", "dall-e", "sora",
    "neural", "deep learning", "generative", "foundation model", "language model",
    "openai", "anthropic", "google deepmind", "mistral", "llama", "hugging face",
    "automation", "algorithm", "robot", "computer vision", "natural language",
  ];

  function isAIRelevant(article: { title: string; summary: string }): boolean {
    const corpus = `${article.title} ${article.summary}`.toLowerCase();
    return AI_GATE_TERMS.some((term) => corpus.includes(term));
  }

  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        const fetched = (parsed.items || []).slice(0, 20).map<Article>((item, index) => ({
          id: `${feed.id}-${item.guid || item.link || index}`,
          title: normaliseText(item.title || "Untitled"),
          link: item.link || "",
          source: feed.id,
          published: item.isoDate || item.pubDate || null,
          topic: feed.topic,
          summary:
            normaliseText(item.contentSnippet || item.content || item["content:encoded"]) || "",
        }));

        const aiRelevant = fetched.filter((a) => a.link && a.title && isAIRelevant(a));
        const summaryLens = aiRelevant.map((a) => a.summary.length).filter((n) => n > 0);
        const avgSummaryLen =
          summaryLens.length > 0 ? summaryLens.reduce((s, n) => s + n, 0) / summaryLens.length : 0;

        const ageDays: number[] = aiRelevant
          .map((a) => {
            if (!a.published) return null;
            const t = new Date(a.published).getTime();
            if (!Number.isFinite(t)) return null;
            return (Date.now() - t) / (1000 * 60 * 60 * 24);
          })
          .filter((v): v is number => typeof v === "number");

        const avgAgeDays = ageDays.length > 0 ? ageDays.reduce((s, n) => s + n, 0) / ageDays.length : null;

        const stat: FeedStat = {
          feedId: feed.id,
          topic: feed.topic,
          fetchedCount: fetched.length,
          aiRelevantCount: aiRelevant.length,
          aiRelevantRate: fetched.length ? aiRelevant.length / fetched.length : 0,
          avgSummaryLen,
          avgAgeDays,
        };

        return { stat, aiRelevant };
      } catch {
        const stat: FeedStat = {
          feedId: feed.id,
          topic: feed.topic,
          fetchedCount: 0,
          aiRelevantCount: 0,
          aiRelevantRate: 0,
          avgSummaryLen: 0,
          avgAgeDays: null,
        };
        return { stat, aiRelevant: [] as Article[] };
      }
    }),
  );

  const feedStats = results.map((r) => r.stat);
  const flat = results.flatMap((r) => r.aiRelevant);
  flat.sort((a, b) => {
    if (a.published && b.published)
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    return 0;
  });

  const totalFetched = feedStats.reduce((s, f) => s + f.fetchedCount, 0);
  const totalAiRelevant = feedStats.reduce((s, f) => s + f.aiRelevantCount, 0);
  const numFeedsWithAiRelevant = feedStats.filter((f) => f.aiRelevantCount > 0).length;

  const summaryLens = flat.map((a) => a.summary.length).filter((n) => n > 0);
  const avgSummaryLen = summaryLens.length ? summaryLens.reduce((s, n) => s + n, 0) / summaryLens.length : 0;

  const ageDaysAll: number[] = flat
    .map((a) => {
      if (!a.published) return null;
      const t = new Date(a.published).getTime();
      if (!Number.isFinite(t)) return null;
      return (Date.now() - t) / (1000 * 60 * 60 * 24);
    })
    .filter((v): v is number => typeof v === "number");
  const avgAgeDays = ageDaysAll.length ? ageDaysAll.reduce((s, n) => s + n, 0) / ageDaysAll.length : null;

  const avgRelevanceRate = totalFetched ? totalAiRelevant / totalFetched : 0;

  // Score intuition:
  // - Volume answers: do we have enough raw signal?
  // - Coverage answers: are multiple sources contributing?
  // - Freshness answers: is there recent content?
  // - Content answers: do we have substantive snippets?
  // - Relevance answers: how often feeds actually contain AI mentions.
  const volumeFactor = (() => {
    const max = FEEDS.length * 20; // each feed fetches up to 20 items
    const v = Math.log(1 + totalAiRelevant) / Math.log(1 + max);
    return Math.max(0, Math.min(1, v)) * 40;
  })();
  const coverageFactor = (() => {
    const v = FEEDS.length ? numFeedsWithAiRelevant / FEEDS.length : 0;
    return Math.max(0, Math.min(1, v)) * 25;
  })();
  const freshnessFactor = (() => {
    if (avgAgeDays === null) return 0;
    // exp decay: ~14 days -> near 0, 0-3 days -> high
    const v = Math.exp(-avgAgeDays / 3);
    return Math.max(0, Math.min(1, v)) * 20;
  })();
  const contentFactor = (() => {
    // Normalize snippet length; many sources provide ~200-1200 chars.
    const v = avgSummaryLen ? Math.min(1, avgSummaryLen / 900) : 0;
    return Math.max(0, Math.min(1, v)) * 15;
  })();
  const relevanceFactor = (() => {
    return Math.max(0, Math.min(1, avgRelevanceRate)) * 10;
  })();

  const score = Math.round(volumeFactor + coverageFactor + freshnessFactor + contentFactor + relevanceFactor);

  const feedsTopByAiRelevant = [...feedStats]
    .sort((a, b) => b.aiRelevantCount - a.aiRelevantCount)
    .slice(0, 5);

  const feedRichness: FeedRichnessStats = {
    score,
    factors: {
      volume: Math.round(volumeFactor * 10) / 10,
      coverage: Math.round(coverageFactor * 10) / 10,
      freshness: Math.round(freshnessFactor * 10) / 10,
      content: Math.round(contentFactor * 10) / 10,
      relevance: Math.round(relevanceFactor * 10) / 10,
    },
    totalFetched,
    totalAiRelevant,
    numFeedsWithAiRelevant,
    avgAgeDays,
    avgSummaryLen,
    feedsTopByAiRelevant,
  };

  return { articles: flat.slice(0, 120), feedRichness };
}

export async function GET(req: Request) {
  const [user, authError] = await getAuthUser();
  if (authError) return authError;
  const supabase = await createClient();

  unstable_noStore();

  const { searchParams } = new URL(req.url);
  const role            = searchParams.get("role")     || "";
  const industry        = searchParams.get("industry") || "";
  const depth           = (searchParams.get("depth") || "practical") as DepthPreference;
  const goals           = (searchParams.get("goals") || "stay-informed").split(",").filter(Boolean) as Goal[];
  const seniority       = (searchParams.get("seniority") || "mid") as SeniorityLevel;
  const negativeSignals = (searchParams.get("negativeSignals") || "").split(",").filter(Boolean);
  const aiTools         = (searchParams.get("aiTools") || "").split(",").filter(Boolean);
  /** Omit these story IDs so refresh returns the next-best matches (repeat param: exclude=id&exclude=id) */
  const excludeIds = searchParams.getAll("exclude").map((id) => id.trim()).filter(Boolean);

  // Map depth → legacy comfort for buildComfortSummary
  const depthToComfort: Record<DepthPreference, AIComfortLevel> = {
    strategic: "skeptic",
    practical: "beginner",
    technical: "active",
    research:  "power",
  };
  const comfort = depthToComfort[depth] ?? "beginner";

  const { articles, feedRichness } = await loadArticles();

  // Hard-filter muted topics so the client doesn't end up dropping most results.
  // Client-side logic uses `profile.negativeSignals` to hide any item whose `topic`
  // includes the muted string as a substring.
  const mutedTerms = negativeSignals.map((s) => s.toLowerCase()).filter(Boolean);
  const isMutedByTopic = (topic: string) =>
    mutedTerms.some((t) => topic.toLowerCase().includes(t));
  const candidateArticles =
    mutedTerms.length > 0 ? articles.filter((a) => !isMutedByTopic(a.topic)) : articles;

  const profilePayload = { role, industry, depth, goals, seniority, negativeSignals, aiTools };
  const isRefresh = excludeIds.length > 0;
  const topN = isRefresh ? 5 : 8;
  const ranked =
    isRefresh
      ? recommendWithExclusions(profilePayload, candidateArticles, excludeIds, topN)
      : recommend(profilePayload, candidateArticles, topN);

  const { texts: whyItMatters, source: whySource } = await buildWhyItMattersBatch(
    { role, industry, comfort, goal: goals[0] ?? "stay-informed" },
    ranked.map((a) => ({ title: a.title, summary: a.summary })),
  );

  const items = ranked.map((article, i) => ({
    id: article.id,
    title: article.title,
    topic: article.topic,
    source: article.source,
    link: article.link,
    published: article.published,
    relevanceScore: article.score,
    comfortSummary: buildComfortSummary({ comfort, base: article.summary || article.title }),
    whyItMatters: whyItMatters[i] ?? "",
  }));

  const algorithmVersion = "briefing_v1";
  const sessionType = isRefresh ? "refresh" : "initial";
  let sessionId: string | null = null;
  try {
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("recommendation_sessions")
      .insert({
        user_id: user.id,
        session_type: sessionType,
        algorithm_version: algorithmVersion,
        profile_snapshot: profilePayload,
        feed_richness: feedRichness,
        shown_count: ranked.length,
        request_context: { exclude_count: excludeIds.length },
      })
      .select("id")
      .single();

    if (sessionErr) throw sessionErr;
    sessionId = sessionRow?.id ?? null;

    if (sessionId) {
      const rows = ranked.map((article, i) => ({
        session_id: sessionId,
        article_id: article.id,
        title: article.title,
        topic: article.topic,
        source: article.source,
        relevance_score: article.score,
        position: i + 1,
        shown_reason: {},
      }));

      const { error: itemsErr } = await supabase
        .from("recommendation_items")
        .insert(rows);
      if (itemsErr) throw itemsErr;
    }
  } catch (e) {
    console.error("[briefing] Failed to persist recommendation session/items:", e);
  }

  return NextResponse.json(
    {
      sessionId,
      items,
      _debug: {
        role,
        industry,
        depth,
        goals,
        seniority,
        negativeSignals,
        aiTools,
        whySource,
        feedRichness,
        ts: Date.now(),
      },
    },
    { headers: NO_CACHE_HEADERS },
  );
}
