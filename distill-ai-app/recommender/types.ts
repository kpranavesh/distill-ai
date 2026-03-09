export type ComfortLevel = "skeptic" | "beginner" | "active" | "power";

export type Goal =
  | "stay-informed"
  | "find-tools"
  | "strategic-decisions"
  | "build"
  | "curiosity";

export interface UserProfile {
  role: string;       // e.g. "Engineering / Technical"
  industry: string;   // e.g. "Financial Services"
  comfort: ComfortLevel;
  goal: Goal;
  aiTools: string[];  // e.g. ["ChatGPT", "Cursor"]
}

export interface Article {
  id: string;
  title: string;
  topic: string;      // RSS feed topic label
  source: string;     // "openai" | "anthropic" | "google-ai" etc.
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
