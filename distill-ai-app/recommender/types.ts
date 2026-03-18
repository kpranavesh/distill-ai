export type DepthPreference = "practical" | "strategic" | "technical" | "research";

export type SeniorityLevel = "new" | "mid" | "senior" | "executive";

export type Goal =
  | "stay-informed"
  | "find-tools"
  | "strategic-decisions"
  | "build"
  | "understand";

export interface UserProfile {
  role: string;           // e.g. "engineering"
  industry: string;       // e.g. "healthcare"
  depth: DepthPreference; // how deep they want content
  goals: Goal[];          // what they're here for
  seniority: SeniorityLevel; // experience level in their field
  negativeSignals: string[]; // what they don't want to see
  aiTools: string[];      // tools they already use (dedup)
}

export interface Article {
  id: string;
  title: string;
  topic: string;      // RSS feed topic label
  source: string;     // "openai" | "techcrunch" etc.
  summary: string;
  published: string | null;
  link: string;
}

export interface ScoredArticle extends Article {
  score: number;                             // 0–100
  scoreBreakdown: ScoreFactor[];
}

export interface ScoreFactor {
  factor: string;
  points: number;
}
