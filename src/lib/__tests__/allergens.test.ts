import { describe, expect, it } from "vitest";
import {
  aggregateConstraints,
  allergensForIngredient,
  analyzeMeal,
} from "../allergens";
import { FamilyMember, Meal } from "../types";

function member(partial: Partial<FamilyMember>): FamilyMember {
  return {
    id: "m1",
    householdId: "h1",
    name: "Test",
    dietaryPatterns: [],
    allergens: [],
    dislikes: [],
    preferences: [],
    portionSize: "medium",
    ...partial,
  };
}

function meal(ingredients: Meal["ingredients"]): Meal {
  return {
    id: "meal-1",
    date: "2026-06-01",
    title: "Test Meal",
    description: "",
    simple: false,
    baseServings: 4,
    ingredients,
  };
}

describe("allergensForIngredient", () => {
  it("detects dairy from cheese, butter, cream", () => {
    expect(allergensForIngredient("shredded cheddar cheese")).toContain("milk");
    expect(allergensForIngredient("unsalted butter")).toContain("milk");
    expect(allergensForIngredient("heavy cream")).toContain("milk");
  });

  it("detects gluten and wheat from pasta and bread", () => {
    expect(allergensForIngredient("spaghetti pasta")).toContain("gluten");
    expect(allergensForIngredient("white bread")).toContain("wheat");
  });

  it("flags soy sauce as soy AND gluten AND wheat (conservative)", () => {
    const a = allergensForIngredient("soy sauce");
    expect(a).toContain("soybeans");
    expect(a).toContain("gluten");
  });

  it("detects shellfish vs fish separately", () => {
    expect(allergensForIngredient("jumbo shrimp")).toContain("shellfish");
    expect(allergensForIngredient("salmon fillet")).toContain("fish");
  });

  it("detects peanuts and tree nuts independently", () => {
    expect(allergensForIngredient("peanut butter")).toContain("peanuts");
    expect(allergensForIngredient("toasted almonds")).toContain("tree_nuts");
  });

  it("respects word boundaries — 'scream' is not 'cream'", () => {
    expect(allergensForIngredient("ice scream topping")).not.toContain("milk");
  });

  it("returns empty for plainly safe produce", () => {
    expect(allergensForIngredient("fresh broccoli")).toEqual([]);
    expect(allergensForIngredient("carrots")).toEqual([]);
  });
});

describe("analyzeMeal", () => {
  it("warns the specific member with the matching allergy", () => {
    const members = [
      member({ name: "Ava", allergens: ["peanuts"] }),
      member({ id: "m2", name: "Ben", allergens: ["milk"] }),
    ];
    const m = meal([
      { name: "peanut oil", section: "Pantry" },
      { name: "rice", section: "Pantry" },
    ]);
    const report = analyzeMeal(m, members);
    expect(report.safe).toBe(false);
    const avaWarning = report.warnings.find((w) => w.memberName === "Ava");
    expect(avaWarning?.allergen).toBe("peanuts");
    expect(avaWarning?.triggeredBy).toContain("peanut oil");
    // Ben (milk) should NOT be warned — no dairy present.
    expect(report.warnings.find((w) => w.memberName === "Ben")).toBeUndefined();
  });

  it("marks a clean meal as safe", () => {
    const members = [member({ name: "Ava", allergens: ["shellfish"] })];
    const m = meal([
      { name: "grilled chicken", section: "Meat & Seafood" },
      { name: "broccoli", section: "Produce" },
    ]);
    expect(analyzeMeal(m, members).safe).toBe(true);
  });

  it("flags a vegan dietary violation for animal products", () => {
    const members = [member({ name: "Ava", dietaryPatterns: ["vegan"] })];
    const m = meal([{ name: "ground beef", section: "Meat & Seafood" }]);
    const report = analyzeMeal(m, members);
    expect(report.dietaryViolations.length).toBeGreaterThan(0);
    expect(report.safe).toBe(false);
  });

  it("flags disliked foods", () => {
    const members = [member({ name: "Ava", dislikes: ["mushroom"] })];
    const m = meal([{ name: "sauteed mushrooms", section: "Produce" }]);
    const report = analyzeMeal(m, members);
    expect(report.dietaryViolations.some((v) => v.includes("mushroom"))).toBe(
      true,
    );
  });
});

describe("aggregateConstraints", () => {
  it("combines allergens and patterns additively across members", () => {
    const members = [
      member({ name: "A", allergens: ["milk"], dietaryPatterns: ["vegetarian"] }),
      member({
        id: "m2",
        name: "B",
        allergens: ["peanuts"],
        dietaryPatterns: ["gluten_free"],
      }),
    ];
    const c = aggregateConstraints(members);
    expect(c.allergens.sort()).toEqual(["milk", "peanuts"]);
    expect(c.dietaryPatterns.sort()).toEqual(["gluten_free", "vegetarian"]);
  });
});
