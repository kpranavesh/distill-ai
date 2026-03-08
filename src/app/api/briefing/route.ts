import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import { unstable_noStore } from "next/cache";
import { NextResponse } from "next/server";
import { recommend } from "../../../../recommender/index";

// Force dynamic rendering — no route-level caching
export const dynamic = "force-dynamic";
// Give Haiku + RSS fetches enough time on Vercel
export const maxDuration = 30;

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

type AIComfortLevel = "skeptic" | "beginner" | "active" | "power";

const parser = new Parser({ timeout: 8000 });

const FEEDS = [
  { id: "openai",          url: "https://openai.com/news/rss.xml",                          topic: "Models & assistants"  },
  { id: "anthropic",       url: "https://anthropic.com/news/feed_anthropic.xml",             topic: "Safety & Claude"      },
  { id: "google-ai",       url: "http://feeds.feedburner.com/blogspot/gJZg",                 topic: "Google AI & research" },
  { id: "techcrunch",      url: "https://techcrunch.com/category/artificial-intelligence/feed/", topic: "Industry news"    },
  { id: "mit-tech-review", url: "https://www.technologyreview.com/feed/",                    topic: "Policy & society"     },
  { id: "the-markup",      url: "https://themarkup.org/feeds/rss.xml",                       topic: "AI accountability"    },
  { id: "venturebeat",     url: "https://venturebeat.com/category/ai/feed",                  topic: "Industry news"        },
  { id: "edsurge",         url: "https://www.edsurge.com/news.rss",                          topic: "Education technology" },
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

  const prompt = `You write personalized newsletter blurbs for Signal, an AI news briefing app.

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
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    // Strip markdown code fences if Haiku wraps the JSON
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length === n) {
      return { texts: parsed, source: "claude" };
    }
    console.error("[briefing] Haiku returned wrong array length:", parsed.length, "expected", n);
  } catch (err) {
    console.error("[briefing] Haiku batch failed:", err instanceof Error ? err.message : err);
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

async function loadArticles(): Promise<Article[]> {
  // Opt out of Next.js data cache for all fetch calls in this scope
  unstable_noStore();

  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        return (parsed.items || []).slice(0, 15).map<Article>((item, index) => ({
          id: `${feed.id}-${item.guid || item.link || index}`,
          title: normaliseText(item.title || "Untitled"),
          link: item.link || "",
          source: feed.id,
          published: item.isoDate || item.pubDate || null,
          topic: feed.topic,
          summary:
            normaliseText(item.contentSnippet || item.content || item["content:encoded"]) || "",
        }));
      } catch {
        return [];
      }
    }),
  );

  const flat = results.flat().filter((a) => a.link && a.title);
  flat.sort((a, b) => {
    if (a.published && b.published)
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    return 0;
  });
  return flat.slice(0, 40);
}

export async function GET(req: Request) {
  // Belt-and-suspenders: opt out of Next.js data cache at handler level too
  unstable_noStore();

  const { searchParams } = new URL(req.url);
  const role     = searchParams.get("role")    || "";
  const industry = searchParams.get("industry")|| "";
  const comfort  = (searchParams.get("comfort") || "beginner") as AIComfortLevel;
  const goal     = searchParams.get("goal")    || "stay-informed";
  const aiTools  = (searchParams.get("aiTools") || "").split(",").filter(Boolean);

  const articles = await loadArticles();

  const ranked = recommend(
    { role, industry, comfort, goal: goal as any, aiTools },
    articles,
    8,
  );

  const { texts: whyItMatters, source: whySource } = await buildWhyItMattersBatch(
    { role, industry, comfort, goal },
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

  return NextResponse.json(
    {
      items,
      _debug: { role, industry, comfort, goal, aiTools, whySource, ts: Date.now() },
    },
    { headers: NO_CACHE_HEADERS },
  );
}
