// In-memory demo household + sample plan. Lets the app render and be explored
// before Supabase/Google/Anthropic are configured. Production reads from the DB.

import { BusyNight, FamilyMember, Meal } from "./types";

export const DEMO_HOUSEHOLD_ID = "demo-household";

export const demoMembers: FamilyMember[] = [
  {
    id: "demo-ava",
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Ava",
    dietaryPatterns: ["vegetarian"],
    allergens: ["peanuts"],
    dislikes: ["mushrooms"],
    preferences: ["pasta", "mexican"],
    portionSize: "medium",
  },
  {
    id: "demo-ben",
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Ben",
    dietaryPatterns: [],
    allergens: ["shellfish"],
    dislikes: ["olives"],
    preferences: ["grilled", "asian"],
    portionSize: "large",
  },
  {
    id: "demo-mia",
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Mia",
    dietaryPatterns: ["gluten_free"],
    allergens: ["milk"],
    dislikes: [],
    preferences: ["chicken", "rice bowls"],
    portionSize: "small",
  },
];

export const demoBusyNights: BusyNight[] = [
  { date: nextDate(2), source: "calendar", reason: "Soccer practice 6–8pm" },
  { date: nextDate(4), source: "manual", reason: "Late work night" },
];

export const demoMeals: Meal[] = [
  {
    id: "demo-meal-0",
    date: nextDate(0),
    title: "Veggie Rice Bowls with Crispy Tofu",
    description:
      "Sesame-ginger tofu over jasmine rice with roasted broccoli and carrots. Gluten-free tamari keeps it safe for everyone.",
    simple: false,
    baseServings: 3,
    ingredients: [
      { name: "firm tofu", quantity: 14, unit: "oz", section: "Pantry" },
      { name: "jasmine rice", quantity: 1.5, unit: "cups", section: "Pantry" },
      { name: "broccoli", quantity: 1, unit: "head", section: "Produce" },
      { name: "carrots", quantity: 3, unit: "each", section: "Produce" },
      { name: "tamari (gluten-free)", quantity: 3, unit: "tbsp", section: "Condiments & Spices" },
      { name: "fresh ginger", quantity: 1, unit: "knob", section: "Produce" },
      { name: "sesame oil", quantity: 1, unit: "tbsp", section: "Condiments & Spices" },
    ],
    notes: "Press tofu 15 min for max crispiness.",
  },
  {
    id: "demo-meal-1",
    date: nextDate(1),
    title: "Black Bean & Sweet Potato Tacos",
    description:
      "Smoky black beans and roasted sweet potato in corn tortillas with avocado-lime crema (dairy-free).",
    simple: false,
    baseServings: 3,
    ingredients: [
      { name: "black beans", quantity: 2, unit: "can", section: "Canned & Jarred" },
      { name: "sweet potato", quantity: 2, unit: "each", section: "Produce" },
      { name: "corn tortillas", quantity: 12, unit: "each", section: "Bakery" },
      { name: "avocado", quantity: 2, unit: "each", section: "Produce" },
      { name: "lime", quantity: 2, unit: "each", section: "Produce" },
      { name: "cumin", quantity: 1, unit: "tsp", section: "Condiments & Spices" },
    ],
  },
  {
    id: "demo-meal-2",
    date: nextDate(2),
    title: "Speedy Pesto Pasta (gluten-free)",
    description:
      "20-minute weeknight save: gluten-free penne tossed with basil pesto, cherry tomatoes and white beans.",
    simple: true,
    baseServings: 3,
    ingredients: [
      { name: "gluten-free penne", quantity: 12, unit: "oz", section: "Pantry" },
      { name: "basil pesto (dairy-free)", quantity: 0.5, unit: "cup", section: "Condiments & Spices" },
      { name: "cherry tomatoes", quantity: 1, unit: "pint", section: "Produce" },
      { name: "cannellini beans", quantity: 1, unit: "can", section: "Canned & Jarred" },
    ],
    notes: "Busy night — minimal prep, one pot.",
  },
  {
    id: "demo-meal-3",
    date: nextDate(3),
    title: "Sheet-Pan Lemon Herb Chicken & Veggies",
    description:
      "Juicy chicken thighs roasted with green beans and baby potatoes. Cooked separately from the veg portion for Ava.",
    simple: false,
    baseServings: 3,
    ingredients: [
      { name: "chicken thighs", quantity: 6, unit: "each", section: "Meat & Seafood" },
      { name: "baby potatoes", quantity: 1.5, unit: "lb", section: "Produce" },
      { name: "green beans", quantity: 1, unit: "lb", section: "Produce" },
      { name: "lemon", quantity: 2, unit: "each", section: "Produce" },
      { name: "olive oil", quantity: 3, unit: "tbsp", section: "Condiments & Spices" },
    ],
    notes: "Reserve a tray of veg + chickpeas for Ava (vegetarian).",
  },
  {
    id: "demo-meal-4",
    date: nextDate(4),
    title: "Leftover Remix Bowls",
    description:
      "Busy night: combine the week's leftover rice, roasted veg and beans into quick grain bowls.",
    simple: true,
    baseServings: 3,
    ingredients: [
      { name: "leftover rice", quantity: 2, unit: "cups", section: "Pantry" },
      { name: "mixed greens", quantity: 5, unit: "oz", section: "Produce" },
      { name: "black beans", quantity: 1, unit: "can", section: "Canned & Jarred" },
    ],
    notes: "Manual busy night — intentional leftovers.",
  },
  {
    id: "demo-meal-5",
    date: nextDate(5),
    title: "Margherita Flatbreads (gluten-free)",
    description:
      "Gluten-free flatbreads with crushed tomato, dairy-free mozzarella and fresh basil. Build-your-own toppings bar.",
    simple: false,
    baseServings: 3,
    ingredients: [
      { name: "gluten-free flatbread", quantity: 3, unit: "each", section: "Bakery" },
      { name: "crushed tomatoes", quantity: 1, unit: "can", section: "Canned & Jarred" },
      { name: "dairy-free mozzarella", quantity: 8, unit: "oz", section: "Dairy & Eggs" },
      { name: "fresh basil", quantity: 1, unit: "bunch", section: "Produce" },
    ],
  },
  {
    id: "demo-meal-6",
    date: nextDate(6),
    title: "Coconut Chickpea Curry",
    description:
      "Cozy weekend curry: chickpeas and spinach simmered in coconut milk over rice. Naturally vegan and allergy-friendly.",
    simple: false,
    baseServings: 3,
    ingredients: [
      { name: "chickpeas", quantity: 2, unit: "can", section: "Canned & Jarred" },
      { name: "coconut milk", quantity: 1, unit: "can", section: "Canned & Jarred" },
      { name: "baby spinach", quantity: 6, unit: "oz", section: "Produce" },
      { name: "jasmine rice", quantity: 1.5, unit: "cups", section: "Pantry" },
      { name: "curry powder", quantity: 2, unit: "tbsp", section: "Condiments & Spices" },
      { name: "yellow onion", quantity: 1, unit: "each", section: "Produce" },
    ],
  },
];

/** ISO date `n` days from today. */
function nextDate(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
