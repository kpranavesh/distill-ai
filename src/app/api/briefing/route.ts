import "server-only";

import Parser from "rss-parser";
import { NextResponse } from "next/server";
import { recommend } from "../../../../recommender/index";

// Disable Next.js route caching — profile params must vary the response
export const dynamic = "force-dynamic";

type AIComfortLevel = "skeptic" | "beginner" | "active" | "power";

const parser = new Parser({
  timeout: 8000,
});

const FEEDS = [
  {
    id: "openai",
    url: "https://openai.com/news/rss.xml",
    topic: "Models & assistants",
  },
  {
    id: "anthropic",
    url: "https://anthropic.com/news/feed_anthropic.xml",
    topic: "Safety & Claude",
  },
  {
    id: "google-ai",
    url: "http://feeds.feedburner.com/blogspot/gJZg",
    topic: "Google AI & research",
  },
  {
    id: "techcrunch",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    topic: "Industry news",
  },
  {
    id: "mit-tech-review",
    url: "https://www.technologyreview.com/feed/",
    topic: "Policy & society",
  },
  {
    id: "the-markup",
    url: "https://themarkup.org/feeds/rss.xml",
    topic: "AI accountability",
  },
  {
    id: "venturebeat",
    url: "https://venturebeat.com/category/ai/feed",
    topic: "Industry news",
  },
  {
    id: "edsurge",
    url: "https://www.edsurge.com/news.rss",
    topic: "Education technology",
  },
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

function buildWhyItMatters(opts: {
  role: string;
  industry: string;
  comfort: AIComfortLevel;
  goal: string;
  aiTools: string[];
  topic: string;
}) {
  const role = opts.role || "professional";
  const industry = opts.industry || "your industry";
  const topic = opts.topic.toLowerCase();

  // Goal-based framing takes priority
  if (opts.goal === "strategic-decisions") {
    if (topic.includes("safety")) {
      return `As a ${role}, the question isn’t AI safety in the abstract — it’s what liability or brand risk you carry if something goes wrong with AI in ${industry}.`;
    }
    return `The strategic question: does this shift your competitive position, your cost structure, or your hiring decisions in ${industry} over the next 12 months?`;
  }

  if (opts.goal === "find-tools") {
    if (topic.includes("models")) {
      return `New model releases often mean better tools or lower prices downstream. Worth checking if any tool you already use has quietly upgraded.`;
    }
    return `The practical question: does this change which AI tools are worth your time and budget right now?`;
  }

  if (opts.goal === "build") {
    return `If you’re building with AI, read this for the API or capability changes — not just the headline. The useful detail is usually buried.`;
  }

  // Role-based framing as fallback
  if (role.toLowerCase().includes("executive") || role.toLowerCase().includes("c-suite")) {
    return `The strategic question: does this shift your competitive position, your cost structure, or your hiring decisions in ${industry}?`;
  }

  if (role.toLowerCase().includes("engineering") || role.toLowerCase().includes("technical")) {
    if (topic.includes("safety")) {
      return `Less relevant to your daily build — but useful when leadership asks you to sign off on AI governance policies.`;
    }
    return `Worth reading for the technical depth. The key question: does this unblock anything on your current roadmap, or is it a future capability to bookmark?`;
  }

  if (role.toLowerCase().includes("product")) {
    return `Think about this from a roadmap lens: does it change what’s now feasible to build, or what your users will expect within six months?`;
  }

  if (role.toLowerCase().includes("sales") || role.toLowerCase().includes("marketing")) {
    return `The angle that matters for you: how does this change what buyers expect, what you can automate in your pipeline, or what your pitch looks like?`;
  }

  if (role.toLowerCase().includes("legal") || role.toLowerCase().includes("compliance")) {
    return `The compliance lens: does this create new liability, trigger existing policy, or require you to update your institution's AI use guidelines?`;
  }

  // Topic-based fallbacks
  if (topic.includes("safety")) {
    return `You don’t need to be an AI safety expert — but you do need a simple story for your team about how you’ll use AI without putting customers at risk.`;
  }

  if (topic.includes("research")) {
    return `Most research posts won’t change your week directly, but they signal where tools will be in 6–18 months so you can make calmer long-term bets.`;
  }

  if (topic.includes("models")) {
    return `New model releases quietly change what’s realistic to automate in your role. Even skimming the highlights helps you spot "this used to be hard, now it’s a button."`;
  }

  return `Your job isn’t to chase every headline — it’s to notice the 2–3 shifts that actually change how you work in ${industry}, and ignore the rest.`;
}

function buildComfortSummary(opts: {
  comfort: AIComfortLevel;
  base: string;
}) {
  const base = normaliseText(opts.base);
  if (!base) return "";

  if (opts.comfort === "skeptic") {
    return `${base} Think of this less as hype and more as a small, specific experiment you could run without committing your whole strategy.`;
  }

  if (opts.comfort === "beginner") {
    return `${base} If any jargon shows up when you read the full post, you can safely skip it — focus on the examples and screenshots.`;
  }

  if (opts.comfort === "active") {
    return `${base} The question for you is: does this meaningfully beat what you already use today, or is it just a sideways move?`;
  }

  return `${base} Read this like a changelog: what concrete new capability does this unlock for you or your team this quarter?`;
}

async function loadArticles(): Promise<Article[]> {
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
            normaliseText(item.contentSnippet || item.content || item["content:encoded"]) ||
            "",
        }));
      } catch {
        return [];
      }
    }),
  );

  const flat = results.flat().filter((a) => a.link && a.title);

  flat.sort((a, b) => {
    if (a.published && b.published) {
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    }
    return 0;
  });

  return flat.slice(0, 40);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") || "";
  const industry = searchParams.get("industry") || "";
  const comfort = (searchParams.get("comfort") || "beginner") as AIComfortLevel;
  const goal = searchParams.get("goal") || "stay-informed";
  const aiTools = (searchParams.get("aiTools") || "").split(",").filter(Boolean);

  const articles = await loadArticles();

  const ranked = recommend(
    { role, industry, comfort, goal: goal as any, aiTools },
    articles,
    8,
  );

  const items = ranked.map((article) => ({
    id: article.id,
    title: article.title,
    topic: article.topic,
    source: article.source,
    link: article.link,
    published: article.published,
    relevanceScore: article.score,
    comfortSummary: buildComfortSummary({
      comfort,
      base: article.summary || article.title,
    }),
    whyItMatters: buildWhyItMatters({
      role,
      industry,
      comfort,
      goal,
      aiTools,
      topic: article.topic,
    }),
  }));

  return NextResponse.json(
    { items, _debug: { role, industry, comfort, goal, aiTools } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

