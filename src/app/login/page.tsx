"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function signIn() {
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Request read-only calendar access for busy-night detection.
          scopes: "https://www.googleapis.com/auth/calendar.readonly",
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) setError(error.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-5">
      <div className="card w-full max-w-sm p-7 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sage-600 text-white text-xl">
          🍽️
        </div>
        <h1 className="mt-4 text-xl font-bold">Welcome to FamilyTable</h1>
        <p className="mt-1.5 text-sm text-ink/60">
          Sign in to plan dinners for your whole household.
        </p>

        {configured ? (
          <button className="btn-primary w-full mt-6" onClick={signIn}>
            Continue with Google
          </button>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="rounded-xl bg-sage-50 p-3 text-xs text-ink/60">
              Google sign-in isn&apos;t configured in this environment. Explore
              the full app in demo mode.
            </p>
            <Link href="/dashboard" className="btn-primary w-full">
              Enter demo
            </Link>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-clay-600">{error}</p>}

        <Link
          href="/"
          className="mt-5 inline-block text-xs text-ink/50 hover:text-ink/70"
        >
          ← Back home
        </Link>
      </div>
    </main>
  );
}
