"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { analyzeMeal } from "@/lib/allergens";
import {
  ALLERGEN_LABELS,
  FamilyMember,
  Meal,
  MealSafetyReport,
} from "@/lib/types";
import { LeftoverBadge, SafetyBadge, SimpleBadge } from "@/components/Badges";

export default function PlanPage() {
  const {
    members,
    meals,
    busyNights,
    preferLeftovers,
    setMeals,
    setMealRecipe,
    toggleBusyNight,
  } = useStore();
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
        body: JSON.stringify({
          members,
          busyNights,
          weekStart,
          days: 7,
          preferLeftovers,
        }),
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

      {preferLeftovers && (
        <div className="card p-3 text-xs text-ink/60 flex items-center gap-2">
          ♻️ Leftovers preference is on — plans cook ~4 nights and repeat the
          rest. Change it on the{" "}
          <Link href="/dashboard" className="text-sage-600 font-medium">
            Home
          </Link>{" "}
          tab.
        </div>
      )}

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
            members={members}
            report={analyzeMeal(meal, members)}
            busy={busySet.has(meal.date)}
            onToggleBusy={() => toggleBusyNight(meal.date, "Manual flag")}
            onRecipe={setMealRecipe}
          />
        ))}
      </div>
    </div>
  );
}

function MealCard({
  meal,
  members,
  report,
  busy,
  onToggleBusy,
  onRecipe,
}: {
  meal: Meal;
  members: FamilyMember[];
  report: MealSafetyReport;
  busy: boolean;
  onToggleBusy: () => void;
  onRecipe: (mealId: string, recipe: string[]) => void;
}) {
  const day = new Date(meal.date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const hasRecipe = !!meal.recipe && meal.recipe.length > 0;

  async function ensureRecipe() {
    if (hasRecipe || loadingRecipe) return;
    setLoadingRecipe(true);
    setRecipeError(null);
    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal: {
            title: meal.title,
            description: meal.description,
            ingredients: meal.ingredients.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
            })),
          },
          members,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not load the recipe.");
      }
      const data = await res.json();
      onRecipe(meal.id, data.recipe as string[]);
    } catch (e) {
      setRecipeError(e instanceof Error ? e.message : "Could not load the recipe.");
    } finally {
      setLoadingRecipe(false);
    }
  }

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
          {meal.leftover ? (
            <LeftoverBadge />
          ) : (
            <>
              <SafetyBadge safe={report.safe} />
              {meal.simple && <SimpleBadge />}
            </>
          )}
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

        {meal.leftover ? (
          <p className="mt-3 text-sm text-sage-700">
            ♻️ Reheat and enjoy{" "}
            {meal.leftoverOf ? (
              <span className="font-medium">{meal.leftoverOf}</span>
            ) : (
              "an earlier dinner"
            )}
            . No cooking — and nothing extra to buy.
          </p>
        ) : (
          <details
            className="mt-3 group"
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) ensureRecipe();
            }}
          >
            <summary className="cursor-pointer text-sm font-medium text-sage-600 list-none">
              <span className="group-open:hidden">Show more ▾</span>
              <span className="hidden group-open:inline">Show less ▴</span>
            </summary>

          <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/45">
            Ingredients
          </h4>
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

          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/45">
            Recipe
          </h4>
          {hasRecipe ? (
            <ol className="mt-2 space-y-2 text-sm text-ink/70">
              {meal.recipe!.map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sage-100 text-xs font-semibold text-sage-700">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          ) : loadingRecipe ? (
            <p className="mt-2 text-sm text-ink/50 animate-pulse">
              ✨ Writing the recipe…
            </p>
          ) : recipeError ? (
            <div className="mt-2 text-sm">
              <p className="text-clay-600">{recipeError}</p>
              <button
                onClick={ensureRecipe}
                className="btn-ghost mt-1 text-sm px-0"
              >
                Try again
              </button>
            </div>
          ) : (
            <button onClick={ensureRecipe} className="btn-secondary mt-2 text-sm">
              ✨ Generate recipe
            </button>
          )}

            {meal.notes && (
              <p className="mt-3 text-xs text-ink/50 italic">{meal.notes}</p>
            )}
          </details>
        )}
      </div>
    </div>
  );
}
