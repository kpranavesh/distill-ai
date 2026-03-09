// Quick smoke test — run with: npx ts-node test.ts
import { recommend, explain } from "./index";
import type { UserProfile, Article } from "./types";

const ARTICLES: Article[] = [
  {
    id: "1",
    title: "OpenAI launches GPT-5 API with 128k context",
    topic: "Models & assistants",
    source: "openai",
    summary: "OpenAI today released the GPT-5 API for developers, featuring 128k context, function calling improvements, and lower inference latency. Available in the OpenAI SDK today.",
    published: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // yesterday
    link: "https://openai.com/blog/gpt-5-api",
  },
  {
    id: "2",
    title: "How AI is transforming financial services compliance",
    topic: "Industry trends",
    source: "anthropic",
    summary: "Banks and insurance firms are racing to adopt AI for regulatory compliance and fraud detection. New SEC guidance on AI use in investment advice released this week.",
    published: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    link: "https://example.com/finance-ai",
  },
  {
    id: "3",
    title: "Getting started with ChatGPT — a beginner's guide",
    topic: "Tutorials",
    source: "openai",
    summary: "New to AI? This tutorial walks you through how to use ChatGPT for the first time, from writing your first prompt to understanding what it can and can't do.",
    published: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    link: "https://openai.com/blog/chatgpt-beginners",
  },
  {
    id: "4",
    title: "Anthropic raises $2B, valued at $18B",
    topic: "Safety & Claude",
    source: "anthropic",
    summary: "Anthropic has closed a $2 billion funding round, pushing its valuation to $18 billion. The company cited enterprise demand and competition with OpenAI as drivers.",
    published: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    link: "https://example.com/anthropic-funding",
  },
  {
    id: "5",
    title: "Claude 3.5 benchmark results: reasoning, coding, math",
    topic: "Safety & Claude",
    source: "anthropic",
    summary: "Full benchmark breakdown for Claude 3.5 across MMLU, HumanEval, and MATH. New architecture improves transformer efficiency; context window now 200k tokens.",
    published: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    link: "https://anthropic.com/claude-3-5",
  },
  {
    id: "6",
    title: "Google launches AI tools for marketing teams",
    topic: "Google AI & research",
    source: "google-ai",
    summary: "Google's new AI suite for marketing teams includes campaign optimization, creative generation, and customer segmentation. Available in Google Ads today.",
    published: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    link: "https://blog.google/ai-marketing",
  },
];

// ── Test 1: Finance Executive, strategic-decisions goal ──────────────────────
const financeExec: UserProfile = {
  role: "Executive / C-Suite",
  industry: "Financial Services",
  comfort: "skeptic",
  goal: "strategic-decisions",
  aiTools: ["ChatGPT"],
};

console.log("\n=== Finance Executive (strategic-decisions, skeptic) ===");
const execResults = recommend(financeExec, ARTICLES, 6);
execResults.forEach((a, i) => {
  console.log(`${i + 1}. [${a.score}] ${a.title}`);
});
console.log("\nTop article explanation:");
console.log(explain(financeExec, execResults[0]));

// ── Test 2: Engineer, build goal, already uses ChatGPT ───────────────────────
const engineer: UserProfile = {
  role: "Engineering / Technical",
  industry: "Technology / Software",
  comfort: "power",
  goal: "build",
  aiTools: ["ChatGPT", "Cursor"],
};

console.log("\n=== Engineer (build, power user, uses ChatGPT+Cursor) ===");
const engResults = recommend(engineer, ARTICLES, 6);
engResults.forEach((a, i) => {
  console.log(`${i + 1}. [${a.score}] ${a.title}`);
});
console.log("\nNote: 'Getting started with ChatGPT' should be penalised:");
const chatgptIntro = ARTICLES.find((a) => a.id === "3")!;
console.log(explain(engineer, chatgptIntro));

// ── Test 3: Marketing Growth, find-tools goal ────────────────────────────────
const marketer: UserProfile = {
  role: "Marketing / Growth",
  industry: "Media / Marketing / Creative",
  comfort: "active",
  goal: "find-tools",
  aiTools: [],
};

console.log("\n=== Marketer (find-tools, active user, no tools yet) ===");
const mktResults = recommend(marketer, ARTICLES, 6);
mktResults.forEach((a, i) => {
  console.log(`${i + 1}. [${a.score}] ${a.title}`);
});
