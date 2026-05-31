import { StoreProvider } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <div className="min-h-screen pb-24">
        <header className="sticky top-0 z-10 border-b border-sage-100 bg-cream/90 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sage-600 text-white text-sm">
                🍽️
              </span>
              FamilyTable
            </Link>
            <span className="chip bg-sage-50 text-sage-700">Demo</span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 py-6">{children}</main>
        <BottomNav />
      </div>
    </StoreProvider>
  );
}
