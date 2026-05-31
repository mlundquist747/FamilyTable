// ─────────────────────────────────────────────────────────────────────────────
// AI meal-plan generation via Claude Sonnet (PRD §5.3).
//
// Produces a 5–7 day dinner plan respecting all household constraints,
// prioritizing ingredient reuse, and marking flagged busy nights as "simple".
// Output is validated with zod; the deterministic allergen engine then
// independently re-checks every meal before anything is shown.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { aggregateConstraints } from "./allergens";
import {
  ALLERGEN_LABELS,
  BusyNight,
  DIETARY_PATTERN_LABELS,
  FamilyMember,
  GROCERY_SECTIONS,
  Meal,
} from "./types";

export const MODEL = "claude-sonnet-4-6";

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  section: z.enum(GROCERY_SECTIONS),
});

const mealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  description: z.string(),
  simple: z.boolean(),
  baseServings: z.number().positive(),
  ingredients: z.array(ingredientSchema).min(1),
  notes: z.string().optional(),
});

const planSchema = z.object({
  meals: z.array(mealSchema).min(1),
});

export interface GenerateMealPlanInput {
  members: FamilyMember[];
  weekStart: string; // ISO date of first dinner
  days: number; // 5–7
  busyNights: BusyNight[];
}

function buildSystemPrompt(): string {
  return [
    "You are FamilyTable's meal-planning chef. You design weekly DINNER plans for",
    "a household, producing meals that are realistic, varied, and family-friendly.",
    "",
    "Hard rules you MUST follow:",
    "1. Respect ALL household dietary constraints additively — a restriction held",
    "   by ANY member applies to EVERY meal in the plan.",
    "2. NEVER include an ingredient containing an allergen listed for the household.",
    "3. Avoid disliked foods.",
    "4. Prioritize ingredient REUSE across the week to minimize waste and cost.",
    "5. For nights flagged BUSY, design a genuinely SIMPLE meal (<= ~20 min active",
    "   time, few ingredients, or intentional leftovers) and set simple=true.",
    "6. Provide precise, shoppable ingredient quantities with units, and assign",
    "   each ingredient to the correct US supermarket section.",
    "7. Keep each `description` to ONE short, appetizing sentence. Do NOT include",
    "   cooking steps — recipes are generated separately.",
    "",
    `Valid grocery sections: ${GROCERY_SECTIONS.join(", ")}.`,
    "",
    "Return ONLY a tool call to `emit_meal_plan` — no prose.",
  ].join("\n");
}

function buildUserPrompt(input: GenerateMealPlanInput): string {
  const { members, weekStart, days, busyNights } = input;
  const constraints = aggregateConstraints(members);

  const roster = members
    .map((m) => {
      const parts = [
        `- ${m.name} (${m.portionSize} portion)`,
        m.dietaryPatterns.length
          ? `  diet: ${m.dietaryPatterns
              .map((d) => DIETARY_PATTERN_LABELS[d])
              .join(", ")}`
          : null,
        m.allergens.length
          ? `  allergies: ${m.allergens
              .map((a) => ALLERGEN_LABELS[a])
              .join(", ")}`
          : null,
        m.dislikes.length ? `  dislikes: ${m.dislikes.join(", ")}` : null,
        m.preferences.length ? `  likes: ${m.preferences.join(", ")}` : null,
      ].filter(Boolean);
      return parts.join("\n");
    })
    .join("\n");

  const busyList = busyNights.length
    ? busyNights
        .map((b) => `- ${b.date}${b.reason ? ` (${b.reason})` : ""}`)
        .join("\n")
    : "- (none)";

  return [
    `Plan ${days} consecutive dinners starting ${weekStart}.`,
    "",
    "HOUSEHOLD ROSTER:",
    roster || "(no members)",
    "",
    "AGGREGATED HOUSEHOLD CONSTRAINTS (apply to EVERY meal):",
    `- Allergens to exclude entirely: ${
      constraints.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ") || "none"
    }`,
    `- Dietary patterns: ${
      constraints.dietaryPatterns
        .map((d) => DIETARY_PATTERN_LABELS[d])
        .join(", ") || "none"
    }`,
    `- Disliked foods: ${constraints.dislikes.join(", ") || "none"}`,
    "",
    "BUSY NIGHTS (make these simple, simple=true):",
    busyList,
    "",
    `Assign one dinner per date from ${weekStart} for ${days} days.`,
  ].join("\n");
}

const EMIT_TOOL: Anthropic.Tool = {
  name: "emit_meal_plan",
  description: "Emit the finished weekly dinner plan.",
  input_schema: {
    type: "object",
    properties: {
      meals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string", description: "ISO date YYYY-MM-DD" },
            title: { type: "string" },
            description: { type: "string" },
            simple: { type: "boolean" },
            baseServings: { type: "number" },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                  section: { type: "string", enum: [...GROCERY_SECTIONS] },
                },
                required: ["name", "section"],
              },
            },
            notes: { type: "string" },
          },
          required: [
            "date",
            "title",
            "description",
            "simple",
            "baseServings",
            "ingredients",
          ],
        },
      },
    },
    required: ["meals"],
  },
};

// The bulk plan is lean (no recipes) so it generates well within the function
// time budget. Recipes are produced lazily, per meal, via generateRecipe().
const MAX_TOKENS = 6000;
const MAX_ATTEMPTS = 2;

/** Generate a validated meal plan. Throws on misconfiguration or invalid output. */
export async function generateMealPlan(
  input: GenerateMealPlanInput,
): Promise<Meal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  const client = new Anthropic({ apiKey });

  let lastIssue = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: [EMIT_TOOL],
      tool_choice: { type: "tool", name: "emit_meal_plan" },
      system: [
        {
          type: "text",
          text: buildSystemPrompt(),
          // Cache the static system prompt across requests.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    // If the model ran out of room, its tool JSON is incomplete — retry rather
    // than surfacing a confusing partial-parse error.
    if (response.stop_reason === "max_tokens") {
      lastIssue = "truncated";
      continue;
    }

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) {
      lastIssue = "no_tool_use";
      continue;
    }

    const parsed = planSchema.safeParse(toolUse.input);
    if (parsed.success) {
      return parsed.data.meals.map((m, i) => ({
        id: `meal-${input.weekStart}-${i}`,
        ...m,
      }));
    }
    lastIssue = "invalid_shape";
  }

  // Exhausted retries — surface a friendly, actionable message.
  throw new Error(
    lastIssue === "truncated"
      ? "The meal plan came back too long to finish. Please try generating again."
      : "The meal planner returned an incomplete plan. Please try again in a moment.",
  );
}

// ── Lazy per-meal recipe generation ──────────────────────────────────────────

const recipeSchema = z.object({
  recipe: z.array(z.string().min(1)).min(1),
});

const RECIPE_TOOL: Anthropic.Tool = {
  name: "emit_recipe",
  description: "Emit step-by-step cooking instructions for one meal.",
  input_schema: {
    type: "object",
    properties: {
      recipe: {
        type: "array",
        description: "Ordered cooking steps, each one short sentence.",
        items: { type: "string" },
      },
    },
    required: ["recipe"],
  },
};

export interface GenerateRecipeInput {
  title: string;
  description: string;
  ingredients: { name: string; quantity?: number; unit?: string }[];
  /** Household dietary constraints to honor in phrasing (optional context). */
  constraints?: string[];
}

/**
 * Generate the recipe for a single meal. Small and fast — called on demand when
 * a user expands a meal, so the bulk plan stays well under the function limit.
 */
export async function generateRecipe(
  input: GenerateRecipeInput,
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  const client = new Anthropic({ apiKey });

  const ingredientLines = input.ingredients
    .map(
      (i) =>
        `- ${[i.quantity, i.unit, i.name].filter(Boolean).join(" ").trim()}`,
    )
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [RECIPE_TOOL],
    tool_choice: { type: "tool", name: "emit_recipe" },
    system: [
      {
        type: "text",
        text:
          "You are a home-cooking assistant. Write clear, concise cooking " +
          "instructions as an ordered list of short steps (one sentence each, " +
          "typically 4–8 steps). Use only the provided ingredients. Honor any " +
          "stated household dietary constraints. Return ONLY the emit_recipe tool.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          `Meal: ${input.title}`,
          input.description ? `Description: ${input.description}` : "",
          input.constraints?.length
            ? `Household constraints: ${input.constraints.join(", ")}`
            : "",
          "",
          "Ingredients:",
          ingredientLines,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  const parsed = recipeSchema.safeParse(toolUse?.input);
  if (!parsed.success) {
    throw new Error("Could not generate a recipe. Please try again.");
  }
  return parsed.data.recipe;
}
