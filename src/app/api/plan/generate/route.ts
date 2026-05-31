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
