# CLAUDE.md — Distill AI

AI-powered news briefing app. Fetches RSS feeds, scores articles against user profile, returns personalised briefing with Claude-generated "why it matters" per article.

---

## Development workflow — ALWAYS follow this

See full details: `docs/development-workflow.md`

| Step | Command | Where |
|------|---------|-------|
| 1. Develop & test | `make local` | localhost:3000 |
| 2. Preview on Vercel | `make dev` | unique preview URL |
| 3. Ship to production | `git push origin main` | distill-ai.vercel.app (auto-deploy) |

**Rules: Always run `make local` first — build must pass before testing. Never use `npx vercel --prod` manually — push to main so GitHub and prod stay in sync.**

---

## Project layout

```
signal-app/
├── src/app/
│   ├── page.tsx                  ← full UI (onboarding + briefing + chat + tools)
│   └── api/
│       ├── briefing/route.ts     ← main API: fetch RSS, rank, call Haiku, return items
│       └── audio/route.ts        ← ElevenLabs TTS
├── recommender/
│   ├── index.ts                  ← recommend() + explain() exports
│   ├── score.ts                  ← scoreArticle() — 0-100 per article
│   ├── keywords.ts               ← keyword maps (LEGAL_KEYWORDS, INDUSTRY_KEYWORDS, etc.)
│   └── types.ts                  ← UserProfile, Article, ScoredArticle
├── next.config.ts                ← CDN cache headers for /api/*
└── .env.local                    ← ANTHROPIC_API_KEY, ELEVENLABS_API_KEY
```

---

## Environment variables

| Key | Used for |
|-----|----------|
| `GROQ_API_KEY` | Llama 3.1 8B (free) — per-article "why it matters" generation |
| `ELEVENLABS_API_KEY` | Audio overview TTS |

Note: Anthropic API was removed — Claude.ai subscription ≠ API credits (separate billing). Groq free tier is used instead. Get key at console.groq.com.

Both must be set in Vercel (production) and `.env.local` (dev).

---

## Caching — the hardest problem in this codebase

Caching bites in three independent layers. All three must be defeated simultaneously:

### 1. Next.js data cache (fetch-level)
Next.js 13+ patches the global `fetch` and caches responses by default, even inside route handlers.

**Fix:** Call `unstable_noStore()` from `next/cache` at the top of both `loadArticles()` and `GET()`.
`export const dynamic = "force-dynamic"` alone is NOT enough — it prevents route-level caching but does not opt out the data cache.

### 2. Vercel edge network (CDN-level)
Vercel's edge can serve a cached response before the serverless function even runs, regardless of what headers the function returns.

**Fix:** Set headers in `next.config.ts` under `headers()` for `/api/:path*`:
```
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
CDN-Cache-Control: no-store        ← Vercel-specific, kills edge cache
Surrogate-Control: no-store
```
The response-level `Cache-Control` alone does NOT stop the edge — you need `CDN-Cache-Control`.

### 3. Browser cache (client-level)
The browser caches GET requests. Even with correct server headers, a browser can return a cached response for an identical URL.

**Fix:** Add `_t: Date.now()` to query params on every client fetch, plus `cache: "no-store"` in the fetch options. This makes every request URL unique so the browser never serves a cache hit.

### Checklist for any future API route that must not be cached
- [ ] `export const dynamic = "force-dynamic"` in the route file
- [ ] `unstable_noStore()` called at the top of the handler
- [ ] `CDN-Cache-Control: no-store` in the response (or in next.config.ts headers)
- [ ] `cache: "no-store"` on the client-side fetch call
- [ ] `_t: Date.now()` query param on the client call

---

## Recommender model

Located in `recommender/`. Keyword-based scoring, 0–100 per article.

**Score components:**
- Base: 20
- Goal match (find-tools / strategic / build): up to +24
- Comfort level (skeptic penalises technical, power boosts it): ±8–15
- Role signals (executive, engineer, product, sales, legal, etc.): up to +15
- Industry keywords match: up to +18
- AI tools dedup (penalise intro content for tools user already uses): -15
- Recency: +10 last 48h, +5 last 7 days

**To add a new role:** add scoring block in `score.ts` + add relevant keywords to `keywords.ts`.

**To add a new industry:** add entry to `INDUSTRY_KEYWORDS` in `keywords.ts`.

---

## RSS feeds

13 feeds as of March 2026. Actively growing — adding sector-specific feeds for diverse coverage. Topics are used both for display and scoring.

| Feed | Topic |
|------|-------|
| OpenAI | Models & assistants |
| Anthropic | Safety & Claude |
| Google AI | Google AI & research |
| TechCrunch AI | Industry news |
| The Verge | Industry news |
| VentureBeat AI | Industry news |
| MIT Technology Review | Policy & society |
| The Markup | AI accountability |
| Wired Design | Design & creative tools |
| CreativeBloq | Design & creative tools |
| Variety | Media & entertainment |
| Deadline | Media & entertainment |
| EdSurge | Education technology |

**To add a feed:** append an entry to the `FEEDS` array in `route.ts`. No other changes needed.

**Known limitation:** Industry-specific scoring (Healthcare, Finance, etc.) fires weakly when feeds don't contain sector keywords. Fix: add sector-specific feeds per vertical.

---

## Article pool caps (route.ts)

| Setting | Value |
|---------|-------|
| Articles fetched per feed | 20 |
| Total candidate pool (after recency sort) | 120 |
| Articles returned to user | 8 (top-scored) |
| Vercel `maxDuration` | 60s |

As feed count grows, the pool stays capped at 120 most-recent articles. Scoring 120 articles is near-instant — the bottleneck is always the slowest RSS feed (parallel fetches).

---

## "Why it matters" generation

Single Groq (Llama 3.1 8B) call per briefing load. Sends all 8 ranked articles + user profile in one prompt. Returns a JSON array of 8 unique sentences, each referencing the actual article content.

Note: Anthropic API was removed — Claude.ai subscription ≠ API credits. Groq free tier is used instead.

`_debug.whySource` in the API response will be `"claude"` or `"fallback"`. If you see `"fallback"`, the Groq call failed — check `GROQ_API_KEY` is set in Vercel. The Groq free tier resets daily; if it hits rate limits it degrades to fallback gracefully.

---

## Deployment

```bash
cd signal-app
npx vercel --prod
```

GitHub: `kpranavesh/signal-app-v2` (main branch auto-linked to Vercel)
Live URL: signal-app-beta.vercel.app

---

## Key learnings

- `force-dynamic` ≠ no caching. It prevents route memoisation but not the data cache or CDN.
- Vercel edge caching requires `CDN-Cache-Control: no-store` — `Cache-Control` alone is not enough.
- `unstable_noStore()` is the correct Next.js way to opt out of data cache per function call.
- `rss-parser` uses Node's `https` module (not `fetch`), so it's not affected by Next.js fetch patching — but call `unstable_noStore()` anyway as belt-and-suspenders.
- Anthropic SDK constructor throws if `ANTHROPIC_API_KEY` is undefined — never instantiate at module level without a null check. Instantiate inside the function body with `{ apiKey: process.env.ANTHROPIC_API_KEY }`.
- Curly quotes (`"` `"`) in TSX string literals break Turbopack. Always use ASCII `"` in code. Use template literals for any string that embeds quotes: `` `He said "hello"` `` not `"He said \"hello\""`.
- Operator precedence: `a ?? b || c` evaluates as `a ?? (b || c)`. Write `(a ?? b) || c` when you want the nullish coalesce to apply first.
