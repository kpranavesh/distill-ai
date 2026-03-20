import { scoreArticle } from "./score";
import type { UserProfile, Article, ScoredArticle } from "./types";

export type { UserProfile, Article, ScoredArticle } from "./types";

/**
 * Rank a list of articles for a given user profile.
 *
 * @param profile  - User's onboarding answers
 * @param articles - Candidate articles (e.g. from RSS feeds)
 * @param topN     - How many to return (default 8)
 * @returns        Articles sorted by relevance score, highest first
 */
export function recommend(
  profile: UserProfile,
  articles: Article[],
  topN = 8,
): ScoredArticle[] {
  return articles
    .map((article) => {
      const { score, breakdown } = scoreArticle(profile, article);
      return { ...article, score, scoreBreakdown: breakdown };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Same as recommend, but skips article IDs in excludeIds first (for “show me more”).
 * If fewer than topN remain unseen, fills from the full ranked list so the user
 * always gets a full briefing (may include lower-ranked or previously seen items).
 */
export function recommendWithExclusions(
  profile: UserProfile,
  articles: Article[],
  excludeIds: string[],
  topN = 8,
): ScoredArticle[] {
  const exclude = new Set(excludeIds.filter(Boolean));
  const scored = articles
    .map((article) => {
      const { score, breakdown } = scoreArticle(profile, article);
      return { ...article, score, scoreBreakdown: breakdown };
    })
    .sort((a, b) => b.score - a.score);

  const out: ScoredArticle[] = [];
  for (const a of scored) {
    if (exclude.has(a.id)) continue;
    out.push(a);
    if (out.length >= topN) break;
  }
  if (out.length < topN) {
    const used = new Set(out.map((x) => x.id));
    for (const a of scored) {
      if (used.has(a.id)) continue;
      out.push(a);
      used.add(a.id);
      if (out.length >= topN) break;
    }
  }
  return out;
}

/**
 * Explain why a specific article was recommended for a user.
 * Useful for debugging and for showing users "why you're seeing this".
 */
export function explain(profile: UserProfile, article: Article): string {
  const { score, breakdown } = scoreArticle(profile, article);
  const positives = breakdown.filter((f) => f.points > 0);
  const negatives = breakdown.filter((f) => f.points < 0);

  const lines: string[] = [`Score: ${score}/100`];
  if (positives.length > 1) {
    // Skip the base factor in the explanation
    const meaningful = positives.filter((f) => f.factor !== "base");
    if (meaningful.length > 0) {
      lines.push("Why relevant: " + meaningful.map((f) => `${f.factor} (+${f.points})`).join(", "));
    }
  }
  if (negatives.length > 0) {
    lines.push("Penalised for: " + negatives.map((f) => `${f.factor} (${f.points})`).join(", "));
  }
  return lines.join("\n");
}
