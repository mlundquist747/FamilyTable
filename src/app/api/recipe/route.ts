import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateRecipe } from "@/lib/meal-plan";
import { aggregateConstraints } from "@/lib/allergens";
import {
  ALLERGEN_LABELS,
  DIETARY_PATTERN_LABELS,
  FamilyMember,
  Meal,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  meal: z.object({
    title: z.string(),
    description: z.string().default(""),
    ingredients: z
      .array(
        z.object({
          name: z.string(),
          quantity: z.number().optional(),
          unit: z.string().optional(),
        }),
      )
      .min(1),
  }),
  members: z.array(z.any()).default([]),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Recipe generation isn't configured." },
      { status: 503 },
    );
  }

  const members = parsed.members as FamilyMember[];
  const c = aggregateConstraints(members);
  const constraints = [
    ...c.dietaryPatterns.map((d) => DIETARY_PATTERN_LABELS[d]),
    ...c.allergens.map((a) => `no ${ALLERGEN_LABELS[a]}`),
  ];

  try {
    const recipe = await generateRecipe({
      title: parsed.meal.title,
      description: parsed.meal.description,
      ingredients: parsed.meal.ingredients as Meal["ingredients"],
      constraints,
    });
    return NextResponse.json({ recipe });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recipe failed" },
      { status: 502 },
    );
  }
}
