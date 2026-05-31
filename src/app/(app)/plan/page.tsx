"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { analyzeMeal } from "@/lib/allergens";
import { ALLERGEN_LABELS, Meal, MealSafetyReport } from "@/lib/types";
import { SafetyBadge, SimpleBadge } from "@/components/Badges";

export default function PlanPage() {
  const { members, meals, busyNights, setMeals, toggleBusyNight } = useStore();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState(false);

  const sorted = useMemo(
    () => [...meals].sort((a, b) => a.date.localeCompare(b.date)),
    [meals],
  );
  const busySet = useMemo(
    () => new Set(busyNights.map((b) => b.date)),
    [busyNights],
  );

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const weekStart = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members, busyNights, weekStart, days: 5 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Generation failed");
      }
      const data = await res.json();
      setMeals(data.meals as Meal[]);
      setDemoNote(!!data.demo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meal plan</h1>
        <button
          className="btn-primary"
          onClick={generate}
          disabled={generating || members.length === 0}
        >
          {generating ? "Planning…" : "✨ Generate"}
        </button>
      </div>

      {members.length === 0 && (
        <div className="card p-5 text-sm text-ink/60">
          Add at least one family member first.{" "}
          <Link href="/members" className="text-sage-600 font-medium">
            Go to Family →
          </Link>
        </div>
      )}

      {error && (
        <div className="card border-clay-300 bg-clay-100/40 p-4 text-sm text-clay-600">
          {error}
        </div>
      )}

      {demoNote && (
        <div className="card p-4 text-xs text-ink/60">
          Showing a sample plan (no <code>ANTHROPIC_API_KEY</code> configured).
          Add a key to generate live plans with Claude Sonnet.
        </div>
      )}

      <div className="space-y-4">
        {sorted.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            report={analyzeMeal(meal, members)}
            busy={busySet.has(meal.date)}
            onToggleBusy={() => toggleBusyNight(meal.date, "Manual flag")}
          />
        ))}
      </div>
    </div>
  );
}

function MealCard({
  meal,
  report,
  busy,
  onToggleBusy,
}: {
  meal: Meal;
  report: MealSafetyReport;
  busy: boolean;
  onToggleBusy: () => void;
}) {
  const day = new Date(meal.date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between text-xs text-ink/50">
          <span>{day}</span>
          <button
            onClick={onToggleBusy}
            className={`chip ${
              busy
                ? "bg-amber-100 text-amber-700"
                : "bg-sage-50 text-sage-600 hover:bg-sage-100"
            }`}
          >
            {busy ? "Busy night ✓" : "Flag busy"}
          </button>
        </div>

        <h3 className="mt-1.5 font-semibold text-lg leading-snug">
          {meal.title}
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SafetyBadge safe={report.safe} />
          {meal.simple && <SimpleBadge />}
        </div>
        <p className="mt-2.5 text-sm text-ink/70 leading-relaxed">
          {meal.description}
        </p>

        {/* Safety warnings */}
        {!report.safe && (
          <div className="mt-3 rounded-xl border border-clay-300 bg-clay-100/50 p-3 text-sm">
            <p className="font-semibold text-clay-600 flex items-center gap-1.5">
              ⚠ Safety engine warnings
            </p>
            <ul className="mt-1.5 space-y-1 text-clay-600/90">
              {report.warnings.map((w, i) => (
                <li key={i}>
                  <strong>{w.memberName}</strong> — {ALLERGEN_LABELS[w.allergen]}{" "}
                  in {w.triggeredBy.join(", ")}
                </li>
              ))}
              {report.dietaryViolations.map((v, i) => (
                <li key={`d-${i}`}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm font-medium text-sage-600 list-none">
            <span className="group-open:hidden">Show ingredients ▾</span>
            <span className="hidden group-open:inline">Hide ingredients ▴</span>
          </summary>
          <ul className="mt-2 space-y-1 text-sm text-ink/70">
            {meal.ingredients.map((ing, i) => (
              <li key={i} className="flex justify-between">
                <span>{ing.name}</span>
                <span className="text-ink/40">
                  {ing.quantity ?? ""} {ing.unit ?? ""}
                </span>
              </li>
            ))}
          </ul>
          {meal.notes && (
            <p className="mt-2 text-xs text-ink/50 italic">{meal.notes}</p>
          )}
        </details>
      </div>
    </div>
  );
}
