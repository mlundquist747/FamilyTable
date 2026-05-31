import Link from "next/link";

const features = [
  {
    title: "Every diet, one plan",
    body: "Vegan, gluten-free, allergies — rules combine across your whole household so every dinner is safe for everyone.",
    icon: "🥗",
  },
  {
    title: "Allergen safety engine",
    body: "A deterministic rule engine independently re-checks every ingredient against the Big-9 allergens. The AI never gets the final word on safety.",
    icon: "🛡️",
  },
  {
    title: "Knows your week",
    body: "Connect Google Calendar and busy weeknights automatically get simple meals or planned leftovers.",
    icon: "📅",
  },
  {
    title: "Smart grocery lists",
    body: "De-duplicated, quantity-merged and sorted by supermarket aisle. Share a read-only link with anyone.",
    icon: "🛒",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-sage-600 text-white">
            🍽️
          </span>
          FamilyTable
        </div>
        <Link href="/dashboard" className="btn-secondary">
          Open app
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 pt-10 pb-16 text-center">
        <span className="chip bg-clay-100 text-clay-600 mb-5">
          AI meal planning for real families
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          A week of dinners your{" "}
          <span className="text-sage-600">whole family</span> can eat.
        </h1>
        <p className="mt-5 text-lg text-ink/70">
          FamilyTable plans dinners around every member&apos;s diet, allergies
          and schedule — then builds a smart, shareable grocery list. Safety is
          checked by a deterministic engine, not just the AI.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <Link href="/dashboard" className="btn-primary text-base px-6 py-3">
            Plan this week&apos;s dinners
          </Link>
          <Link href="/login" className="btn-secondary text-base px-6 py-3">
            Sign in with Google
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink/50">
          Try the live demo instantly — no account needed.
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold text-lg">{f.title}</h3>
              <p className="mt-1.5 text-ink/70 text-sm leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-sage-100 py-8 text-center text-sm text-ink/50">
        FamilyTable · AI-powered family meal planning
      </footer>
    </main>
  );
}
