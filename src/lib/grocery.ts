// ─────────────────────────────────────────────────────────────────────────────
// Smart grocery list builder (PRD §5.5).
//
// De-duplicates ingredients across meals, merges quantities (respecting units),
// scales by household servings weighted by portion size, and groups by standard
// US supermarket section in a fixed shopping order.
// ─────────────────────────────────────────────────────────────────────────────

import {
  FamilyMember,
  GROCERY_SECTIONS,
  GroceryItem,
  GrocerySection,
  Ingredient,
  Meal,
  PORTION_MULTIPLIER,
} from "./types";

/**
 * Effective household servings: sum of per-member portion multipliers.
 * A household of two mediums + one small ≈ 2.75 servings.
 */
export function householdServings(members: FamilyMember[]): number {
  if (members.length === 0) return 1;
  return members.reduce((sum, m) => sum + PORTION_MULTIPLIER[m.portionSize], 0);
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Canonical key for merging. Same name + same unit merge; different units stay
 * separate so we never add "2 cups" to "3 cloves".
 */
function mergeKey(name: string, unit?: string): string {
  return `${normalizeName(name)}::${(unit ?? "").toLowerCase().trim()}`;
}

function roundQty(n: number): number {
  // Keep one decimal where useful; round tiny noise away.
  return Math.round(n * 100) / 100;
}

export interface BuildGroceryListOptions {
  meals: Meal[];
  members: FamilyMember[];
}

/**
 * Build the merged, sectioned grocery list.
 *
 * Each ingredient's quantity is assumed to be authored for the meal's
 * `baseServings`. We scale it to the household's effective servings, then merge
 * identical ingredients across meals.
 */
export function buildGroceryList({
  meals,
  members,
}: BuildGroceryListOptions): GroceryItem[] {
  const servings = householdServings(members);
  const merged = new Map<string, GroceryItem>();

  for (const meal of meals) {
    const base = meal.baseServings > 0 ? meal.baseServings : servings;
    const scale = servings / base;

    for (const ing of meal.ingredients) {
      const key = mergeKey(ing.name, ing.unit);
      const existing = merged.get(key);
      const scaledQty =
        ing.quantity != null ? roundQty(ing.quantity * scale) : undefined;

      if (existing) {
        if (scaledQty != null) {
          existing.quantity = roundQty((existing.quantity ?? 0) + scaledQty);
        }
        if (!existing.usedIn.includes(meal.title)) {
          existing.usedIn.push(meal.title);
        }
      } else {
        merged.set(key, {
          name: titleCase(ing.name),
          section: ing.section,
          quantity: scaledQty,
          unit: ing.unit,
          usedIn: [meal.title],
          checked: false,
        });
      }
    }
  }

  // Round each merged total UP to the nearest whole unit — you can't buy 2.89
  // avocados. Quantities accumulate precisely above; we ceil only once, here.
  const items = [...merged.values()].map((item) => ({
    ...item,
    quantity: item.quantity != null ? Math.ceil(item.quantity) : undefined,
  }));

  return sortBySection(items);
}

/** Group items by section in canonical shopping order, alphabetical within. */
export function groupBySection(
  items: GroceryItem[],
): { section: GrocerySection; items: GroceryItem[] }[] {
  const groups = new Map<GrocerySection, GroceryItem[]>();
  for (const section of GROCERY_SECTIONS) groups.set(section, []);
  for (const item of items) {
    const section = GROCERY_SECTIONS.includes(item.section)
      ? item.section
      : "Other";
    groups.get(section)!.push(item);
  }
  return GROCERY_SECTIONS.map((section) => ({
    section,
    items: groups.get(section)!.sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

function sortBySection(items: GroceryItem[]): GroceryItem[] {
  const order = new Map(GROCERY_SECTIONS.map((s, i) => [s, i]));
  return [...items].sort((a, b) => {
    const sa = order.get(a.section) ?? 999;
    const sb = order.get(b.section) ?? 999;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

function titleCase(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const __testing = { mergeKey, normalizeName, titleCase };
