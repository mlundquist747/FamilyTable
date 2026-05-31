// ─────────────────────────────────────────────────────────────────────────────
// Deterministic allergen rule engine — the critical safeguard (PRD §5.4).
//
// This engine independently re-scans every ingredient against the Big-9 US
// allergens (+ gluten) and the household roster, REGARDLESS of what the AI
// claimed. It is intentionally conservative: false positives are acceptable,
// false negatives are not.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Allergen,
  AllergenWarning,
  DietaryPattern,
  FamilyMember,
  Ingredient,
  Meal,
  MealSafetyReport,
} from "./types";

/**
 * Keyword → allergen map. Each allergen lists substrings that, when found in an
 * ingredient name (case-insensitive, word-ish boundaries), imply the allergen
 * may be present. Lists err toward over-inclusion.
 */
const ALLERGEN_KEYWORDS: Record<Allergen, string[]> = {
  milk: [
    "milk",
    "butter",
    "buttermilk",
    "cream",
    "cheese",
    "yogurt",
    "yoghurt",
    "ghee",
    "casein",
    "caseinate",
    "whey",
    "custard",
    "curd",
    "ricotta",
    "mozzarella",
    "parmesan",
    "cheddar",
    "feta",
    "mascarpone",
    "gelato",
    "ice cream",
    "kefir",
    "lactose",
    "half-and-half",
    "half and half",
  ],
  eggs: [
    "egg",
    "eggs",
    "mayonnaise",
    "mayo",
    "aioli",
    "meringue",
    "albumin",
    "ovalbumin",
    "frittata",
    "omelet",
    "omelette",
    "quiche",
    "custard",
  ],
  fish: [
    "fish",
    "salmon",
    "tuna",
    "cod",
    "tilapia",
    "halibut",
    "trout",
    "anchovy",
    "anchovies",
    "sardine",
    "mackerel",
    "bass",
    "snapper",
    "catfish",
    "haddock",
    "pollock",
    "fish sauce",
    "worcestershire",
    "caviar",
    "roe",
  ],
  shellfish: [
    "shrimp",
    "prawn",
    "crab",
    "lobster",
    "crawfish",
    "crayfish",
    "clam",
    "mussel",
    "oyster",
    "scallop",
    "squid",
    "calamari",
    "octopus",
    "shellfish",
    "krill",
    "langoustine",
  ],
  tree_nuts: [
    "almond",
    "cashew",
    "walnut",
    "pecan",
    "pistachio",
    "hazelnut",
    "macadamia",
    "brazil nut",
    "pine nut",
    "chestnut",
    "praline",
    "marzipan",
    "nutella",
    "nut butter",
    "tree nut",
  ],
  peanuts: ["peanut", "peanuts", "groundnut", "goober", "satay", "peanut butter"],
  wheat: [
    "wheat",
    "flour",
    "bread",
    "breadcrumb",
    "panko",
    "pasta",
    "noodle",
    "couscous",
    "bulgur",
    "farro",
    "semolina",
    "cracker",
    "tortilla",
    "pita",
    "bun",
    "roll",
    "bagel",
    "biscuit",
    "pastry",
    "cake",
    "cookie",
    "pretzel",
    "soy sauce",
    "seitan",
    "spelt",
    "durum",
  ],
  soybeans: [
    "soy",
    "soybean",
    "soya",
    "tofu",
    "tempeh",
    "edamame",
    "miso",
    "soy sauce",
    "tamari",
    "natto",
    "soy lecithin",
    "tvp",
    "textured vegetable protein",
  ],
  sesame: [
    "sesame",
    "tahini",
    "hummus",
    "halvah",
    "halva",
    "benne",
    "gomashio",
    "za'atar",
    "zaatar",
  ],
  gluten: [
    "wheat",
    "flour",
    "bread",
    "breadcrumb",
    "panko",
    "pasta",
    "noodle",
    "couscous",
    "bulgur",
    "farro",
    "barley",
    "rye",
    "malt",
    "semolina",
    "cracker",
    "tortilla",
    "pita",
    "bun",
    "roll",
    "bagel",
    "biscuit",
    "pastry",
    "cake",
    "cookie",
    "pretzel",
    "soy sauce",
    "seitan",
    "spelt",
    "durum",
    "orzo",
    "gnocchi",
  ],
};

/**
 * Ingredient name tokens that signal animal-derived content (for vegan/
 * vegetarian/pescatarian dietary checks). Kept separate from allergens.
 */
const MEAT_KEYWORDS = [
  "beef",
  "steak",
  "pork",
  "bacon",
  "ham",
  "sausage",
  "chicken",
  "turkey",
  "duck",
  "lamb",
  "veal",
  "venison",
  "bison",
  "prosciutto",
  "pancetta",
  "chorizo",
  "salami",
  "pepperoni",
  "meatball",
  "ground beef",
  "ground turkey",
  "gelatin",
  "lard",
  "broth", // chicken/beef broth — conservative
  "stock",
];

const SEAFOOD_KEYWORDS = [
  ...ALLERGEN_KEYWORDS.fish,
  ...ALLERGEN_KEYWORDS.shellfish,
];

const ANIMAL_PRODUCT_KEYWORDS = [
  ...MEAT_KEYWORDS,
  ...SEAFOOD_KEYWORDS,
  ...ALLERGEN_KEYWORDS.milk,
  ...ALLERGEN_KEYWORDS.eggs,
  "honey",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[_]/g, " ").trim();
}

/**
 * Returns true when `keyword` appears in `text` as a whole word-ish token.
 * Uses boundary checks so "creamer" matches "cream" but "scream" does not.
 */
function containsKeyword(text: string, keyword: string): boolean {
  const k = normalize(keyword);
  const t = normalize(text);
  if (k.includes(" ")) {
    // multi-word phrase: simple substring is fine
    return t.includes(k);
  }
  // single token: require a word boundary at the start to avoid "scream"→"cream"
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}`, "i");
  return re.test(t);
}

/** Which allergens does a single ingredient name imply? */
export function allergensForIngredient(name: string): Allergen[] {
  const found: Allergen[] = [];
  for (const allergen of Object.keys(ALLERGEN_KEYWORDS) as Allergen[]) {
    if (ALLERGEN_KEYWORDS[allergen].some((kw) => containsKeyword(name, kw))) {
      found.push(allergen);
    }
  }
  return found;
}

function containsAny(name: string, keywords: string[]): boolean {
  return keywords.some((kw) => containsKeyword(name, kw));
}

/**
 * Aggregate the household's effective constraints. Dietary rules combine
 * additively (PRD §5.1): any member's restriction applies to the whole plan.
 */
export interface HouseholdConstraints {
  allergens: Allergen[];
  dietaryPatterns: DietaryPattern[];
  dislikes: string[];
}

export function aggregateConstraints(
  members: FamilyMember[],
): HouseholdConstraints {
  const allergens = new Set<Allergen>();
  const dietaryPatterns = new Set<DietaryPattern>();
  const dislikes = new Set<string>();
  for (const m of members) {
    m.allergens.forEach((a) => allergens.add(a));
    m.dietaryPatterns.forEach((d) => dietaryPatterns.add(d));
    m.dislikes.forEach((d) => dislikes.add(normalize(d)));
  }
  return {
    allergens: [...allergens],
    dietaryPatterns: [...dietaryPatterns],
    dislikes: [...dislikes],
  };
}

/**
 * Run the deterministic engine over one meal against the full roster.
 * Produces per-member, per-allergen warnings plus dietary-pattern violations.
 */
export function analyzeMeal(
  meal: Meal,
  members: FamilyMember[],
): MealSafetyReport {
  const warnings: AllergenWarning[] = [];

  // Per-member allergen scan.
  for (const member of members) {
    for (const allergen of member.allergens) {
      const triggeredBy: string[] = [];
      for (const ing of meal.ingredients) {
        if (allergensForIngredient(ing.name).includes(allergen)) {
          triggeredBy.push(ing.name);
        }
      }
      if (triggeredBy.length > 0) {
        warnings.push({
          memberName: member.name,
          allergen,
          triggeredBy: [...new Set(triggeredBy)],
        });
      }
    }
  }

  // Household-level dietary violations (additive).
  const constraints = aggregateConstraints(members);
  const dietaryViolations = checkDietaryViolations(
    meal.ingredients,
    constraints.dietaryPatterns,
  );

  // Disliked foods (soft warning, surfaced as a violation note).
  for (const ing of meal.ingredients) {
    for (const dislike of constraints.dislikes) {
      if (dislike && containsKeyword(ing.name, dislike)) {
        dietaryViolations.push(
          `Contains "${ing.name}" — a disliked food (${dislike}).`,
        );
      }
    }
  }

  return {
    mealId: meal.id,
    warnings,
    dietaryViolations,
    safe: warnings.length === 0 && dietaryViolations.length === 0,
  };
}

function checkDietaryViolations(
  ingredients: Ingredient[],
  patterns: DietaryPattern[],
): string[] {
  const violations: string[] = [];
  const flag = (msg: string) => violations.push(msg);

  for (const ing of ingredients) {
    const name = ing.name;
    if (patterns.includes("vegan") && containsAny(name, ANIMAL_PRODUCT_KEYWORDS)) {
      flag(`"${name}" is animal-derived but the household is vegan.`);
    }
    if (
      patterns.includes("vegetarian") &&
      containsAny(name, [...MEAT_KEYWORDS, ...SEAFOOD_KEYWORDS])
    ) {
      flag(`"${name}" contains meat/seafood but the household is vegetarian.`);
    }
    if (patterns.includes("pescatarian") && containsAny(name, MEAT_KEYWORDS)) {
      flag(`"${name}" contains land-animal meat but the household is pescatarian.`);
    }
    if (
      patterns.includes("gluten_free") &&
      allergensForIngredient(name).includes("gluten")
    ) {
      flag(`"${name}" contains gluten but the household is gluten-free.`);
    }
    if (
      patterns.includes("dairy_free") &&
      allergensForIngredient(name).includes("milk")
    ) {
      flag(`"${name}" contains dairy but the household is dairy-free.`);
    }
  }
  return [...new Set(violations)];
}

/** Convenience: analyze every meal in a plan. */
export function analyzePlan(
  meals: Meal[],
  members: FamilyMember[],
): Record<string, MealSafetyReport> {
  const out: Record<string, MealSafetyReport> = {};
  for (const meal of meals) {
    out[meal.id] = analyzeMeal(meal, members);
  }
  return out;
}

export const __testing = { containsKeyword, normalize, ALLERGEN_KEYWORDS };
