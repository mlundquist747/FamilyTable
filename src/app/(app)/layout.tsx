import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreProvider } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getHouseholdData, getOrCreateHousehold } from "@/lib/data";
import { HouseholdSnapshot } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Decide the backend mode for this request.
  let mode: "demo" | "cloud" = "demo";
  let initial: HouseholdSnapshot | undefined;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Real accounts are on — require sign-in.
      redirect("/login");
    }
    const household = await getOrCreateHousehold(user);
    initial = await getHouseholdData(household.id);
    mode = "cloud";
  }

  return (
    <StoreProvider mode={mode} initial={initial}>
      <div className="min-h-screen pb-24">
        <header className="sticky top-0 z-10 border-b border-sage-100 bg-cream/90 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sage-600 text-white text-sm">
                🍽️
              </span>
              FamilyTable
            </Link>
            {mode === "cloud" ? (
              <SignOutButton />
            ) : (
              <span className="chip bg-sage-50 text-sage-700">Demo</span>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 py-6">{children}</main>
        <BottomNav />
      </div>
    </StoreProvider>
  );
}
