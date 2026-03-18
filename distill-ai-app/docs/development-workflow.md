# Development Workflow

## Environments

| Environment | Command | URL |
|-------------|---------|-----|
| Local | `make local` | http://localhost:3000 |
| Preview | `make dev` | https://distill-ai-xxxx.vercel.app (unique link per deploy) |
| Production | push to `main` | https://distill-ai.vercel.app (auto-deployed by Vercel) |

---

## Local Development

Runs a build first to catch errors, then starts the local dev server.

```bash
make local
```

Open **http://localhost:3000** to test.

---

## Preview Deployment

Runs a build first to catch errors, then deploys to a unique Vercel preview URL.

```bash
make dev
```

Vercel prints the preview link — use it to test on real Vercel infrastructure before shipping.

---

## Production Deployment

Push to `main` — Vercel auto-deploys. No manual deploy command needed.

```bash
git add <files>
git commit -m "your message"
git push origin main
```

Vercel picks up the push and deploys automatically. This keeps GitHub and production always in sync.

---

## Rules

1. **Always run `make local` first.** Build must pass and the app must work at localhost:3000 before going further.
2. **Use `make dev` for a preview link.** Verify on real Vercel infrastructure before pushing to production.
3. **Never use `npx vercel --prod` manually.** Always push to `main` so GitHub and production stay in sync.
4. **Never commit `.env.local`.** Production env vars live in Vercel dashboard → Settings → Environment Variables.
