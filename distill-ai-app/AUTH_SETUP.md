# Auth setup (Google OAuth + Supabase)

Distill AI uses **Supabase Auth** with **Google OAuth** as the primary login. Follow these steps to connect your app.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (or use an existing one).
2. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or use Publishable key as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)

## 2. Enable Google OAuth in Supabase

1. In the Supabase dashboard: **Authentication → Providers → Google** → Enable.
2. You’ll need a **Google OAuth Client ID** and **Client Secret** from Google Cloud Console (step 3). Paste them into Supabase and save.
3. In **Authentication → URL Configuration** set:
   - **Site URL**: your primary app origin. For production, use `https://your-app.vercel.app` so OAuth redirects back to prod; if you use only dev, `http://localhost:3000` is fine.
   - **Redirect URLs**: add every origin you use (Supabase only redirects to URLs in this list):
     - `http://localhost:3000/auth/callback` (dev)
     - `https://your-app.vercel.app/auth/callback` (prod)
     - Any other deployment or preview URLs (e.g. `https://*.vercel.app/auth/callback` if supported).
   If **Site URL** or **Redirect URLs** point only to localhost, signing in on production will redirect to localhost after Google and the browser will show “refused to connect.”

## 3. Google Cloud Console (OAuth credentials)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. **Create credentials → OAuth 2.0 Client ID**.
3. Application type: **Web application**.
4. **Authorized JavaScript origins** (no trailing slash):
   - `http://localhost:3000`
   - `https://your-app.vercel.app`
5. **Authorized redirect URIs** (exact):
   - Supabase’s callback, e.g. `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`  
   You can copy this from Supabase’s Google provider page (“Callback URL for Google”).
6. Create and copy **Client ID** and **Client secret** into Supabase (Authentication → Providers → Google).

**Show your app name (not Supabase URL) on the consent screen:**  
In Google Cloud Console go to **APIs & Services → OAuth consent screen**. Set **Application name** (e.g. “Distill AI”) and optionally an app logo. Users will see this name and logo on the consent screen. The “Continue to …” line may still show Supabase’s domain for security; the app name appears as the main branding.

## 4. Local env

In your app's `.env.local` (e.g. `signal-app/.env.local` or your project folder):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Restart the dev server after changing env.

**Production (Vercel):** Add the same variables in your Vercel project (**Settings → Environment Variables**). Vercel may warn that `NEXT_PUBLIC_` exposes values to the browser — for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` this is intentional and safe (Supabase anon key is designed for client use and is protected by RLS). Do not put the Supabase **service_role** key in a `NEXT_PUBLIC_` variable.

## 5. Optional: user_profiles table (M2)

When you implement profile persistence, run this in the Supabase SQL editor (see PRD):

```sql
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  role        TEXT,
  industry    TEXT,
  comfort     TEXT CHECK (comfort IN ('skeptic','beginner','active','power')),
  goals       TEXT[],
  ai_tools    TEXT[],
  topics_muted    TEXT[] DEFAULT '{}',
  topics_boosted  TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR ALL USING (auth.uid() = id);
```

---

## Manual: where the app is still named externally

These are **external services** where the app name appears. The codebase now uses **Distill AI**; update these by hand so users see the right name:

- **Google Cloud Console → APIs & Services → OAuth consent screen**  
  Set **Application name** to **Distill AI** (and optionally upload an app logo). This is what users see on the “Sign in with Google” consent screen.

- **Supabase**  
  Project URL and redirect URLs do not contain the app name; no change needed there.

- **Vercel / hosting**  
  If you have a project or site name there (e.g. “signal-app”), consider renaming to something like “distill-ai” for consistency; optional.

---

**Questions to unblock:**

- **Q1** Do you already have a Supabase project and Google OAuth client, or should we assume you’ll create them using the steps above?
- **Q2** For “returning user, profile loaded from DB” (PRD): should we create the `user_profiles` row on first login in this milestone, or only add the table in M2 and keep using client-side profile state for now?
- **Q4** (from PRD) If a user deletes their Google account, do you want cascade delete of their profile/sources, or soft-delete with a grace period?
