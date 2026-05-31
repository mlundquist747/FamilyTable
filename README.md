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

### Demo mode vs. cloud mode

The app picks a backend per request based on whether Supabase is configured:

- **Demo mode** (no `NEXT_PUBLIC_SUPABASE_*` env): a sample household is seeded
  into `localStorage`, "Generate" returns a re-dated sample plan, and share
  links are self-contained. The entire UX is explorable with zero setup.
- **Cloud mode** (Supabase configured): the app requires sign-in (Google OAuth
  or an email magic link), auto-provisions a household on first login, and
  persists members, busy nights, plans, and grocery lists to Postgres under RLS.
  The store interface is identical, so the UI is unchanged — mutations route
  through server actions ([`src/lib/actions.ts`](src/lib/actions.ts)) into the
  RLS-scoped repository ([`src/lib/data.ts`](src/lib/data.ts)).

`ANTHROPIC_API_KEY` is independent of mode: set it to generate live Claude
plans; without it, "Generate" falls back to the sample plan.

### Supabase Auth setup (cloud mode)

1. Apply the schema (below).
2. In the Supabase dashboard → **Authentication → URL Configuration**, set the
   Site URL and add redirect URLs for your deploy and `http://localhost:3000`
   (the app redirects to `/auth/callback`).
3. **Email magic link** works out of the box. For **Google**, enable the Google
   provider under Authentication → Providers and add its OAuth credentials, then
   add `https://<project-ref>.supabase.co/auth/v1/callback` to the Google
   console's authorized redirect URIs.

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
    login/                   Google OAuth + email magic-link sign-in
    auth/callback/           OAuth code / magic-link verification
    (app)/                   authed shell; picks demo vs cloud mode per request
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
    store.tsx                client store (demo + cloud backends)
    data.ts                  server-side RLS-scoped repository (cloud)
    actions.ts               server actions: the cloud mutation surface
    supabase/                browser / server / admin clients
supabase/schema.sql          tables + RLS
```

## Testing

The deterministic core is covered by unit tests — the allergen engine,
grocery merging/scaling, and calendar detection. Run `npm run test`.
