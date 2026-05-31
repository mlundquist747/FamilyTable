// ─────────────────────────────────────────────────────────────────────────────
// Server-side data repository (cloud mode).
//
// All reads/writes go through the RLS-scoped server client, so every query is
// automatically constrained to the signed-in user's household. NEVER import
// this from a client component — it touches request cookies via next/headers.
// ─────────────────────────────────────────────────────────────────────────────

import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { buildGroceryList } from "./grocery";
import { generateShareToken } from "./share";
import {
  Allergen,
  BusyNight,
  DietaryPattern,
  FamilyMember,
  GroceryItem,
  HouseholdSnapshot,
  Meal,
  PortionSize,
} from "./types";

interface HouseholdRow {
  id: string;
  name: string;
  owner_id: string;
}

interface MemberRow {
  id: string;
  household_id: string;
  name: string;
  dietary_patterns: string[] | null;
  allergens: string[] | null;
  dislikes: string[] | null;
  preferences: string[] | null;
  portion_size: string | null;
}

function rowToMember(r: MemberRow): FamilyMember {
  return {
    id: r.id,
    householdId: r.household_id,
    name: r.name,
    dietaryPatterns: (r.dietary_patterns ?? []) as DietaryPattern[],
    allergens: (r.allergens ?? []) as Allergen[],
    dislikes: r.dislikes ?? [],
    preferences: r.preferences ?? [],
    portionSize: (r.portion_size ?? "medium") as PortionSize,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Derive a friendly household name from the authenticated user. */
function defaultHouseholdName(user: User): string {
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const full = meta.full_name || meta.name;
  if (full) {
    const first = full.trim().split(/\s+/)[0];
    return `${first}'s Table`;
  }
  if (user.email) return `${user.email.split("@")[0]}'s Table`;
  return "My Household";
}

/**
 * Find the user's household, creating one on first sign-in. Returns the row.
 */
export async function getOrCreateHousehold(user: User): Promise<HouseholdRow> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("households")
    .select("id, name, owner_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as HouseholdRow;

  const { data: created, error } = await supabase
    .from("households")
    .insert({ name: defaultHouseholdName(user), owner_id: user.id })
    .select("id, name, owner_id")
    .single();

  if (error || !created) {
    // Lost a race or hit a transient error — re-read.
    const { data: again } = await supabase
      .from("households")
      .select("id, name, owner_id")
      .eq("owner_id", user.id)
      .limit(1)
      .single();
    if (again) return again as HouseholdRow;
    throw new Error(`Could not provision household: ${error?.message}`);
  }
  return created as HouseholdRow;
}

/** Load the full working snapshot for a household. */
export async function getHouseholdData(
  householdId: string,
): Promise<HouseholdSnapshot> {
  const supabase = await createClient();

  const [householdRes, membersRes, busyRes, planRes] = await Promise.all([
    supabase.from("households").select("name").eq("id", householdId).single(),
    supabase
      .from("members")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true }),
    supabase
      .from("busy_nights")
      .select("date, source, reason")
      .eq("household_id", householdId),
    supabase
      .from("meal_plans")
      .select("id, meals")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const meals = (planRes.data?.meals ?? []) as Meal[];

  // Persisted checked state lives on the saved grocery list.
  let groceryChecked: Record<string, boolean> = {};
  const { data: list } = await supabase
    .from("grocery_lists")
    .select("items")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (list?.items) {
    for (const item of list.items as GroceryItem[]) {
      if (item.checked) groceryChecked[item.name] = true;
    }
  }

  return {
    householdName: householdRes.data?.name ?? "My Household",
    members: ((membersRes.data ?? []) as MemberRow[]).map(rowToMember),
    busyNights: (busyRes.data ?? []) as BusyNight[],
    meals,
    groceryChecked,
  };
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function insertMember(
  householdId: string,
  m: Omit<FamilyMember, "id" | "householdId">,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("members").insert({
    household_id: householdId,
    name: m.name,
    dietary_patterns: m.dietaryPatterns,
    allergens: m.allergens,
    dislikes: m.dislikes,
    preferences: m.preferences,
    portion_size: m.portionSize,
  });
}

export async function updateMemberRow(
  householdId: string,
  id: string,
  patch: Partial<FamilyMember>,
): Promise<void> {
  const supabase = await createClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.dietaryPatterns !== undefined)
    row.dietary_patterns = patch.dietaryPatterns;
  if (patch.allergens !== undefined) row.allergens = patch.allergens;
  if (patch.dislikes !== undefined) row.dislikes = patch.dislikes;
  if (patch.preferences !== undefined) row.preferences = patch.preferences;
  if (patch.portionSize !== undefined) row.portion_size = patch.portionSize;
  await supabase
    .from("members")
    .update(row)
    .eq("id", id)
    .eq("household_id", householdId);
}

export async function deleteMemberRow(
  householdId: string,
  id: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("members")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);
}

export async function toggleBusyNightRow(
  householdId: string,
  date: string,
  reason?: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("busy_nights")
    .select("id")
    .eq("household_id", householdId)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    await supabase.from("busy_nights").delete().eq("id", existing.id);
  } else {
    await supabase.from("busy_nights").insert({
      household_id: householdId,
      date,
      source: "manual",
      reason,
    });
  }
}

/** Persist a freshly generated plan and rebuild its grocery list. */
export async function saveMealPlan(
  householdId: string,
  meals: Meal[],
): Promise<void> {
  const supabase = await createClient();

  // Replace any prior plan (we keep only the current week).
  await supabase.from("meal_plans").delete().eq("household_id", householdId);
  const { data: plan } = await supabase
    .from("meal_plans")
    .insert({
      household_id: householdId,
      week_start: meals[0]?.date ?? today(),
      meals,
    })
    .select("id")
    .single();

  const { data: memberRows } = await supabase
    .from("members")
    .select("*")
    .eq("household_id", householdId);
  const members = ((memberRows ?? []) as MemberRow[]).map(rowToMember);
  const items = buildGroceryList({ meals, members });

  await supabase.from("grocery_lists").delete().eq("household_id", householdId);
  if (plan) {
    await supabase.from("grocery_lists").insert({
      household_id: householdId,
      meal_plan_id: plan.id,
      items,
    });
  }
}

/** Toggle one grocery item's checked state on the saved list. */
export async function toggleGroceryItemRow(
  householdId: string,
  name: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: list } = await supabase
    .from("grocery_lists")
    .select("id, items")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!list) return;
  const items = (list.items as GroceryItem[]).map((it) =>
    it.name === name ? { ...it, checked: !it.checked } : it,
  );
  await supabase.from("grocery_lists").update({ items }).eq("id", list.id);
}

/** Ensure the saved grocery list has a share token; return it. */
export async function ensureShareToken(
  householdId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: list } = await supabase
    .from("grocery_lists")
    .select("id, share_token")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!list) return null;
  if (list.share_token) return list.share_token;
  const token = generateShareToken();
  await supabase
    .from("grocery_lists")
    .update({ share_token: token })
    .eq("id", list.id);
  return token;
}
