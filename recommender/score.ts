import type { UserProfile, Article, ScoreFactor } from "./types";
import {
  TOOL_KEYWORDS,
  TECHNICAL_KEYWORDS,
  STRATEGIC_KEYWORDS,
  TOOL_LAUNCH_KEYWORDS,
  BUILD_KEYWORDS,
  INDUSTRY_KEYWORDS,
} from "./keywords";

function contains(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

function countMatches(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.filter((t) => lower.includes(t)).length;
}

// Score a single article against a user profile. Returns 0–100.
export function scoreArticle(
  profile: UserProfile,
  article: Article,
): { score: number; breakdown: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];
  const corpus = `${article.title} ${article.summary}`.toLowerCase();

  // ── Base score ──────────────────────────────────────────────────────────────
  // Every article starts at 20 so nothing scores zero just for being published.
  factors.push({ factor: "base", points: 20 });

  // ── Goal signals ────────────────────────────────────────────────────────────
  switch (profile.goal) {
    case "find-tools": {
      const hits = countMatches(corpus, TOOL_LAUNCH_KEYWORDS);
      if (hits > 0) factors.push({ factor: "goal:find-tools — tool launch keywords", points: Math.min(hits * 8, 24) });
      break;
    }
    case "strategic-decisions": {
      const hits = countMatches(corpus, STRATEGIC_KEYWORDS);
      if (hits > 0) factors.push({ factor: "goal:strategic-decisions — strategic keywords", points: Math.min(hits * 8, 24) });
      break;
    }
    case "build": {
      const hits = countMatches(corpus, BUILD_KEYWORDS);
      if (hits > 0) factors.push({ factor: "goal:build — developer keywords", points: Math.min(hits * 8, 24) });
      break;
    }
    case "stay-informed":
    case "curiosity":
    default:
      // Balanced — no strong skew, slight boost for anything high-impact
      if (contains(corpus, ["announced", "launches", "released", "unveiled"])) {
        factors.push({ factor: "goal:stay-informed — news signal", points: 8 });
      }
      break;
  }

  // ── Comfort signals ─────────────────────────────────────────────────────────
  const isTechnical = contains(corpus, TECHNICAL_KEYWORDS);

  switch (profile.comfort) {
    case "skeptic":
      // Skeptics want business impact, not technical depth
      if (contains(corpus, STRATEGIC_KEYWORDS)) {
        factors.push({ factor: "comfort:skeptic — business impact match", points: 12 });
      }
      if (isTechnical) {
        factors.push({ factor: "comfort:skeptic — technical penalty", points: -15 });
      }
      break;
    case "beginner":
      // Light preference for accessible, non-technical content
      if (isTechnical) {
        factors.push({ factor: "comfort:beginner — technical penalty", points: -8 });
      }
      break;
    case "active":
      // Neutral on technical; boosts comparison/vs content
      if (contains(corpus, ["vs ", "versus", "compared to", "better than", "alternative"])) {
        factors.push({ factor: "comfort:active — comparison content", points: 10 });
      }
      break;
    case "power":
      // Power users want technical depth
      if (isTechnical) {
        factors.push({ factor: "comfort:power — technical depth match", points: 15 });
      }
      break;
  }

  // ── Role signals ─────────────────────────────────────────────────────────────
  const role = profile.role.toLowerCase();

  if (role.includes("executive") || role.includes("c-suite")) {
    if (contains(corpus, STRATEGIC_KEYWORDS)) {
      factors.push({ factor: "role:executive — strategic content match", points: 12 });
    }
    if (isTechnical && !contains(corpus, STRATEGIC_KEYWORDS)) {
      factors.push({ factor: "role:executive — pure technical penalty", points: -10 });
    }
  }

  if (role.includes("engineering") || role.includes("technical")) {
    if (isTechnical) {
      factors.push({ factor: "role:engineering — technical content match", points: 12 });
    }
    if (contains(corpus, BUILD_KEYWORDS)) {
      factors.push({ factor: "role:engineering — dev/build content", points: 8 });
    }
  }

  if (role.includes("product")) {
    if (contains(corpus, [...TOOL_LAUNCH_KEYWORDS, "roadmap", "feature", "capability", "ux"])) {
      factors.push({ factor: "role:product — feature/launch content", points: 12 });
    }
  }

  if (role.includes("sales") || role.includes("marketing")) {
    if (contains(corpus, ["enterprise", "pricing", "customer", "revenue", "sales", "marketing", "campaign", "brand"])) {
      factors.push({ factor: "role:sales/marketing — market content match", points: 12 });
    }
  }

  if (role.includes("research") || role.includes("analyst")) {
    if (contains(corpus, ["research", "paper", "study", "benchmark", "analysis", "data", "arxiv"])) {
      factors.push({ factor: "role:research — research content match", points: 12 });
    }
  }

  if (role.includes("operations") || role.includes("finance")) {
    if (contains(corpus, ["automation", "workflow", "efficiency", "cost", "productivity", "operations"])) {
      factors.push({ factor: "role:ops/finance — efficiency content match", points: 12 });
    }
  }

  // ── Industry signals ─────────────────────────────────────────────────────────
  const industryTerms = INDUSTRY_KEYWORDS[profile.industry];
  if (industryTerms) {
    const hits = countMatches(corpus, industryTerms);
    if (hits > 0) {
      factors.push({
        factor: `industry:${profile.industry} — keyword match (${hits})`,
        points: Math.min(hits * 6, 18),
      });
    }
  }

  // Technology / Software gets a small blanket boost — AI news is always on-topic
  if (profile.industry === "Technology / Software") {
    factors.push({ factor: "industry:tech — always relevant", points: 6 });
  }

  // ── AI Tools dedup ──────────────────────────────────────────────────────────
  // If user already uses a tool, penalise "getting started / intro" articles for that tool.
  for (const tool of profile.aiTools) {
    const toolTerms = TOOL_KEYWORDS[tool];
    if (!toolTerms) continue;
    if (contains(corpus, toolTerms)) {
      const isIntro = contains(corpus, [
        "how to", "getting started", "introduction", "beginners guide",
        "what is", "tutorial", "learn", "first time", "try",
      ]);
      if (isIntro) {
        factors.push({
          factor: `aiTools:dedup — user already uses ${tool}`,
          points: -15,
        });
      }
    }
  }

  // ── Recency bonus ────────────────────────────────────────────────────────────
  if (article.published) {
    const ageMs = Date.now() - new Date(article.published).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays <= 2) factors.push({ factor: "recency — last 48h", points: 10 });
    else if (ageDays <= 7) factors.push({ factor: "recency — last 7 days", points: 5 });
  }

  // ── Clamp to 0–100 ───────────────────────────────────────────────────────────
  const raw = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, raw));

  return { score, breakdown: factors };
}
