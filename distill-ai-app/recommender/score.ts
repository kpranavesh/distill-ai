import type { UserProfile, Article, ScoreFactor } from "./types";
import {
  TOOL_KEYWORDS,
  TECHNICAL_KEYWORDS,
  STRATEGIC_KEYWORDS,
  TOOL_LAUNCH_KEYWORDS,
  BUILD_KEYWORDS,
  LEGAL_KEYWORDS,
  INDUSTRY_KEYWORDS,
} from "./keywords";

// Keywords that indicate introductory / beginner-level content
const INTRO_KEYWORDS = [
  "how to", "getting started", "introduction", "beginners guide", "beginner's guide",
  "what is", "tutorial", "learn", "first time", "try", "explainer", "basics", "101",
  "for beginners", "primer", "overview", "simple guide",
];

// Keywords that indicate advanced / senior-level content
const ADVANCED_KEYWORDS = [
  "deep dive", "advanced", "under the hood", "architecture", "internals",
  "paper", "research", "benchmark", "ablation", "technical report", "arxiv",
  "fine-tun", "training run", "infrastructure", "at scale", "production",
];

// Negative signal keyword map — what each chip filters out
const NEGATIVE_SIGNAL_KEYWORDS: Record<string, string[]> = {
  "Too technical":           TECHNICAL_KEYWORDS,
  "Too basic / beginner":    INTRO_KEYWORDS,
  "AI hype & fluff":         ["revolutionary", "game-changer", "unprecedented", "groundbreaking", "disrupts everything", "changes everything", "world-changing"],
  "Vendor announcements":    ["now available", "launches", "unveiled", "released today", "introducing", "announcing", "new feature", "available today"],
  "Research papers":         ["arxiv", "paper", "preprint", "study", "ablation", "benchmark results", "eval", "technical report"],
};

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
  // Each selected goal is scored independently — if a user cares about tools
  // AND strategy, both keyword groups contribute. Final clamp to 100 prevents runaway.
  for (const goal of profile.goals) {
    switch (goal) {
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
    }
  }
  // stay-informed / understand: flat news signal, applied once regardless of how many are selected
  if (profile.goals.some((g) => g === "stay-informed" || g === "understand")) {
    if (contains(corpus, ["announced", "launches", "released", "unveiled"])) {
      factors.push({ factor: "goal:stay-informed — news signal", points: 8 });
    }
  }

  // ── Depth signals ────────────────────────────────────────────────────────────
  // depth = how technical/deep the user wants content to be
  const isTechnical = contains(corpus, TECHNICAL_KEYWORDS);

  switch (profile.depth) {
    case "strategic":
      // Strategic readers want business impact — penalise pure technical content
      if (contains(corpus, STRATEGIC_KEYWORDS)) {
        factors.push({ factor: "depth:strategic — business/impact match", points: 12 });
      }
      if (isTechnical && !contains(corpus, STRATEGIC_KEYWORDS)) {
        factors.push({ factor: "depth:strategic — pure technical penalty", points: -15 });
      }
      break;
    case "practical":
      // Practical readers want tools and use-cases, not theory
      if (contains(corpus, TOOL_LAUNCH_KEYWORDS)) {
        factors.push({ factor: "depth:practical — tool/use-case match", points: 10 });
      }
      if (isTechnical) {
        factors.push({ factor: "depth:practical — technical penalty", points: -8 });
      }
      break;
    case "technical":
      // Technical readers welcome technical content, especially comparisons
      if (isTechnical) {
        factors.push({ factor: "depth:technical — technical content match", points: 12 });
      }
      if (contains(corpus, ["vs ", "versus", "compared to", "better than", "alternative"])) {
        factors.push({ factor: "depth:technical — comparison content", points: 8 });
      }
      break;
    case "research":
      // Research readers want papers, benchmarks, deep technical content
      if (isTechnical) {
        factors.push({ factor: "depth:research — technical depth match", points: 15 });
      }
      if (contains(corpus, ADVANCED_KEYWORDS)) {
        factors.push({ factor: "depth:research — advanced content match", points: 10 });
      }
      break;
  }

  // ── Seniority signals ────────────────────────────────────────────────────────
  // Seniority modifies what depth of content within a topic is appropriate
  const isIntro = contains(corpus, INTRO_KEYWORDS);
  const isAdvanced = contains(corpus, ADVANCED_KEYWORDS);

  switch (profile.seniority) {
    case "new":
      // New to field: boost intro content, no penalty for advanced (they might aspire)
      if (isIntro) factors.push({ factor: "seniority:new — intro content match", points: 8 });
      break;
    case "mid":
      // Mid-level: slight boost for practical how-tos, neutral otherwise
      if (!isIntro && !isAdvanced) {
        factors.push({ factor: "seniority:mid — applied content match", points: 4 });
      }
      break;
    case "senior":
      // Senior: penalise intro/basics, boost advanced
      if (isIntro) factors.push({ factor: "seniority:senior — intro content penalty", points: -12 });
      if (isAdvanced) factors.push({ factor: "seniority:senior — advanced content match", points: 10 });
      break;
    case "executive":
      // Executive: penalise both extremes, boost strategic/business-outcome content
      if (isIntro) factors.push({ factor: "seniority:executive — intro penalty", points: -8 });
      if (isAdvanced && !contains(corpus, STRATEGIC_KEYWORDS)) {
        factors.push({ factor: "seniority:executive — deep technical penalty", points: -10 });
      }
      if (contains(corpus, STRATEGIC_KEYWORDS)) {
        factors.push({ factor: "seniority:executive — strategic content match", points: 10 });
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

  if (role.includes("design")) {
    const DESIGN_KEYWORDS = [
      "design", "figma", "adobe", "ux", "ui", "creative", "visual",
      "generative art", "image generation", "midjourney", "dall-e", "sora",
      "stable diffusion", "animation", "illustration", "typography",
      "film", "entertainment", "streaming", "music", "video", "production",
      "copyright", "intellectual property", "creator", "content creation",
    ];
    if (contains(corpus, DESIGN_KEYWORDS)) {
      factors.push({ factor: "role:design — creative/design content match", points: 15 });
    }
    if (isTechnical && !contains(corpus, DESIGN_KEYWORDS)) {
      factors.push({ factor: "role:design — pure technical penalty", points: -10 });
    }
  }

  if (role.includes("legal") || role.includes("compliance")) {
    if (contains(corpus, LEGAL_KEYWORDS)) {
      factors.push({ factor: "role:legal — policy/compliance content match", points: 15 });
    }
    if (isTechnical && !contains(corpus, LEGAL_KEYWORDS)) {
      factors.push({ factor: "role:legal — pure technical penalty", points: -12 });
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
  if (
    profile.industry === "Technology / Software" ||
    profile.industry === "technology"
  ) {
    factors.push({ factor: "industry:tech — always relevant", points: 6 });
  }

  // ── Negative signals ─────────────────────────────────────────────────────────
  // Hard penalise articles matching what the user said they don't want
  for (const signal of (profile.negativeSignals ?? [])) {
    const terms = NEGATIVE_SIGNAL_KEYWORDS[signal];
    if (terms && contains(corpus, terms)) {
      factors.push({ factor: `negativeSignal:${signal}`, points: -20 });
    }
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
