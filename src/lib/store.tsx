"use client";

// Household store with two interchangeable backends behind one interface:
//   • demo  — seeded from demo data, persisted to localStorage (no account)
//   • cloud — hydrated from the server snapshot, mutations go through server
//             actions to Supabase (RLS-scoped to the signed-in user)
// Pages consume `useStore()` and don't care which mode is active.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  demoBusyNights,
  demoMeals,
  demoMembers,
  DEMO_HOUSEHOLD_ID,
} from "./demo-data";
import {
  BusyNight,
  FamilyMember,
  GroceryItem,
  HouseholdSnapshot,
  Meal,
} from "./types";
import { buildGroceryList } from "./grocery";
import { encodeListPayload } from "./share";
import {
  addMemberAction,
  removeMemberAction,
  saveMealsAction,
  shareGroceryAction,
  toggleBusyNightAction,
  toggleGroceryItemAction,
  updateMemberAction,
} from "./actions";

const STORAGE_KEY = "familytable.v1";

type Mode = "demo" | "cloud";

interface StoreState {
  householdName: string;
  members: FamilyMember[];
  busyNights: BusyNight[];
  meals: Meal[];
  groceryChecked: Record<string, boolean>;
}

interface StoreContext extends StoreState {
  mode: Mode;
  saving: boolean;
  addMember: (m: Omit<FamilyMember, "id" | "householdId">) => void;
  updateMember: (id: string, patch: Partial<FamilyMember>) => void;
  removeMember: (id: string) => void;
  toggleBusyNight: (date: string, reason?: string) => void;
  setMeals: (meals: Meal[]) => void;
  groceryList: GroceryItem[];
  toggleGroceryItem: (name: string) => void;
  /** Returns the share token (demo payload or DB token) for `/share/<token>`. */
  shareGroceryList: () => Promise<string>;
  resetDemo: () => void;
}

const Ctx = createContext<StoreContext | null>(null);

const demoInitial: StoreState = {
  householdName: "The Demo Household",
  members: demoMembers,
  busyNights: demoBusyNights,
  meals: demoMeals,
  groceryChecked: {},
};

function uid(): string {
  return `m-${Math.random().toString(36).slice(2, 10)}`;
}

function snapshotToState(s: HouseholdSnapshot): StoreState {
  return {
    householdName: s.householdName,
    members: s.members,
    busyNights: s.busyNights,
    meals: s.meals,
    groceryChecked: s.groceryChecked,
  };
}

export function StoreProvider({
  children,
  mode = "demo",
  initial,
}: {
  children: React.ReactNode;
  mode?: Mode;
  initial?: HouseholdSnapshot;
}) {
  const [state, setState] = useState<StoreState>(
    mode === "cloud" && initial ? snapshotToState(initial) : demoInitial,
  );
  const [hydrated, setHydrated] = useState(mode === "cloud");
  const [saving, setSaving] = useState(false);

  // Demo mode only: hydrate from / persist to localStorage.
  useEffect(() => {
    if (mode !== "demo") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [mode]);

  useEffect(() => {
    if (mode !== "demo" || !hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated, mode]);

  /** Run a cloud server action, reconciling state to the returned snapshot. */
  async function withCloud(
    op: () => Promise<HouseholdSnapshot>,
    optimistic?: (s: StoreState) => StoreState,
  ) {
    if (optimistic) setState(optimistic);
    setSaving(true);
    try {
      const snap = await op();
      setState(snapshotToState(snap));
    } catch (e) {
      console.error("FamilyTable sync failed:", e);
    } finally {
      setSaving(false);
    }
  }

  const addMember: StoreContext["addMember"] = (m) => {
    if (mode === "cloud") {
      void withCloud(() => addMemberAction(m), (s) => ({
        ...s,
        members: [...s.members, { ...m, id: uid(), householdId: "pending" }],
      }));
    } else {
      setState((s) => ({
        ...s,
        members: [
          ...s.members,
          { ...m, id: uid(), householdId: DEMO_HOUSEHOLD_ID },
        ],
      }));
    }
  };

  const updateMember: StoreContext["updateMember"] = (id, patch) => {
    if (mode === "cloud") {
      void withCloud(() => updateMemberAction(id, patch), (s) => ({
        ...s,
        members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));
    } else {
      setState((s) => ({
        ...s,
        members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));
    }
  };

  const removeMember: StoreContext["removeMember"] = (id) => {
    if (mode === "cloud") {
      void withCloud(() => removeMemberAction(id), (s) => ({
        ...s,
        members: s.members.filter((m) => m.id !== id),
      }));
    } else {
      setState((s) => ({
        ...s,
        members: s.members.filter((m) => m.id !== id),
      }));
    }
  };

  const toggleBusyNight: StoreContext["toggleBusyNight"] = (date, reason) => {
    const optimistic = (s: StoreState): StoreState => {
      const exists = s.busyNights.find((b) => b.date === date);
      return exists
        ? { ...s, busyNights: s.busyNights.filter((b) => b.date !== date) }
        : {
            ...s,
            busyNights: [...s.busyNights, { date, source: "manual", reason }],
          };
    };
    if (mode === "cloud") {
      void withCloud(() => toggleBusyNightAction(date, reason), optimistic);
    } else {
      setState(optimistic);
    }
  };

  const setMeals: StoreContext["setMeals"] = (meals) => {
    if (mode === "cloud") {
      void withCloud(() => saveMealsAction(meals), (s) => ({
        ...s,
        meals,
        groceryChecked: {},
      }));
    } else {
      setState((s) => ({ ...s, meals, groceryChecked: {} }));
    }
  };

  const toggleGroceryItem: StoreContext["toggleGroceryItem"] = (name) => {
    // Optimistic in both modes; cloud persists in the background.
    setState((s) => ({
      ...s,
      groceryChecked: { ...s.groceryChecked, [name]: !s.groceryChecked[name] },
    }));
    if (mode === "cloud") {
      void toggleGroceryItemAction(name).catch((e) =>
        console.error("Grocery sync failed:", e),
      );
    }
  };

  const groceryList = useMemo(
    () =>
      buildGroceryList({ meals: state.meals, members: state.members }).map(
        (item) => ({ ...item, checked: !!state.groceryChecked[item.name] }),
      ),
    [state.meals, state.members, state.groceryChecked],
  );

  const shareGroceryList: StoreContext["shareGroceryList"] = async () => {
    if (mode === "cloud") {
      const token = await shareGroceryAction();
      if (!token) throw new Error("No grocery list to share yet.");
      return token;
    }
    return encodeListPayload({
      householdName: state.householdName,
      items: groceryList.map(({ name, section, quantity, unit }) => ({
        name,
        section,
        quantity,
        unit,
      })),
    });
  };

  const resetDemo = () => setState(demoInitial);

  const value: StoreContext = {
    ...state,
    mode,
    saving,
    addMember,
    updateMember,
    removeMember,
    toggleBusyNight,
    setMeals,
    groceryList,
    toggleGroceryItem,
    shareGroceryList,
    resetDemo,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
