# FamilyTable — Product Requirements Document

**Version:** 1.1 (revised with implementation decisions)
**Last updated:** 2026-05-30
**Source:** Revised from FamilyTable PRD v1.0

---

## 1. Overview

FamilyTable is an AI-powered, mobile-first web application that leverages Claude
to streamline meal planning and grocery management for families. It accounts for
each member's dietary needs and the household's schedule, then produces a weekly
meal plan and a smart, shareable grocery list.

## 2. Core Problem

Families struggle with meal planning that accounts for diverse dietary needs,
scheduling conflicts, and fragmented grocery list management across multiple
tools and platforms.

## 3. Target Users

Multi-member households (families) where one or more members have distinct
dietary patterns, allergies, or preferences, and where weeknight schedules vary.

---

## 4. Decisions & Technical Direction

These decisions were confirmed during planning and supersede open questions in
v1.0.

| Area | Decision |
|------|----------|
| **Frontend framework** | Next.js (App Router) + TypeScript + Tailwind CSS |
| **Hosting / deploy** | GitHub (source) → Vercel (build & deploy) |
| **Database** | Supabase (Postgres) with Row Level Security |
| **Authentication** | Google OAuth via Supabase Auth |
| **Tenancy** | Multi-tenant — each family has its own account & isolated data |
| **AI model** | Claude Sonnet (`claude-sonnet-4-6`) |
| **Allergen validation** | Custom deterministic rule engine (not AI-only) |
| **Calendar integration** | Google Calendar (`calendar.readonly`) — **P0** |
| **Grocery export (MVP)** | Shareable public links only |
| **Grocery sections** | Standard US supermarket sections |
| **Design language** | Skylight-inspired: clean, modern, simple |
| **Form factor** | Mobile-first responsive |

---

## 5. Features

### 5.1 Family Profiles (P0)
- Multi-tenant: each household owns its members and data.
- Each member defines: name, dietary patterns, allergens, disliked foods,
  preferences, and portion size (small / medium / large).
- **Dietary rules combine additively across the household.** If any member is
  vegan, shared meals contain no animal products; if any member is gluten-free,
  no gluten; allergens for any member are excluded for the whole plan.

### 5.2 Calendar Integration (P0)
- OAuth-connected Google Calendar (read-only scope).
- Identifies evening conflicts (events overlapping ~5–9pm) and flags those
  nights for simpler meals or leftovers to optimize cooking time.
- Users may also flag busy nights manually; manual entries take precedence.

### 5.3 AI Meal Generation (P0)
- Claude Sonnet produces 5–7 day dinner plans respecting all household
  constraints.
- Prioritizes ingredient reuse to minimize waste and cost.
- Marks meals as "simple" for flagged busy nights.
- Target: meal-plan generation in under 30 seconds.

### 5.4 Allergen Safety Rule Engine (P0 — Critical Safeguard)
- **Allergen accuracy requires rule-based validation before displaying meals;
  the AI alone is not sufficient.**
- A deterministic engine independently re-scans every ingredient against the
  "Big 9" US allergens (plus gluten) and the household roster, regardless of
  what the AI claimed.
- Conservative by design: false positives are acceptable, false negatives are
  not. Surfaces explicit per-meal, per-member allergen warnings.

### 5.5 Smart Grocery Lists (P0)
- AI-generated, de-duplicated lists.
- Grouped and ordered by **standard US supermarket sections**: Produce,
  Meat & Seafood, Dairy & Eggs, Bakery, Frozen, Pantry, Canned & Jarred,
  Condiments & Spices, Beverages, Other.
- Quantities calculated and merged across meals, scaled by household servings
  (weighted by portion size).

### 5.6 Grocery List Export / Sharing (P0 — scoped for MVP)
- **MVP:** in-app list + shareable public link (read-only, token-based).
- **Deferred (post-MVP):** Skylight, Google Drive, Apple Notes destinations.

---

## 6. Data Privacy & Security
- All health/dietary data encrypted and never shared with third parties.
- Row Level Security ensures households can only access their own data.
- Public grocery-list sharing is token-based and resolved server-side; no broad
  anonymous read access to user tables.

## 7. Success Metrics
- Sub-30-second meal plan generation.
- 4.2+ CSAT rating.
- 60%+ seven-day retention.

---

## 8. Scope Summary

**In scope (MVP / P0)**
- Google OAuth login (multi-tenant)
- Family member profiles with additive dietary logic
- Google Calendar busy-night detection
- Claude Sonnet weekly meal generation
- Deterministic allergen rule engine
- Smart grocery list (US sections, de-duplicated)
- Shareable grocery list links
- Mobile-first, Skylight-inspired UI
- GitHub → Vercel deployment

**Out of scope (post-MVP)**
- Skylight / Google Drive / Apple Notes export integrations
- Breakfast/lunch planning (dinners only for v1)
- Recipe step-by-step cooking mode
- Multiple editors per household / shared accounts
- Native mobile apps
