import { describe, expect, it } from "vitest";
import { buildGroceryList, groupBySection, householdServings } from "../grocery";
import { FamilyMember, Meal } from "../types";

function member(portionSize: FamilyMember["portionSize"]): FamilyMember {
  return {
    id: Math.random().toString(),
    householdId: "h1",
    name: "M",
    dietaryPatterns: [],
    allergens: [],
    dislikes: [],
    preferences: [],
    portionSize,
  };
}

const baseMeal: Omit<Meal, "ingredients" | "title" | "id"> = {
  date: "2026-06-01",
  description: "",
  simple: false,
  baseServings: 4,
};

describe("householdServings", () => {
  it("sums portion multipliers", () => {
    const s = householdServings([
      member("medium"),
      member("medium"),
      member("small"),
    ]);
    expect(s).toBeCloseTo(2.75);
  });
});

describe("buildGroceryList", () => {
  it("merges identical ingredients across meals and sums quantities", () => {
    const members = [member("medium"), member("medium"), member("medium"), member("medium")];
    const meals: Meal[] = [
      {
        ...baseMeal,
        id: "1",
        title: "Tacos",
        ingredients: [
          { name: "onion", quantity: 1, unit: "each", section: "Produce" },
        ],
      },
      {
        ...baseMeal,
        id: "2",
        title: "Soup",
        ingredients: [
          { name: "Onion", quantity: 2, unit: "each", section: "Produce" },
        ],
      },
    ];
    const list = buildGroceryList({ meals, members });
    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(3); // 4 servings == baseServings, no scaling
    expect(list[0].usedIn.sort()).toEqual(["Soup", "Tacos"]);
  });

  it("keeps different units as separate line items", () => {
    const members = [member("medium"), member("medium"), member("medium"), member("medium")];
    const meals: Meal[] = [
      {
        ...baseMeal,
        id: "1",
        title: "A",
        ingredients: [
          { name: "garlic", quantity: 2, unit: "clove", section: "Produce" },
          { name: "garlic", quantity: 1, unit: "head", section: "Produce" },
        ],
      },
    ];
    const list = buildGroceryList({ meals, members });
    expect(list).toHaveLength(2);
  });

  it("scales quantities by household servings vs base servings", () => {
    // 8 servings of medium vs baseServings 4 => scale 2x
    const members = Array.from({ length: 8 }, () => member("medium"));
    const meals: Meal[] = [
      {
        ...baseMeal,
        id: "1",
        title: "Pasta",
        baseServings: 4,
        ingredients: [
          { name: "pasta", quantity: 1, unit: "lb", section: "Pantry" },
        ],
      },
    ];
    const list = buildGroceryList({ meals, members });
    expect(list[0].quantity).toBe(2);
  });
});

describe("groupBySection", () => {
  it("orders sections canonically and sorts within", () => {
    const groups = groupBySection([
      { name: "Zucchini", section: "Produce", usedIn: [] },
      { name: "Apple", section: "Produce", usedIn: [] },
      { name: "Milk", section: "Dairy & Eggs", usedIn: [] },
    ]);
    expect(groups[0].section).toBe("Produce");
    expect(groups[0].items.map((i) => i.name)).toEqual(["Apple", "Zucchini"]);
    expect(groups[1].section).toBe("Dairy & Eggs");
  });
});
