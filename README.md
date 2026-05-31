# FamilyTable

AI-powered, mobile-first meal planning for families. FamilyTable plans a week of
dinners around every household member's diet, allergies, and schedule, then builds
a smart, de-duplicated, shareable grocery list.

Built per [`PRD.md`](./PRD.md).

## Highlights

- **Additive dietary logic** — any member's restriction (vegan, gluten-free, an
  allergy) applies to every shared meal.
- **Deterministic allergen safety engine** — independently re-scans every
  ingredient against the Big-9 US allergens (+ gluten) and the roster,
  _regardless of what the AI claimed_. Conservative by design. ([`src/lib/allergens.ts`](src/lib/allergens.ts))
- **Calendar-aware** — Google Calendar (`calendar.readonly`) busy-night detection
  flags 5–9pm conflicts for simple meals or leftovers. ([`src/lib/calendar.ts`](src/lib/calendar.ts))
- **Claude Sonnet meal generation** — structured tool output, prompt-cached system
  prompt, validated with zod. ([`src/lib/meal-plan.ts`](src/lib/meal-plan.ts))
- **Smart grocery lists** — quantities merged + scaled by household portion sizes,
  grouped by US supermarket aisle, shareable via read-only link. ([`src/lib/grocery.ts`](src/lib/grocery.ts))

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) + TypeScript + Tailwind CSS |
| Database | Supabase (Postgres) with Row Level Security |
| Auth | Google OAuth via Supabase Auth |
| AI | Claude Sonnet (`claude-sonnet-4-6`) |
| Hosting | Vercel |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys (optional for demo mode)
npm run dev                  # http://localhost:3000
```

### Demo mode

With **no environment variables set**, the app runs fully in demo mode: a sample
household is seeded into `localStorage`, "Generate" returns a re-dated sample
plan, and share links are self-contained. This makes the entire UX explorable
without Supabase, Google, or Anthropic configured.

Add keys to `.env.local` to enable live auth, calendar, AI generation, and
DB-backed sharing.

### Database

Apply [`supabase/schema.sql`](supabase/schema.sql) to your Supabase project (SQL
editor or `supabase db push`). It creates the tables, RLS policies, and the
`owns_household` helper. Public share links are resolved server-side with the
service-role key — there is no anonymous read policy on user tables.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run test       # vitest (allergen engine, grocery, calendar)
```

## Project layout

```
src/
  app/
    page.tsx                 landing
    login/                   Google sign-in (demo fallback)
    auth/callback/           OAuth code exchange
    (app)/                   authed shell (bottom nav)
      dashboard/  members/  plan/  grocery/
    share/[token]/           public read-only grocery list
    api/plan/generate/       Claude meal generation (+ demo fallback)
  lib/
    types.ts                 domain model
    allergens.ts             deterministic safety engine ★
    grocery.ts               list merge + sectioning
    meal-plan.ts             Claude Sonnet integration
    calendar.ts              busy-night detection
    share.ts                 share-link encoding
    store.tsx                client household store
    supabase/                browser / server / admin clients
supabase/schema.sql          tables + RLS
```

## Testing

The deterministic core is covered by unit tests — the allergen engine,
grocery merging/scaling, and calendar detection. Run `npm run test`.
