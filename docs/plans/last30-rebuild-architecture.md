# Last-30-Days Rebuild: Architecture Plan for Distill

**Goal:** Rebuild “last N days”–style research so it’s not rate-limited by paid APIs, uses a cheaper model (e.g. Groq), and can be reconfigured as a source for the Distill AI briefing — with room for more social feeds later. Default window: **14 days** (2 weeks) to keep cost low and relevance high.

---

## 1. Current Bottlenecks (Existing last30days Skill)

| Source | Current Backend | Limitation |
|--------|-----------------|------------|
| **Reddit** | ScrapeCreators (preferred) or OpenAI Responses API | ScrapeCreators: 100 free credits then PAYG + rate limits. OpenAI: cost + rate limits. |
| **X/Twitter** | Bird CLI (user tokens), ScrapeCreators, or xAI API | Bird: user token rate limits. xAI: cost. ScrapeCreators: same key/cost as Reddit. |
| **TikTok / Instagram** | ScrapeCreators | Same API key; PAYG after free tier. |
| **YouTube** | yt-dlp (local) | No API cost; can be slow. |
| **HN** | Algolia | Free, no auth, generous limits. |
| **Polymarket** | Gamma API | Free, no auth. |
| **Bluesky / Truth Social** | Optional tokens | Rate limits when used. |
| **Web** | Brave / Parallel / OpenRouter | Optional; cost/limits per provider. |
| **Synthesis** | Claude (in-skill) | No extra API in script; judge/synthesis is the main model in the skill. |

**Main pain points:** ScrapeCreators and xAI/OpenAI drive cost and rate limits. The skill also runs as a single long-lived script (1–5 min) with many parallel HTTP calls, which is brittle under limits.

---

## 2. Design Principles for the Rebuild

1. **Free / high-quota sources first** — Prefer HN, Polymarket, RSS, YouTube (yt-dlp), Reddit public JSON, and other free or high-rate-limit APIs.
2. **Cheap model for all LLM steps** — Use **Groq** (e.g. llama-3.1-8b-instant) for summarization, ranking, and “why it matters” — same as Distill’s existing briefing API.
3. **Distill as primary consumer** — Output is a **briefing-ready stream** (same or compatible shape as current `BriefingItem`), not a one-off report.
4. **Decouple collection from request time** — Avoid “run everything when user asks”; move to **scheduled collection** + **on-read** so we’re not hitting APIs on every user request.
5. **Extensible to more feeds** — Architecture should make it easy to add RSS, Reddit, X (when we have a cheap path), Bluesky, etc.

---

## 2b. Feasibility: Your Own Social Sourcing Tool

**Short answer: yes, it’s feasible** — and cheaper + more relevant if you own the pipeline and limit the time window.

### Time window: 14 days (2 weeks) instead of 30

| Window | Pros | Cons |
|--------|------|------|
| **14 days** | Less data to fetch, store, and rank; Reddit’s public search works well with `t=week` (or two runs); news stays fresh; Groq sees fewer items per request. | Slightly less “depth” for slow-moving topics. |
| **30 days** | More history. | More API calls, more rows in the store, more tokens in ranking/summary; Reddit public can be 429-prone if you over-fetch. |

**Recommendation:** Make the window **configurable** (e.g. 7, 14, or 30 days in env or DB). Default to **14 days** so the “cheapest viable” path stays cheap and the briefing stays highly relevant.

### Cost vs relevance: what to use

| Source | Cost | Relevance for Distill users | Feasibility |
|--------|------|-----------------------------|-------------|
| **RSS (current)** | Free | High — official blogs, tech press, curated. | Already in place. |
| **HN (Algolia)** | Free | High — dev/builders, launches, debates. | Trivial; add to collector. |
| **Reddit (public JSON)** | Free | High — recommendations, “best X”, complaints, trends. | Free; throttle + cache to avoid 429. |
| **Polymarket (Gamma)** | Free | Niche but high-signal when topic matches (e.g. “will X ship?”). | Trivial. |
| **YouTube (yt-dlp)** | Free | Medium–high for tutorials, keynotes; heavier to run. | Feasible in a worker; optional. |
| **Bluesky (public API)** | Free | Medium — growing for tech; check rate limits. | Feasible; add if limits are generous. |
| **X (Twitter)** | No free search at scale | High for real-time takes, threads. | Not feasible free; add only if you pay for an aggregator later. |
| **TikTok / Instagram** | Paid aggregator only | Medium for trends; different audience. | Optional Tier 2. |

**Cheapest viable stack:** RSS + HN + Reddit (public) + Polymarket. **Zero** ongoing API cost; only infra (Vercel, Supabase/KV) and Groq (already in use). That already gives “most relevant for the money” for an AI briefing.

**Best relevance for the money:** Same stack + optional YouTube (yt-dlp) or Bluesky if free. Add one paid social aggregator (X/Reddit/TikTok/Instagram) only if you need “what’s blowing up on X” and have budget.

### Building it yourself vs relying on a skill

| Approach | Cost | Control | Fits Distill |
|----------|------|--------|--------------|
| **Own pipeline (this plan)** | Minimal: free sources + Groq + existing infra. | Full: you choose window, sources, ranking, storage. | Native: same schema as briefing, one codebase. |
| **Existing last30 skill as-is** | ScrapeCreators/xAI/OpenAI + rate limits. | Limited; skill is generic. | Needs a “bridge” to feed into Distill. |

So **building your own social sourcing tool is feasible**, and a **14-day default** keeps it as cheap as possible while still giving the most relevant signal for Distill users. You can extend to 30 days or add paid sources later without changing the architecture.

---

## 3. Proposed Architecture

### 3.1 High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  COLLECTION LAYER (scheduled or on-demand, not per-user)                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ RSS (existing│ │ HN (Algolia)│ │ Polymarket  │ │ YouTube     │        │
│  │ Distill list)│ │             │ │ (Gamma API) │ │ (yt-dlp)     │  ...   │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘        │
│         │               │               │               │                 │
│         └───────────────┴───────────────┴───────────────┘                 │
│                                     │                                      │
│                                     ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Raw items store (Supabase or Vercel KV / Upstash)                   │  │
│  │  Schema: id, source, title, url, summary, published_at, topic,       │  │
│  │          raw_engagement (optional), collected_at                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  DISTILL CONSUMER (existing app)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  /api/briefing (or /api/briefing-v2)                                 │ │
│  │  - Reads from: RSS (current) + Last30 table (new)                   │ │
│  │  - Merge, dedupe, sort by date                                       │ │
│  │  - recommend() + Groq “why it matters” (unchanged)                   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Collection** runs on a schedule (e.g. Vercel Cron or a small worker). It never runs in the critical path of a user request.
- **Storage** holds “last N days” items (default 14) in one place. Distill’s briefing API reads from this store plus existing RSS.
- **No ScrapeCreators / xAI / OpenAI** in the default path. Optional: add one paid source later (e.g. a single aggregator) with strict caps.

### 3.2 Source Tiers

| Tier | Sources | Cost / Limits | Implementation note |
|------|--------|----------------|---------------------|
| **Tier 0 (use first)** | RSS (current list), HN (Algolia), Polymarket (Gamma), Reddit public JSON (read-only, no auth) | Free or very high quota | Reddit: use `reddit.com/search.json?q=...&restrict_sr=0&sort=relevance` (or similar) with a reasonable cache (e.g. 15–30 min). |
| **Tier 1 (add soon)** | YouTube via yt-dlp (or official Data API with quota), Bluesky public feeds (if free API exists) | yt-dlp: free; Data API: quota | Run yt-dlp in a serverless function with a timeout; store title, link, channel, published_at. |
| **Tier 2 (optional later)** | One paid aggregator (e.g. ScrapeCreators or similar) for X/Reddit/TikTok/Instagram | Single key, capped calls/day | Call from the same collector job; cap daily requests so we’re not rate limited. |

We **do not** need Bird, xAI, or OpenAI for the rebuild. That removes the main rate and cost issues.

### 3.3 Where Collection Runs

- **Option A — Vercel Cron (recommended for simplicity)**  
  - Next.js API route, e.g. `GET /api/cron/collect-last30`, protected by `CRON_SECRET`.  
  - Vercel Cron hits it every N minutes (e.g. 30 or 60).  
  - Each run: fetch Tier 0 (and optionally Tier 1), normalize to a common schema, upsert into Supabase (or KV).  
  - Pros: no extra infra, same repo as Distill. Cons: 60s max duration; keep each run light (e.g. only HN + Polymarket + one or two RSS-style sources per run, rotate).

- **Option B — Dedicated worker (e.g. GitHub Actions, Inngest, or a small always-on service)**  
  - Better if we add YouTube (yt-dlp) or heavier jobs; no 60s limit.  
  - Same contract: write into the same Raw items store.

### 3.4 Schema for “Last 30” Items (Distill-Compatible)

Align with existing `BriefingItem` where possible so the rest of the pipeline stays unchanged:

- `id` — unique (e.g. `hn-123`, `polymarket-abc`, `reddit-t3_xyz`)
- `title`, `topic`, `source` (e.g. `hn`, `polymarket`, `reddit`, `youtube`)
- `link` (url)
- `summary` — short text for ranking and for Groq “why it matters”
- `published` — ISO date
- `collected_at` — when we stored it
- Optional: `engagement` (e.g. points for HN, price for Polymarket) for ranking

The existing `recommend()` and `buildWhyItMattersBatch()` can stay; they already accept article-like objects with `title`, `summary`, etc.

### 3.5 Groq-Only LLM Usage (Cheap Model)

- **No Claude (or other expensive model) in the loop** for this pipeline.
- **Groq** is used only where Distill already uses it:
  - In `/api/briefing`: “why it matters” and any future “summarize this thread” step.
- Optional: a **lightweight Groq step in the collector** to normalize or summarize long Reddit/HN text before storing (e.g. “in one sentence, what is this about?”). Keep prompts short and token count low so cost stays minimal.

---

## 4. Implementation Phases

| Phase | What | Outcome |
|-------|------|--------|
| **1** | Add Supabase table (or KV) for last30 raw items; define schema and one write path (e.g. `POST /api/internal/ingest-last30` or direct from cron). | Storage ready. |
| **2** | Implement Tier 0 collectors: HN (Algolia), Polymarket (Gamma), Reddit public JSON. One Vercel Cron job that calls these and upserts. | Briefing can merge RSS + last30. |
| **3** | Change `/api/briefing` to merge RSS + last30 table, dedupe by URL, then run existing `recommend()` + Groq. | Distill shows “last 30 days” + RSS in one briefing. |
| **4** | (Optional) Add YouTube (yt-dlp in a worker or cron with longer timeout). | More variety. |
| **5** | (Optional) Add Tier 2: one paid aggregator, call limit per day, same store. | X/Reddit/TikTok/Instagram without per-request rate limits. |

---

## 5. Optional: Standalone “Research” Mode for Distill

If you still want a “research any topic” experience (like the original skill) inside Distill:

- **Option A:** Expose an endpoint, e.g. `GET /api/research?topic=...`, that (1) reads from the same last30 store (filtered by topic/keywords) and (2) optionally runs a **single** Groq call to synthesize “what I learned” from the stored items. No live API calls at request time; only Groq. Rate limits then apply only to Groq (and your store), not to ScrapeCreators/xAI.
- **Option B:** Let the collector periodically run topic-specific searches (e.g. a list of “topics” from config or from trending tags) and store results. The “research” endpoint only queries the store + Groq.

---

## 6. Summary

| Current (last30days skill) | Rebuild (Distill-native) |
|---------------------------|---------------------------|
| ScrapeCreators, xAI, OpenAI, Bird | Drop or make optional; use free sources first |
| Run on every “last30” request | Scheduled collection; user reads from store |
| Claude for synthesis | Groq for all LLM steps (same as Distill briefing) |
| One-off report | Continuous feed into Distill briefing |
| Many APIs, mixed rate limits | One write path, capped optional paid source |

**Result:** A “last 14 days” (or configurable) pipeline that avoids the main API rate limits and cost, uses a cheaper model (Groq), fits inside Distill’s existing briefing flow, and can be extended to 30 days or more social feeds (including optional paid aggregator) later.
