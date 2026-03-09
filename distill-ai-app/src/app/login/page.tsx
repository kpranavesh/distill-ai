"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "auth_callback_error") {
      setError("Sign-in failed. Please try again.");
    }
  }, [searchParams]);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signInError) throw signInError;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in with Google.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900/80 p-8 ring-1 ring-slate-700/80">
        <h1 className="text-xl font-semibold text-slate-50 text-center mb-2">
          Sign in to Distill AI
        </h1>
        <p className="text-sm text-slate-400 text-center mb-6">
          Use your Google account to continue. Your profile will be saved across devices.
        </p>
        {error && (
          <p className="mb-4 text-sm text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-900 px-4 py-3 text-sm font-medium hover:bg-slate-200 disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>
        <p className="mt-6 text-xs text-slate-500 text-center">
          By signing in you agree to use of your account for Distill AI. We only access your email and name.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
