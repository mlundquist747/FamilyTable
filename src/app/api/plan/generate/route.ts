import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateMealPlan } from "@/lib/meal-plan";
import { analyzePlan } from "@/lib/allergens";
import { demoMeals } from "@/lib/demo-data";
import { BusyNight, FamilyMember, Meal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  members: z.array(z.any()),
  busyNights: z.array(z.any()).default([]),
  weekStart: z.string().optional(),
  days: z.number().min(5).max(7).default(7),
  preferLeftovers: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const members = parsed.members as FamilyMember[];
  const busyNights = parsed.busyNights as BusyNight[];
  const weekStart = parsed.weekStart ?? new Date().toISOString().slice(0, 10);

  let meals: Meal[];
  let demo = false;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      meals = await generateMealPlan({
        members,
        weekStart,
        days: parsed.days,
        busyNights,
        preferLeftovers: parsed.preferLeftovers,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Generation failed" },
        { status: 502 },
      );
    }
  } else {
    // Demo fallback: re-date the sample plan from today so the UX is complete
    // even without an API key configured.
    demo = true;
    meals = reDateDemoPlan(weekStart, parsed.days, busyNights);
    if (parsed.preferLeftovers) meals = applyDemoLeftovers(meals);
  }

  // Critical safeguard: the deterministic engine independently re-checks every
  // meal before it is ever returned to the client (PRD §5.4).
  const safety = analyzePlan(meals, members);

  return NextResponse.json({ meals, safety, demo });
}

function reDateDemoPlan(
  weekStart: string,
  days: number,
  busyNights: BusyNight[],
): Meal[] {
  const busySet = new Set(busyNights.map((b) => b.date));
  const start = new Date(weekStart + "T12:00:00");
  return demoMeals.slice(0, days).map((m, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    return {
      ...m,
      id: `meal-${date}-${i}`,
      date,
      simple: m.simple || busySet.has(date),
    };
  });
}

/**
 * Demo-mode transform: cook on even days, eat leftovers on odd days, so the
 * sample plan reflects the leftover preference even without the AI.
 */
function applyDemoLeftovers(meals: Meal[]): Meal[] {
  return meals.map((m, i) => {
    if (i % 2 === 1 && i > 0) {
      const source = meals[i - 1];
      return {
        ...m,
        title: `Leftovers: ${source.title}`,
        description: `Reheat and enjoy last night's ${source.title}.`,
        ingredients: [],
        recipe: undefined,
        leftover: true,
        cooksFor: 0,
        leftoverOf: source.title,
        simple: true,
      };
    }
    // Cooked night: feeds itself plus the following leftover night (if any).
    const feedsNext = i + 1 < meals.length && (i + 1) % 2 === 1;
    return { ...m, leftover: false, cooksFor: feedsNext ? 2 : 1 };
  });
}
