"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await createClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={signOut} disabled={busy} className="btn-ghost text-sm">
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
