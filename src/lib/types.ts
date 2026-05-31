// ─────────────────────────────────────────────────────────────────────────────
// Core domain types for FamilyTable.
// ─────────────────────────────────────────────────────────────────────────────

/** The "Big 9" US allergens plus gluten — the set the rule engine guards. */
export const ALLERGENS = [
  "milk",
  "eggs",
  "fish",
  "shellfish",
  "tree_nuts",
  "peanuts",
  "wheat",
  "soybeans",
  "sesame",
  "gluten",
] as const;

export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: "Milk",
  eggs: "Eggs",
  fish: "Fish",
  shellfish: "Shellfish",
  tree_nuts: "Tree nuts",
  peanuts: "Peanuts",
  wheat: "Wheat",
  soybeans: "Soy",
  sesame: "Sesame",
  gluten: "Gluten",
};

/** Dietary patterns that combine additively across the household. */
export const DIETARY_PATTERNS = [
  "vegan",
  "vegetarian",
  "pescatarian",
  "gluten_free",
  "dairy_free",
  "kosher",
  "halal",
  "keto",
  "paleo",
] as const;

export type DietaryPattern = (typeof DIETARY_PATTERNS)[number];

export const DIETARY_PATTERN_LABELS: Record<DietaryPattern, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  kosher: "Kosher",
  halal: "Halal",
  keto: "Keto",
  paleo: "Paleo",
};

export type PortionSize = "small" | "medium" | "large";

/** Multiplier applied to base servings when scaling grocery quantities. */
export const PORTION_MULTIPLIER: Record<PortionSize, number> = {
  small: 0.75,
  medium: 1,
  large: 1.35,
};

export interface FamilyMember {
  id: string;
  householdId: string;
  name: string;
  dietaryPatterns: DietaryPattern[];
  allergens: Allergen[];
  dislikes: string[];
  preferences: string[];
  portionSize: PortionSize;
}

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

/** A single ingredient line within a meal. */
export interface Ingredient {
  name: string;
  /** Numeric quantity in `unit`s; may be undefined for "to taste" items. */
  quantity?: number;
  unit?: string;
  section: GrocerySection;
}

export const GROCERY_SECTIONS = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Frozen",
  "Pantry",
  "Canned & Jarred",
  "Condiments & Spices",
  "Beverages",
  "Other",
] as const;

export type GrocerySection = (typeof GROCERY_SECTIONS)[number];

export interface Meal {
  id: string;
  /** ISO date (YYYY-MM-DD) for the dinner. */
  date: string;
  title: string;
  description: string;
  /** True when the AI marked this for a flagged busy night. */
  simple: boolean;
  baseServings: number;
  ingredients: Ingredient[];
  /** Ordered, step-by-step cooking instructions. */
  recipe?: string[];
  /** Free-text prep notes. */
  notes?: string;
}

/** Per-member allergen finding for a single meal. */
export interface AllergenWarning {
  memberName: string;
  allergen: Allergen;
  /** Ingredient names that triggered the warning. */
  triggeredBy: string[];
}

/** Result of running the deterministic engine over one meal. */
export interface MealSafetyReport {
  mealId: string;
  warnings: AllergenWarning[];
  /** Dietary-pattern violations, e.g. "meat in a vegan household". */
  dietaryViolations: string[];
  safe: boolean;
}

export interface MealPlan {
  id: string;
  householdId: string;
  weekStart: string; // ISO date of the first dinner
  meals: Meal[];
  createdAt: string;
}

export interface GroceryItem {
  name: string;
  section: GrocerySection;
  quantity?: number;
  unit?: string;
  /** Meal titles this item is needed for (for transparency). */
  usedIn: string[];
  checked?: boolean;
}

export interface GroceryList {
  id: string;
  mealPlanId: string;
  householdId: string;
  items: GroceryItem[];
  shareToken?: string;
  createdAt: string;
}

/** A busy-night flag, either detected from calendar or set manually. */
export interface BusyNight {
  date: string; // ISO date
  source: "calendar" | "manual";
  reason?: string;
}

/**
 * Serializable snapshot of a household's full working state. Used to hydrate
 * the client store from the server (cloud mode) and returned by server actions
 * after a mutation so the client can reconcile to authoritative state.
 */
export interface HouseholdSnapshot {
  householdName: string;
  members: FamilyMember[];
  busyNights: BusyNight[];
  meals: Meal[];
  /** Checked state of grocery items, keyed by display name. */
  groceryChecked: Record<string, boolean>;
}
