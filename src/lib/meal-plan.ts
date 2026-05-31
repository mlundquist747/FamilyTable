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

/** Generate a validated meal plan. Throws on misconfiguration or invalid output. */
export async function generateMealPlan(
  input: GenerateMealPlanInput,
): Promise<Meal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
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

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Model did not return a meal plan.");
  }

  const parsed = planSchema.parse(toolUse.input);
  return parsed.meals.map((m, i) => ({
    id: `meal-${input.weekStart}-${i}`,
    ...m,
  }));
}
