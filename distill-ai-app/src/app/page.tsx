"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DepthPreference = "practical" | "strategic" | "technical" | "research";

type SeniorityLevel = "new" | "mid" | "senior" | "executive";

type Goal =
  | "stay-informed"
  | "find-tools"
  | "strategic-decisions"
  | "build"
  | "understand";

interface UserProfile {
  name: string;
  role: string;
  industry: string;
  depth: DepthPreference;
  goals: Goal[];
  seniority: SeniorityLevel;
  negativeSignals: string[];
  aiTools: string[];
  topicsBoosted: string[];
}

interface BriefingItem {
  id: string;
  title: string;
  topic: string;
  comfortSummary: string;
  whyItMatters: string;
  source?: string;
  link?: string;
  published?: string | null;
  tryThis?: string;
  relevanceScore?: number;
}

type ToolCategory =
  | "Writing"
  | "Images"
  | "Research"
  | "Data"
  | "Business"
  | "Creative"
  | "Personal";

type BudgetTier = "free" | "20" | "50" | "no-limit";

interface Tool {
  id: string;
  name: string;
  categories: ToolCategory[];
  description: string;
  priceTier: BudgetTier;
  strengths: string;
  limitations: string;
  bestFor: string;
  link: string;
  rating: number;
}

const VISIBLE_BRIEFING_LIMIT = 5;

// Role = job function (what you do). Industry = sector (where you work). No overlap.
const ROLE_OPTIONS: { value: string; label: string; subtitle: string }[] = [
  { value: "engineering", label: "Engineering / Technical", subtitle: "Software, systems, technical lead" },
  { value: "product", label: "Product", subtitle: "Roadmap, requirements, prioritization" },
  { value: "design", label: "Design", subtitle: "UX, UI, brand, creative" },
  { value: "data", label: "Data / Analytics", subtitle: "Reporting, insights, data science" },
  { value: "operations", label: "Operations", subtitle: "Processes, supply chain, internal ops" },
  { value: "sales", label: "Sales / BD", subtitle: "Revenue, partnerships, outreach" },
  { value: "marketing", label: "Marketing / Growth", subtitle: "Demand, content, campaigns" },
  { value: "hr", label: "HR / People", subtitle: "Talent, culture, people ops" },
  { value: "finance", label: "Finance / Accounting", subtitle: "Budget, reporting, controllership" },
  { value: "legal", label: "Legal / Compliance", subtitle: "Contracts, risk, regulatory" },
  { value: "executive", label: "Executive / Leadership", subtitle: "C-suite, VP, Director — strategy, teams" },
  { value: "founder", label: "Founder / Solo", subtitle: "Run the business, wear many hats" },
  { value: "clinical", label: "Clinical / Care delivery", subtitle: "Patient-facing: clinicians, care managers" },
  { value: "educator", label: "Educator / Teaching", subtitle: "Teaching, curriculum, training" },
  { value: "other", label: "Other", subtitle: "" },
];

const INDUSTRY_OPTIONS: { value: string; label: string; subtitle: string }[] = [
  { value: "technology", label: "Technology / Software", subtitle: "SaaS, infra, dev tools" },
  { value: "healthcare", label: "Healthcare / Life sciences", subtitle: "Providers, payers, pharma, health tech" },
  { value: "financial-services", label: "Financial services", subtitle: "Banking, insurance, asset management" },
  { value: "retail", label: "Retail / Consumer / E‑commerce", subtitle: "D2C, marketplaces, consumer brands" },
  { value: "manufacturing", label: "Manufacturing / Industrial", subtitle: "Production, logistics, industrial" },
  { value: "government", label: "Government / Public sector", subtitle: "Gov, public admin, defense" },
  { value: "nonprofit", label: "Nonprofit / Social impact", subtitle: "NGOs, foundations, social enterprises" },
  { value: "education", label: "Education", subtitle: "K–12, higher ed, edtech, training" },
  { value: "professional-services", label: "Professional services / Consulting", subtitle: "Consulting, advisory, legal firms" },
  { value: "media", label: "Media / Entertainment", subtitle: "Publishing, entertainment, agencies" },
  { value: "other", label: "Other", subtitle: "" },
];

function getRoleLabel(value: string): string {
  return (ROLE_OPTIONS.find((r) => r.value === value)?.label ?? value) || "—";
}
function getIndustryLabel(value: string): string {
  return (INDUSTRY_OPTIONS.find((i) => i.value === value)?.label ?? value) || "—";
}

const DEPTH_OPTIONS: { value: DepthPreference; label: string; subtitle: string }[] = [
  { value: "practical",  label: "Practical",  subtitle: "Show me what I can use tomorrow" },
  { value: "strategic",  label: "Strategic",  subtitle: "Business impact and where this is heading" },
  { value: "technical",  label: "Technical",  subtitle: "I want to understand how it actually works" },
  { value: "research",   label: "Research",   subtitle: "Give me the papers and benchmarks" },
];

const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string; subtitle: string }[] = [
  { value: "new",       label: "Just getting started", subtitle: "New to my field (0–3 years)" },
  { value: "mid",       label: "Mid-level",            subtitle: "Finding my footing (3–8 years)" },
  { value: "senior",    label: "Senior",               subtitle: "Deep expertise (8+ years)" },
  { value: "executive", label: "Executive / Leader",   subtitle: "Leading teams or organisations" },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "stay-informed",      label: "Stay ahead of what's happening" },
  { value: "find-tools",         label: "Find tools for my workflow" },
  { value: "strategic-decisions",label: "Make smarter business decisions" },
  { value: "build",              label: "Build products with AI" },
  { value: "understand",         label: "Understand what AI actually is" },
];

const NEGATIVE_SIGNAL_OPTIONS = [
  "Too technical",
  "Too basic / beginner",
  "AI hype & fluff",
  "Vendor announcements",
  "Research papers",
];

const STATIC_BRIEFING_EXAMPLES: BriefingItem[] = [
  {
    id: "static-sora",
    title: "Sora 2 turns plain‑language prompts into marketing videos",
    topic: "AI for images & video",
    comfortSummary:
      "OpenAI’s Sora 2 lets you create short, polished videos by describing the scene in everyday language instead of editing timelines and layers.",
    whyItMatters:
      "For your work, this shrinks the time to test new creative from weeks to hours — without needing an agency or video editor.",
    tryThis:
      "Pick one upcoming campaign and storyboard a 15‑second ad in plain language. Use any text‑to‑video tool to generate three versions and share with your team for feedback.",
  },
  {
    id: "static-notes",
    title: "AI note‑takers are finally good enough for busy teams",
    topic: "Productivity & automation",
    comfortSummary:
      "Modern AI tools can now sit in on your meetings, capture who said what, and give you a clear summary and action list.",
    whyItMatters:
      "Most of your impact comes from decisions and follow‑through. Offloading basic note‑taking frees you to focus on the room — and reduces dropped balls.",
    tryThis:
      "Choose one recurring meeting this week and pilot an AI note‑taker. Compare its action list with your own and decide whether to roll it out more broadly.",
  },
  {
    id: "static-stack",
    title: 'From "too many tools" to a personal AI stack',
    topic: "AI tools for writing",
    comfortSummary:
      "Instead of trying every new app, many professionals are settling on a simple stack: one main assistant, one writing tool, and one tool for visuals.",
    whyItMatters:
      "Choosing one or two tools to go deeper on will beat dabbling in ten different apps.",
    tryThis:
      "Use the Tool Recommender below to pick one writing assistant and one creativity tool that fit your budget, then commit to using them for two weeks.",
  },
];

const TOOLS: Tool[] = [
  {
    id: "claude",
    name: "Claude",
    categories: ["Writing", "Research", "Business"],
    description:
      "Thoughtful AI assistant that’s strong at long‑form writing, analysis, and working with large documents.",
    priceTier: "20",
    strengths:
      "Great for long documents, nuanced writing, and explaining complex topics in plain English.",
    limitations:
      "Not specialized for images or video; best used alongside a dedicated creative tool if visuals matter.",
    bestFor:
      "Non‑technical professionals who want help with deep thinking, writing, and decision support.",
    link: "https://claude.ai",
    rating: 4.8,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    categories: ["Writing", "Research", "Personal"],
    description:
      "General‑purpose AI assistant that can help with writing, ideation, and everyday questions.",
    priceTier: "20",
    strengths:
      "Very flexible, lots of examples and tutorials online, works well for quick drafting and brainstorming.",
    limitations:
      "Can feel generic without clear prompts; not always the best fit for very long or detailed documents.",
    bestFor:
      "People who want one familiar ‘do‑most‑things’ assistant to start experimenting with AI.",
    link: "https://chat.openai.com",
    rating: 4.6,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    categories: ["Research", "Business", "Personal"],
    description:
      "AI‑powered research assistant that answers questions with sources you can click and read.",
    priceTier: "free",
    strengths:
      "Great when you want fast, sourced answers instead of reading a dozen tabs. Helpful for market and competitive research.",
    limitations:
      "Not a replacement for deep expert review; you still need to sanity‑check important decisions.",
    bestFor:
      "Professionals who often research new topics and want quick, sourced overviews instead of generic answers.",
    link: "https://www.perplexity.ai",
    rating: 4.7,
  },
  {
    id: "notion-ai",
    name: "Notion AI",
    categories: ["Writing", "Business"],
    description:
      "AI built into Notion for tidying notes, summarising docs, and turning messy ideas into structure.",
    priceTier: "20",
    strengths:
      "Shines when you already use Notion for docs and task tracking; keeps everything in one place.",
    limitations:
      "Less compelling if your team doesn’t live in Notion; not meant as a standalone chat assistant.",
    bestFor:
      "Teams and individuals who already use Notion and want AI woven into their existing workflows.",
    link: "https://www.notion.so/product/ai",
    rating: 4.4,
  },
  {
    id: "midjourney",
    name: "Midjourney",
    categories: ["Images", "Creative"],
    description:
      "AI image generator for high‑quality, stylised visuals based on text prompts.",
    priceTier: "20",
    strengths:
      "Produces striking visuals for campaigns, thumbnails, and concept art once you find prompts you like.",
    limitations:
      "Requires Discord; not ideal if you want a simple, traditional app experience.",
    bestFor:
      "Creators and marketers who care a lot about visual style and are willing to experiment a little.",
    link: "https://www.midjourney.com",
    rating: 4.5,
  },
  {
    id: "canva",
    name: "Canva with AI",
    categories: ["Images", "Creative", "Business"],
    description:
      "Design tool with AI features for turning ideas into slides, social posts, and simple videos.",
    priceTier: "free",
    strengths:
      "Very friendly for non‑designers; great templates and brand kits for small teams.",
    limitations:
      "Not as powerful as specialist design suites for complex campaigns.",
    bestFor:
      "Small businesses, nonprofits, and solo creators who need good‑looking visuals quickly.",
    link: "https://www.canva.com",
    rating: 4.7,
  },
  {
    id: "otter",
    name: "Otter",
    categories: ["Business", "Data"],
    description:
      "AI note‑taker that records meetings, creates summaries, and pulls out action items.",
    priceTier: "free",
    strengths:
      "Easy way to capture and share meeting notes so nothing falls through the cracks.",
    limitations:
      "Best suited to online meetings; quality can drop with very noisy audio.",
    bestFor:
      "Busy teams and leaders who want to stop taking manual notes in every meeting.",
    link: "https://otter.ai",
    rating: 4.3,
  },
  {
    id: "sheet-ai",
    name: "AI for spreadsheets",
    categories: ["Data", "Business"],
    description:
      "Helpers like Rows, Hex, and AI‑powered Google Sheets that turn plain‑language questions into formulas and charts.",
    priceTier: "50",
    strengths:
      "Great for people who live in spreadsheets but don’t love complex formulas.",
    limitations:
      "Often requires a bit of setup to connect to your data cleanly.",
    bestFor:
      "Operators, analysts, and small‑business owners who want data answers without hiring a data team.",
    link: "https://workspace.google.com/marketplace/category/works-with-docs-sheets",
    rating: 4.2,
  },
];

const BUDGET_LABELS: { value: BudgetTier; label: string }[] = [
  { value: "free", label: "Free only" },
  { value: "20", label: "Up to $20 / month" },
  { value: "50", label: "Up to $50 / month" },
  { value: "no-limit", label: "Budget isn’t a big concern" },
];

const REQUIREMENT_OPTIONS = [
  "Works well on mobile",
  "Team collaboration features",
  "Stronger data privacy controls",
  "Good free tier",
];

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function scoreToolForUser(
  tool: Tool,
  category: ToolCategory | null,
  budget: BudgetTier | null,
): number {
  let score = 0;
  if (category && tool.categories.includes(category)) {
    score += 4;
  }

  if (budget) {
    const rank: Record<BudgetTier, number> = {
      free: 0,
      "20": 1,
      "50": 2,
      "no-limit": 3,
    };
    if (rank[budget] >= rank[tool.priceTier]) {
      score += 2;
    } else {
      score -= 1;
    }
  }

  if (tool.priceTier === "free") {
    score += 1;
  }

  return score;
}

function SignOutButton() {
  const router = useRouter();
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 ring-1 ring-slate-700/80 hover:ring-slate-600"
    >
      Sign out
    </button>
  );
}

/** Split script into smaller chunks so the first chunk can play in ~1–2s instead of waiting for the full script. */
function chunkTextForAudio(text: string, maxChunkChars = 500): string[] {
  if (!text.trim()) return [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current.length + s.length + 1 <= maxChunkChars) {
      current = current ? `${current} ${s}` : s;
    } else {
      if (current) chunks.push(current);
      current = s;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [draftProfile, setDraftProfile] = useState<UserProfile>({
    name: "",
    role: "",
    industry: "",
    depth: "practical",
    goals: ["stay-informed"],
    seniority: "mid",
    negativeSignals: [],
    aiTools: [],
    topicsBoosted: [],
  });

  const [activeSection, setActiveSection] = useState<"briefing" | "tools">("briefing");

  const [quizStep, setQuizStep] = useState(0);
  const [quizCategory, setQuizCategory] = useState<ToolCategory | null>(null);
  const [quizTaskDescription, setQuizTaskDescription] = useState("");
  const [quizUsedTools, setQuizUsedTools] = useState("");
  const [quizBudget, setQuizBudget] = useState<BudgetTier | null>("free");
  const [quizRequirements, setQuizRequirements] = useState<string[]>([]);
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [briefingItems, setBriefingItems] = useState<BriefingItem[]>([]);
  const [activeRecommendationSessionId, setActiveRecommendationSessionId] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [podcastPlaying, setPodcastPlaying] = useState(false);
  const [podcastReady, setPodcastReady] = useState(false);
  const [podcastError, setPodcastError] = useState<string | null>(null);
  const [podcastDuration, setPodcastDuration] = useState(0);
  const [podcastCurrentTime, setPodcastCurrentTime] = useState(0);
  const podcastAudioRef = useRef<HTMLAudioElement | null>(null);
  const podcastUrlRef = useRef<string | null>(null);
  const briefingFetchSeq = useRef(0);
  const loadBriefingRef = useRef<(excludeIds: string[]) => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/profile", { signal: controller.signal, cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const hasOnboarding = data?.role && data?.industry;
        if (hasOnboarding) {
          setProfile({
            name: data.name ?? "",
            role: data.role ?? "",
            industry: data.industry ?? "",
            depth: data.depth ?? "practical",
            goals: Array.isArray(data.goals) ? data.goals : ["stay-informed"],
            seniority: data.seniority ?? "mid",
            negativeSignals: Array.isArray(data.negativeSignals) ? data.negativeSignals : [],
            aiTools: Array.isArray(data.aiTools) ? data.aiTools : [],
            topicsBoosted: Array.isArray(data.topicsBoosted) ? data.topicsBoosted : [],
          });
        }
      } finally {
        setProfileLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!profile) return;

    loadBriefingRef.current = async (excludeIds: string[]) => {
      const seq = ++briefingFetchSeq.current;
      setBriefingLoading(true);
      setBriefingError(null);
      try {
        const params = new URLSearchParams({
          role: profile.role ?? "",
          industry: profile.industry ?? "",
          depth: profile.depth ?? "practical",
          goals: (profile.goals ?? ["stay-informed"]).join(","),
          seniority: profile.seniority ?? "mid",
          negativeSignals: (profile.negativeSignals ?? []).join(","),
          aiTools: (profile.aiTools ?? []).join(","),
          _t: Date.now().toString(),
        });
        for (const id of excludeIds) {
          if (id) params.append("exclude", id);
        }
        const res = await fetch(`/api/briefing?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Failed to load briefing");
        }
        const data = await res.json();
        if (briefingFetchSeq.current !== seq) return;
        setActiveRecommendationSessionId(
          typeof data.sessionId === "string" ? data.sessionId : null,
        );
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const items: BriefingItem[] = rawItems.map((item: Record<string, unknown>) => ({
          id: String(item?.id ?? ""),
          title: String(item?.title ?? ""),
          topic: String(item?.topic ?? ""),
          comfortSummary: typeof item?.comfortSummary === "string" ? item.comfortSummary : "",
          whyItMatters: typeof item?.whyItMatters === "string" ? item.whyItMatters : "",
          source: item?.source,
          link: item?.link,
          published: item?.published ?? null,
          relevanceScore: item?.relevanceScore,
        }));
        if (!items.length) {
          setBriefingItems(STATIC_BRIEFING_EXAMPLES);
        } else {
          setBriefingItems(items);
        }
      } catch {
        if (briefingFetchSeq.current !== seq) return;
        setBriefingError(
          "Distill couldn’t reach its sources right now. Here’s a sample briefing instead.",
        );
        setBriefingItems(STATIC_BRIEFING_EXAMPLES);
        setActiveRecommendationSessionId(null);
      } finally {
        if (briefingFetchSeq.current === seq) {
          setBriefingLoading(false);
        }
      }
    };

    void loadBriefingRef.current([]);
  }, [profile]);

  function handleRefreshBriefingFeed() {
    const ids = personalisedBriefing.map((i) => i.id).filter(Boolean);
    void loadBriefingRef.current(ids);
    setPodcastReady(false);
    setPodcastPlaying(false);
    setPodcastCurrentTime(0);
    setPodcastDuration(0);
    setPodcastError(null);
    const el = podcastAudioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    if (podcastUrlRef.current) {
      URL.revokeObjectURL(podcastUrlRef.current);
      podcastUrlRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (podcastUrlRef.current) {
        URL.revokeObjectURL(podcastUrlRef.current);
        podcastUrlRef.current = null;
      }
    };
  }, []);

  const personalisedBriefing = useMemo(() => {
    if (!profile) return [] as BriefingItem[];
    return briefingItems.filter((item) => {
      const muted = profile.negativeSignals.some((s) =>
        item.topic.toLowerCase().includes(s.toLowerCase()),
      );
      return !muted;
    });
  }, [briefingItems, profile]);

  const recommendedTools = useMemo(() => {
    if (!showQuizResults) return [] as Tool[];
    return [...TOOLS]
      .map((tool) => ({
        tool,
        score: scoreToolForUser(tool, quizCategory, quizBudget),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.tool);
  }, [showQuizResults, quizCategory, quizBudget]);

  const handleCompleteOnboarding = async () => {
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftProfile),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to save profile");
      setProfile(draftProfile);
      setActiveSection("briefing");
    } catch {
      setProfile(draftProfile);
      setActiveSection("briefing");
    }
  };

  const handleToggleRequirement = (label: string) => {
    setQuizRequirements((prev) =>
      prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label],
    );
  };

  const handleShowRecommendations = () => {
    setShowQuizResults(true);
  };

  const handleStartPodcast = async () => {
    if (!profile || personalisedBriefing.length === 0) return;
    setPodcastError(null);
    setPodcastLoading(true);
    try {
      const items = personalisedBriefing.slice(0, 8).map((item) => ({
        title: item.title,
        topic: item.topic,
        comfortSummary: item.comfortSummary,
        whyItMatters: item.whyItMatters,
        relevanceScore: item.relevanceScore,
      }));
      const res = await fetch("/api/podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          profile: {
            role: profile.role,
            industry: profile.industry,
            seniority: profile.seniority,
            depth: profile.depth,
            goals: profile.goals,
          },
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `Podcast failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (podcastUrlRef.current) URL.revokeObjectURL(podcastUrlRef.current);
      podcastUrlRef.current = url;
      const el = podcastAudioRef.current;
      if (el) {
        el.src = url;
        setPodcastCurrentTime(0);
        setPodcastDuration(0);
        setPodcastReady(true);
        await el.play();
      }
    } catch (e) {
      setPodcastError(e instanceof Error ? e.message : "Could not generate podcast.");
    } finally {
      setPodcastLoading(false);
    }
  };

  /** Update topic preference from "This was useful" (boost) or "Not relevant" (mute), then persist. */
  const handleTopicFeedback = async (item: BriefingItem, type: "muted" | "boosted") => {
    const topic = item.topic;
    if (!profile || !topic.trim()) return;
    const next = type === "muted"
      ? {
          ...profile,
          negativeSignals: [...new Set([...profile.negativeSignals, topic])],
          topicsBoosted: profile.topicsBoosted.filter((t) => t !== topic),
        }
      : {
          ...profile,
          topicsBoosted: [...new Set([...profile.topicsBoosted, topic])],
          negativeSignals: profile.negativeSignals.filter((t) => t !== topic),
        };
    setProfile(next);
    try {
      const payload = {
        ...next,
        feedback: activeRecommendationSessionId
          ? {
              sessionId: activeRecommendationSessionId,
              articleId: item.id,
              topic,
              feedbackType: type,
            }
          : undefined,
      };
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    } catch {
      // Revert on failure
      setProfile(profile);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-12">
        <header className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
              Distill AI — your AI briefing, zero noise.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Distill cuts through the weekly AI noise to surface the updates that actually change how you work, plus tools worth trying.
            </p>
          </div>
          {profile && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-900/80 px-4 py-3 text-sm text-slate-200 ring-1 ring-slate-700/80 sm:mt-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                {profile.name ? profile.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div>
                <div className="font-medium">
                  {profile.name || "Your Distill AI profile"}
                </div>
                <div className="text-slate-400">
                  {getRoleLabel(profile.role) || "Role not set"} ·{" "}
                  {DEPTH_OPTIONS.find((d) => d.value === profile.depth)?.label ?? "Practical"}
                </div>
              </div>
            </div>
          )}
        </header>

        {profileLoading ? (
          <section className="flex min-h-[40vh] items-center justify-center">
            <div className="text-slate-400">Loading your profile…</div>
          </section>
        ) : !profile ? (
          <section className="grid gap-6 md:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
            <div className="rounded-3xl bg-slate-900/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.8)] ring-1 ring-slate-700/80 sm:p-7">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">
                    Let&apos;s personalise your briefing
                  </h2>
                  <p className="mt-1 text-sm text-slate-300 sm:text-sm">
                    Three quick questions and we&apos;ll filter the noise for you.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-sm text-slate-400">
                  <span>
                    Step {onboardingStep + 1} of 3
                  </span>
                </div>
              </div>

              {onboardingStep === 0 && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-200">
                        What do you do?
                      </label>
                      <p className="mt-0.5 text-sm text-slate-400">
                        Your primary job function — what you spend most of your time on.
                      </p>
                      <select
                        value={draftProfile.role}
                        onChange={(e) =>
                          setDraftProfile((p) => ({ ...p, role: e.target.value }))
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-700/80 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-50 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">Select your role</option>
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-200">
                        What industry are you in?
                      </label>
                      <p className="mt-0.5 text-sm text-slate-400">
                        The sector or domain you work in.
                      </p>
                      <select
                        value={draftProfile.industry}
                        onChange={(e) =>
                          setDraftProfile((p) => ({
                            ...p,
                            industry: e.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-700/80 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-50 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">Select your industry</option>
                        {INDUSTRY_OPTIONS.map((i) => (
                          <option key={i.value} value={i.value}>
                            {i.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {draftProfile.role && draftProfile.industry && (
                    <p className="mt-3 rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/30">
                      We’ll personalize for a{" "}
                      <span className="font-medium">{getRoleLabel(draftProfile.role)}</span> in{" "}
                      <span className="font-medium">{getIndustryLabel(draftProfile.industry)}</span>.
                    </p>
                  )}
                </div>
              )}

              {onboardingStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-slate-200">
                      How deep do you want to go?
                    </label>
                    <p className="mt-0.5 text-sm text-slate-400">
                      We'll match article complexity to your preference.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {DEPTH_OPTIONS.map((opt) => {
                        const active = draftProfile.depth === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setDraftProfile((p) => ({ ...p, depth: opt.value }))
                            }
                            className={`flex flex-col items-start rounded-2xl border px-3 py-3 text-left text-sm ${
                              active
                                ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                                : "border-slate-700/80 bg-slate-900/60 text-slate-100 hover:border-slate-500"
                            }`}
                          >
                            <span className="font-medium">{opt.label}</span>
                            <span className="mt-1 text-sm text-slate-300">{opt.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-200">
                      What&apos;s your main reason for being here?
                    </label>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {GOAL_OPTIONS.map((goal) => {
                        const active = draftProfile.goals[0] === goal.value;
                        return (
                          <button
                            key={goal.value}
                            type="button"
                            onClick={() =>
                              setDraftProfile((p) => ({ ...p, goals: [goal.value] }))
                            }
                            className={`rounded-2xl border px-3 py-2 text-left text-sm ${
                              active
                                ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                                : "border-slate-700/80 bg-slate-900/60 text-slate-100 hover:border-slate-500"
                            }`}
                          >
                            {goal.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-slate-200">
                      How long have you been in your field?
                    </label>
                    <p className="mt-0.5 text-sm text-slate-400">
                      We&apos;ll calibrate article depth to match your experience level.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {SENIORITY_OPTIONS.map((opt) => {
                        const active = draftProfile.seniority === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setDraftProfile((p) => ({ ...p, seniority: opt.value }))
                            }
                            className={`flex flex-col items-start rounded-2xl border px-3 py-3 text-left text-sm ${
                              active
                                ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                                : "border-slate-700/80 bg-slate-900/60 text-slate-100 hover:border-slate-500"
                            }`}
                          >
                            <span className="font-medium">{opt.label}</span>
                            <span className="mt-1 text-sm text-slate-300">{opt.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-200">
                      What do you want less of? <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Tap anything you don&apos;t want filling your briefing.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {NEGATIVE_SIGNAL_OPTIONS.map((signal) => {
                        const selected = draftProfile.negativeSignals.includes(signal);
                        return (
                          <button
                            key={signal}
                            type="button"
                            onClick={() =>
                              setDraftProfile((p) => ({
                                ...p,
                                negativeSignals: selected
                                  ? p.negativeSignals.filter((s) => s !== signal)
                                  : [...p.negativeSignals, signal],
                              }))
                            }
                            className={`rounded-full border px-3 py-1.5 text-sm ${
                              selected
                                ? "border-rose-400 bg-rose-500/10 text-rose-200"
                                : "border-slate-700/80 bg-slate-900/60 text-slate-100 hover:border-slate-500"
                            }`}
                          >
                            {selected ? `— ${signal}` : signal}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  disabled={onboardingStep === 0}
                  onClick={() =>
                    setOnboardingStep((s) => (s > 0 ? s - 1 : s))
                  }
                  className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-40"
                >
                  Back
                </button>
                {onboardingStep < 2 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOnboardingStep((s) => (s < 2 ? s + 1 : s))
                    }
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400"
                  >
                    Next
                    <span>→</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCompleteOnboarding}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400"
                  >
                    Generate my briefing
                    <span>✨</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-3xl bg-slate-900/60 p-5 ring-1 ring-slate-700/80 sm:p-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-50">
                  What you’ll walk away with
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
                  <li>
                    <span className="mr-1 text-emerald-400">•</span>
                    3–5 updates that actually matter to your role — not every headline.
                  </li>
                  <li>
                    <span className="mr-1 text-emerald-400">•</span>
                    Plain-English summaries and why each update matters to your role.
                  </li>
                  <li>
                    <span className="mr-1 text-emerald-400">•</span>
                    A quick quiz that finds 2–3 AI tools that fit your work and budget.
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl bg-slate-900/80 px-4 py-3 text-sm text-slate-300 ring-1 ring-slate-700/80">
                <p className="font-medium text-slate-100">
                  &quot;There&apos;s a million AI updates a week.
                </p>
                <p className="mt-1">
                  Distill tells you which three actually matter to you — and what
                  to do about them.&quot;
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-3">
              <nav className="flex flex-1 gap-2 rounded-full bg-slate-900/80 p-1 text-sm ring-1 ring-slate-700/80 sm:text-sm">
                {[
                  { id: "briefing", label: "Your briefing" },
                  { id: "tools", label: "AI Tool Recommender" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setActiveSection(tab.id as "briefing" | "tools")
                    }
                    className={`flex-1 rounded-full px-3 py-1.5 font-medium ${
                      activeSection === tab.id
                        ? "bg-slate-50 text-slate-950"
                        : "text-slate-300 hover:text-slate-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              <SignOutButton />
            </div>

            {activeSection === "briefing" && (
              <section className="flex flex-1 flex-col gap-6">
                <div className="flex flex-col gap-3 rounded-3xl bg-slate-900/80 p-4 ring-1 ring-slate-700/80 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-50">🎙️ Listen to your briefing</h3>
                      <p className="mt-1 text-sm text-slate-300">
                        Two hosts, natural banter — Alex and Jordan walk through today&apos;s updates in a short, conversational episode.
                      </p>
                    </div>
                    <div className="text-xs text-slate-400">
                      {podcastReady && podcastDuration > 0
                        ? `Total: ${formatTime(podcastDuration)}`
                        : "Ready in ~a minute once generated"}
                    </div>
                  </div>
                  <audio
                    ref={podcastAudioRef}
                    onPlay={() => setPodcastPlaying(true)}
                    onPause={() => setPodcastPlaying(false)}
                    onEnded={() => {
                      setPodcastPlaying(false);
                      setPodcastCurrentTime(0);
                    }}
                    onLoadedMetadata={() => {
                      const el = podcastAudioRef.current;
                      if (el && Number.isFinite(el.duration)) {
                        setPodcastDuration(el.duration);
                      }
                    }}
                    onTimeUpdate={() => {
                      const el = podcastAudioRef.current;
                      if (el) {
                        setPodcastCurrentTime(el.currentTime);
                        if (!podcastDuration && Number.isFinite(el.duration)) {
                          setPodcastDuration(el.duration);
                        }
                      }
                    }}
                  />
                  <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={podcastLoading || personalisedBriefing.length === 0}
                        onClick={() => {
                          if (podcastLoading) return;
                          const el = podcastAudioRef.current;
                          if (!el) return;
                          if (!podcastReady || !el.src) {
                            handleStartPodcast();
                            return;
                          }
                          if (podcastPlaying) {
                            el.pause();
                          } else {
                            void el.play();
                          }
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-950 shadow-md shadow-slate-950/40 hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-60"
                      >
                        {podcastLoading ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                        ) : podcastPlaying ? (
                          "❚❚"
                        ) : (
                          "▶"
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={!podcastReady}
                        onClick={() => {
                          const el = podcastAudioRef.current;
                          if (!el) return;
                          el.currentTime = Math.max(0, el.currentTime - 15);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/70 disabled:pointer-events-none disabled:opacity-50"
                      >
                        ↺ 15s
                      </button>
                      <button
                        type="button"
                        disabled={!podcastReady}
                        onClick={() => {
                          const el = podcastAudioRef.current;
                          if (!el) return;
                          const target = el.currentTime + 15;
                          el.currentTime = podcastDuration ? Math.min(podcastDuration, target) : target;
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/70 disabled:pointer-events-none disabled:opacity-50"
                      >
                        15s ↻
                      </button>
                    </div>
                    <div className="flex flex-1 items-center gap-3">
                      <span className="w-10 text-right text-xs tabular-nums text-slate-400">
                        {formatTime(podcastCurrentTime)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={podcastDuration || 0}
                        step={1}
                        value={Math.min(podcastCurrentTime, podcastDuration || podcastCurrentTime)}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setPodcastCurrentTime(next);
                          const el = podcastAudioRef.current;
                          if (el && Number.isFinite(next)) {
                            el.currentTime = next;
                          }
                        }}
                        disabled={!podcastReady || !podcastDuration}
                        className="flex-1 cursor-pointer accent-emerald-400 disabled:cursor-default"
                      />
                      <span className="w-12 text-xs tabular-nums text-slate-400 text-right">
                        {podcastDuration
                          ? `-${formatTime(Math.max(0, podcastDuration - podcastCurrentTime))}`
                          : "-0:00"}
                      </span>
                    </div>
                  </div>
                  {podcastError && (
                    <p className="mt-1 text-xs text-amber-300">
                      {podcastError}
                      <button
                        type="button"
                        onClick={() => {
                          setPodcastError(null);
                          setPodcastReady(false);
                          setPodcastCurrentTime(0);
                          setPodcastDuration(0);
                          handleStartPodcast();
                        }}
                        className="ml-1 underline"
                      >
                        Retry
                      </button>
                    </p>
                  )}
                </div>
                <div className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-slate-700/80 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-50 sm:text-lg">
                        Here’s what matters today
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Picked for {getRoleLabel(profile.role) || "you"} in{" "}
                        {getIndustryLabel(profile.industry) || "your industry"} — tuned to your level.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={briefingLoading || !profile}
                        onClick={handleRefreshBriefingFeed}
                        title="Fetch a new set of stories (podcast will use the new list after refresh)"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-700/80 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <span
                          className={`inline-block ${briefingLoading ? "animate-spin" : ""}`}
                          aria-hidden
                        >
                          ↻
                        </span>
                        Refresh feed
                      </button>
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
                        {Math.min(personalisedBriefing.length || 0, VISIBLE_BRIEFING_LIMIT) || 3} items · ~10 minutes
                      </span>
                    </div>
                  </div>
                  {briefingLoading && (
                    <p className="text-sm text-slate-300">
                      Pulling in fresh AI updates that match your profile…
                    </p>
                  )}
                  {!briefingLoading && briefingError && (
                    <p className="mb-3 text-sm text-amber-300">{briefingError}</p>
                  )}
                  {!briefingLoading && personalisedBriefing.length === 0 && (
                    <p className="text-sm text-slate-300">
                      Your profile is a bit niche, so we’re still learning what
                      matters most. For now, you’ll see a general briefing based on
                      popular topics for people like you.
                    </p>
                  )}
                  {!briefingLoading && personalisedBriefing.length > 0 && (
                    <div className="space-y-4">
                      {personalisedBriefing.slice(0, VISIBLE_BRIEFING_LIMIT).map((item, index) => (
                        <article
                          key={item.id}
                          className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 text-sm leading-relaxed"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-sm text-slate-200">
                              {index + 1}
                            </span>
                            <span>{item.topic}</span>
                            {item.source && (
                              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                {item.source}
                              </span>
                            )}
                            {item.published && (
                              <span className="text-slate-500">
                                {formatDate(item.published)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-slate-50">
                              {item.title}
                            </h3>
                            {item.relevanceScore !== undefined && (
                              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                                {item.relevanceScore}% match
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                            {typeof item.comfortSummary === "string" ? item.comfortSummary : ""}
                          </p>
                          {typeof item.whyItMatters === "string" && item.whyItMatters && (
                            <p className="mt-2 text-sm text-slate-200">
                              <span className="font-medium text-emerald-300">
                                Why this matters to you:
                              </span>{" "}
                              {item.whyItMatters}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                            <button
                              type="button"
                              onClick={() => handleTopicFeedback(item, "boosted")}
                              className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
                            >
                              <span aria-hidden>👍</span>
                              <span className="sr-only">Thumbs up</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTopicFeedback(item, "muted")}
                              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 ring-1 ring-slate-700 hover:bg-slate-800"
                            >
                              <span aria-hidden>👎</span>
                              <span className="sr-only">Thumbs down</span>
                            </button>
                            {item.link && (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
                              >
                                Read full article ↗
                              </a>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeSection === "tools" && (
              <section className="grid flex-1 gap-6 md:grid-cols-[minmax(0,1.1fr),minmax(0,1fr)]">
                <div className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-slate-700/80 sm:p-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-50 sm:text-lg">
                        Personalized AI Tool Recommender
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        A short, conversational quiz that suggests 2–3 tools for
                        what you actually need right now.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200">
                      4 quick questions
                    </span>
                  </div>

                  <div className="space-y-5">
                    {quizStep === 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-200">
                          1. What do you want to use AI for first?
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {[
                            "Writing",
                            "Images",
                            "Research",
                            "Data",
                            "Business",
                            "Creative",
                            "Personal",
                          ].map((category) => {
                            const value = category as ToolCategory;
                            const active = quizCategory === value;
                            return (
                              <button
                                key={category}
                                type="button"
                                onClick={() => setQuizCategory(value)}
                                className={`rounded-2xl border px-3 py-2 text-left text-sm sm:text-sm ${
                                  active
                                    ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                                    : "border-slate-700/80 bg-slate-900/60 text-slate-100 hover:border-slate-500"
                                }`}
                              >
                                {category}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {quizStep === 1 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-200">
                          2. Describe a specific task in plain English.
                        </p>
                        <textarea
                          rows={3}
                          value={quizTaskDescription}
                          onChange={(e) => setQuizTaskDescription(e.target.value)}
                          placeholder='For example: "Draft better cold outreach emails to potential partners."'
                          className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm"
                        />
                        <p className="text-sm text-slate-400">
                          The clearer you are here, the more specific the
                          recommendation can be.
                        </p>
                      </div>
                    )}

                    {quizStep === 2 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-200">
                          3. Have you used any AI tools before?
                        </p>
                        <textarea
                          rows={2}
                          value={quizUsedTools}
                          onChange={(e) => setQuizUsedTools(e.target.value)}
                          placeholder='For example: "I’ve tried ChatGPT but found the answers too generic."'
                          className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm"
                        />
                        <p className="text-sm text-slate-400">
                          This helps avoid recommending something you already know
                          you don’t like.
                        </p>
                      </div>
                    )}

                    {quizStep === 3 && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            4. Budget and must‑haves
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {BUDGET_LABELS.map((budget) => {
                              const active = quizBudget === budget.value;
                              return (
                                <button
                                  key={budget.value}
                                  type="button"
                                  onClick={() => setQuizBudget(budget.value)}
                                  className={`rounded-2xl border px-3 py-2 text-left text-sm sm:text-sm ${
                                    active
                                      ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                                      : "border-slate-700/80 bg-slate-900/60 text-slate-100 hover:border-slate-500"
                                  }`}
                                >
                                  {budget.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            Any special requirements?
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {REQUIREMENT_OPTIONS.map((req) => {
                              const active = quizRequirements.includes(req);
                              return (
                                <button
                                  key={req}
                                  type="button"
                                  onClick={() => handleToggleRequirement(req)}
                                  className={`rounded-full border px-3 py-1.5 text-sm ${
                                    active
                                      ? "border-sky-400 bg-sky-500/10 text-sky-100"
                                      : "border-slate-700/80 bg-slate-900/60 text-slate-100 hover:border-slate-500"
                                  }`}
                                >
                                  {req}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={quizStep === 0}
                      onClick={() =>
                        setQuizStep((s) => (s > 0 ? s - 1 : s))
                      }
                      className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-40"
                    >
                      Back
                    </button>
                    {quizStep < 3 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setQuizStep((s) => (s < 3 ? s + 1 : s))
                        }
                        className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 sm:text-sm"
                      >
                        Next
                        <span>→</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleShowRecommendations}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 sm:text-sm"
                      >
                        See my recommendations
                        <span>✨</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-slate-700/80 sm:p-6">
                    <h3 className="text-sm font-semibold text-slate-50">
                      Your recommended tools
                    </h3>
                    {!showQuizResults ? (
                      <p className="mt-2 text-sm text-slate-300">
                        Answer the questions on the left and Distill will suggest a
                        short list of tools that make sense for your first (or next)
                        use case.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {recommendedTools.map((tool) => (
                          <article
                            key={tool.id}
                            className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 text-sm leading-relaxed sm:text-base"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="font-semibold text-slate-50">
                                  {tool.name}
                                </h4>
                                <p className="mt-1 text-sm uppercase tracking-wide text-slate-400">
                                  {tool.categories.join(" · ")}
                                </p>
                              </div>
                              <div className="text-right text-sm text-slate-300">
                                <div>
                                  {tool.priceTier === "free"
                                    ? "Great free tier"
                                    : tool.priceTier === "20"
                                      ? "≈ $20 / month"
                                      : tool.priceTier === "50"
                                        ? "≈ $50 / month"
                                        : "Flexible pricing"}
                                </div>
                                <div className="mt-1 text-amber-300">
                                  ★ {tool.rating.toFixed(1)}
                                </div>
                              </div>
                            </div>
                            <p className="mt-2 text-slate-300">
                              {tool.description}
                            </p>
                            <p className="mt-2 text-slate-200">
                              <span className="font-medium text-emerald-300">
                                Why Distill picked this:
                              </span>{" "}
                              {tool.bestFor}
                            </p>
                            <p className="mt-2 text-sm text-slate-400">
                              <span className="font-medium">Strengths:</span>{" "}
                              {tool.strengths}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                              <span className="font-medium">Limitations:</span>{" "}
                              {tool.limitations}
                            </p>
                            <a
                              href={tool.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex text-sm font-medium text-emerald-300 hover:text-emerald-200"
                            >
                              Open getting‑started guide ↗
                            </a>
                          </article>
                        ))}
                        {recommendedTools.length === 0 && (
                          <p className="text-sm text-slate-300">
                            Your answers are quite broad, so Distill would likely
                            suggest starting with a general‑purpose assistant like
                            Claude or ChatGPT, then layering on a research or image
                            tool once you’re comfortable.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
