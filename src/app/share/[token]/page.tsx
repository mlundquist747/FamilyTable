import Link from "next/link";
import { groupBySection } from "@/lib/grocery";
import { decodeListPayload, isDemoPayload } from "@/lib/share";
import { GroceryItem } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface ResolvedList {
  householdName: string;
  items: GroceryItem[];
}

async function resolveList(token: string): Promise<ResolvedList | null> {
  // Demo payload: self-contained, decode directly.
  if (isDemoPayload(token)) {
    const decoded = decodeListPayload(token);
    if (!decoded) return null;
    return {
      householdName: decoded.householdName,
      items: decoded.items.map((i) => ({ ...i, usedIn: [] })),
    };
  }

  // DB-backed token: resolve server-side via the service role for exactly the
  // one row matching this unguessable token (PRD §6 — no broad anon reads).
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("grocery_lists")
      .select("items, households(name)")
      .eq("share_token", token)
      .single();
    if (!data) return null;
    const household = data.households as unknown as { name?: string } | null;
    return {
      householdName: household?.name ?? "Shared list",
      items: (data.items as GroceryItem[]) ?? [],
    };
  } catch {
    return null;
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const list = await resolveList(token);

  if (!list) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-2xl font-bold">List not found</h1>
        <p className="mt-2 text-ink/60">
          This share link is invalid or has expired.
        </p>
        <Link href="/" className="btn-primary mt-6">
          Go to FamilyTable
        </Link>
      </main>
    );
  }

  const groups = groupBySection(list.items);

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <header className="mb-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-sm">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-sage-600 text-white text-xs">
            🍽️
          </span>
          FamilyTable
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Grocery list</h1>
        <p className="text-sm text-ink/60">
          {list.householdName} · {list.items.length} items · read-only
        </p>
      </header>

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.section}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-sage-600 mb-2">
              {group.section}
            </h2>
            <div className="card divide-y divide-sage-100">
              {group.items.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="h-5 w-5 shrink-0 rounded-md border border-sage-300" />
                  <span className="flex-1 text-sm">{item.name}</span>
                  {item.quantity != null && (
                    <span className="text-xs text-ink/40">
                      {item.quantity} {item.unit ?? ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-10 text-center text-xs text-ink/40">
        Shared via FamilyTable
      </footer>
    </main>
  );
}
