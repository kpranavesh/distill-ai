import Parser from "rss-parser";
import { recommend } from "../recommender/index";
import type { UserProfile } from "../recommender/types";

const parser = new Parser({ timeout: 8000 });

const FEEDS = [
  { id: "openai",          url: "https://openai.com/news/rss.xml",                               topic: "Models & assistants" },
  { id: "techcrunch",      url: "https://techcrunch.com/category/artificial-intelligence/feed/", topic: "Industry news" },
  { id: "the-verge",       url: "https://www.theverge.com/rss/index.xml",                        topic: "Industry news" },
  { id: "mit-tech-review", url: "https://www.technologyreview.com/feed/",                        topic: "Policy & society" },
  { id: "stat-news",       url: "https://www.statnews.com/feed/",                                topic: "Biotech & life sciences" },
];

const PROFILES: Array<{ label: string; profile: UserProfile }> = [
  {
    label: "CEO / Business Owner — Strategic, Executive, No AI tools",
    profile: {
      role: "executive",
      industry: "other",
      depth: "strategic",
      seniority: "executive",
      goals: ["strategic-decisions"],
      negativeSignals: ["Too technical"],
      aiTools: [],
    },
  },
  {
    label: "Senior Data Scientist — Technical depth, Senior, Build goal",
    profile: {
      role: "data",
      industry: "technology",
      depth: "technical",
      seniority: "senior",
      goals: ["build"],
      negativeSignals: ["Too basic / beginner", "AI hype & fluff"],
      aiTools: ["ChatGPT"],
    },
  },
];

async function main() {
  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        return (parsed.items || []).slice(0, 20).map((item, i) => ({
          id: `${feed.id}-${i}`,
          title: (item.title || "Untitled").replace(/\s+/g, " ").trim(),
          link: item.link || "",
          source: feed.id,
          published: item.isoDate || item.pubDate || null,
          topic: feed.topic,
          summary: (item.contentSnippet || item.content || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 400),
        }));
      } catch (e) {
        console.error("FAIL", feed.id, (e as Error).message?.slice(0, 40));
        return [];
      }
    })
  );

  const flat = results.flat().filter((a) => a.link && a.title);
  flat.sort((a, b) => {
    if (a.published && b.published)
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    return 0;
  });
  const pool = flat.slice(0, 120);
  console.log(`\nPool: ${pool.length} articles from ${FEEDS.length} feeds\n`);

  for (const { label, profile } of PROFILES) {
    const ranked = recommend(profile, pool, 8);
    console.log("=".repeat(70));
    console.log(`PROFILE: ${label}`);
    console.log("=".repeat(70));
    ranked.forEach((a, i) => {
      console.log(`\n${i + 1}. [score: ${a.score}] ${a.title}`);
      console.log(`   Source: ${a.source} | Topic: ${a.topic}`);
      if (a.summary) console.log(`   "${a.summary.slice(0, 120)}..."`);
    });
    console.log("");
  }
}

main().catch(console.error);
