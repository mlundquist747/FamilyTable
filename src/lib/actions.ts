"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Server actions — the mutation surface the client store calls in cloud mode.
//
// Each action re-derives the household from the authenticated session (never
// trusting a client-supplied household id), mutates via the RLS-scoped
// repository, and returns the fresh authoritative snapshot so the client can
// reconcile.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "./supabase/server";
import {
  deleteMemberRow,
  ensureShareToken,
  getHouseholdData,
  getOrCreateHousehold,
  insertMember,
  saveMealPlan,
  setMealRecipeRow,
  toggleBusyNightRow,
  toggleGroceryItemRow,
  updateMemberRow,
} from "./data";
import { FamilyMember, HouseholdSnapshot, Meal } from "./types";

async function requireHouseholdId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const household = await getOrCreateHousehold(user);
  return household.id;
}

export async function addMemberAction(
  member: Omit<FamilyMember, "id" | "householdId">,
): Promise<HouseholdSnapshot> {
  const hid = await requireHouseholdId();
  await insertMember(hid, member);
  return getHouseholdData(hid);
}

export async function updateMemberAction(
  id: string,
  patch: Partial<FamilyMember>,
): Promise<HouseholdSnapshot> {
  const hid = await requireHouseholdId();
  await updateMemberRow(hid, id, patch);
  return getHouseholdData(hid);
}

export async function removeMemberAction(
  id: string,
): Promise<HouseholdSnapshot> {
  const hid = await requireHouseholdId();
  await deleteMemberRow(hid, id);
  return getHouseholdData(hid);
}

export async function toggleBusyNightAction(
  date: string,
  reason?: string,
): Promise<HouseholdSnapshot> {
  const hid = await requireHouseholdId();
  await toggleBusyNightRow(hid, date, reason);
  return getHouseholdData(hid);
}

export async function saveMealsAction(
  meals: Meal[],
): Promise<HouseholdSnapshot> {
  const hid = await requireHouseholdId();
  await saveMealPlan(hid, meals);
  return getHouseholdData(hid);
}

export async function toggleGroceryItemAction(name: string): Promise<void> {
  const hid = await requireHouseholdId();
  await toggleGroceryItemRow(hid, name);
}

export async function setMealRecipeAction(
  mealId: string,
  recipe: string[],
): Promise<void> {
  const hid = await requireHouseholdId();
  await setMealRecipeRow(hid, mealId, recipe);
}

export async function shareGroceryAction(): Promise<string | null> {
  const hid = await requireHouseholdId();
  return ensureShareToken(hid);
}
