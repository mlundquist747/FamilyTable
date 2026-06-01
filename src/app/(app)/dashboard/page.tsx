"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { aggregateConstraints, analyzePlan } from "@/lib/allergens";
import { AllergenChip, DietChip } from "@/components/Badges";

export default function DashboardPage() {
  const {
    householdName,
    members,
    meals,
    busyNights,
    preferLeftovers,
    setPreferLeftovers,
  } = useStore();
  const constraints = aggregateConstraints(members);
  const reports = analyzePlan(meals, members);
  const unsafeCount = Object.values(reports).filter((r) => !r.safe).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{householdName}</h1>
        <p className="text-ink/60 text-sm mt-1">
          {members.length} {members.length === 1 ? "member" : "members"} ·{" "}
          {meals.length} dinners planned
        </p>
      </div>

      {/* Household constraints summary */}
      <section className="card p-5">
        <h2 className="font-semibold">This household&apos;s rules</h2>
        <p className="text-xs text-ink/50 mt-0.5">
          Combined additively — applied to every meal.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <div className="label !mb-1 text-xs uppercase tracking-wide text-ink/45">
              Avoid allergens
            </div>
            <div className="flex flex-wrap gap-1.5">
              {constraints.allergens.length ? (
                constraints.allergens.map((a) => (
                  <AllergenChip key={a} allergen={a} />
                ))
              ) : (
                <span className="text-sm text-ink/50">None</span>
              )}
            </div>
          </div>
          <div>
            <div className="label !mb-1 text-xs uppercase tracking-wide text-ink/45">
              Dietary patterns
            </div>
            <div className="flex flex-wrap gap-1.5">
              {constraints.dietaryPatterns.length ? (
                constraints.dietaryPatterns.map((d) => (
                  <DietChip key={d} pattern={d} />
                ))
              ) : (
                <span className="text-sm text-ink/50">None</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Safety status */}
      <section
        className={`card p-5 ${
          unsafeCount > 0 ? "border-clay-300 bg-clay-100/40" : ""
        }`}
      >
        <h2 className="font-semibold flex items-center gap-2">
          🛡️ Allergen safety
        </h2>
        {unsafeCount > 0 ? (
          <p className="text-sm text-clay-600 mt-1">
            {unsafeCount} meal{unsafeCount > 1 ? "s" : ""}{" "}
            {unsafeCount > 1 ? "need" : "needs"} a closer look. The safety engine
            flagged potential allergen or dietary conflicts.
          </p>
        ) : (
          <p className="text-sm text-sage-700 mt-1">
            All {meals.length} meals pass the deterministic safety check. ✓
          </p>
        )}
        <Link href="/plan" className="btn-secondary mt-3">
          Review the plan
        </Link>
      </section>

      {/* Busy nights */}
      <section className="card p-5">
        <h2 className="font-semibold flex items-center gap-2">
          📅 Busy nights
        </h2>
        {busyNights.length ? (
          <ul className="mt-3 space-y-2">
            {busyNights
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((b) => (
                <li
                  key={b.date}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {new Date(b.date + "T12:00:00").toLocaleDateString(
                      undefined,
                      { weekday: "short", month: "short", day: "numeric" },
                    )}
                    {b.reason && (
                      <span className="text-ink/50"> · {b.reason}</span>
                    )}
                  </span>
                  <span className="chip bg-sage-50 text-sage-700 capitalize">
                    {b.source}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50 mt-2">
            No busy nights flagged. Connect a calendar or flag them on the Plan
            tab.
          </p>
        )}
      </section>

      {/* Preferences */}
      <section className="card p-5">
        <h2 className="font-semibold flex items-center gap-2">⚙️ Preferences</h2>
        <button
          type="button"
          onClick={() => setPreferLeftovers(!preferLeftovers)}
          className="mt-3 flex w-full items-center justify-between text-left"
        >
          <div className="pr-4">
            <p className="font-medium flex items-center gap-1.5">
              ♻️ Prefer leftovers
            </p>
            <p className="text-xs text-ink/55 mt-0.5">
              Cook about 4 nights a week and repeat meals as leftovers the other
              nights. Takes effect the next time you generate a plan.
            </p>
          </div>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              preferLeftovers ? "bg-sage-600" : "bg-sage-200"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                preferLeftovers ? "left-[22px]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/members" className="btn-secondary">
          👪 Edit family
        </Link>
        <Link href="/plan" className="btn-primary">
          🍽️ Meal plan
        </Link>
      </div>
    </div>
  );
}
