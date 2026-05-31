"use client";

// Client-side household store. Seeded from demo data and persisted to
// localStorage so the app is fully interactive in demo mode. In a production
// deployment these actions would sync to Supabase via the server client.

import {
  createContext,
  useCallback,
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
import { BusyNight, FamilyMember, GroceryItem, Meal } from "./types";
import { buildGroceryList } from "./grocery";

const STORAGE_KEY = "familytable.v1";

interface StoreState {
  householdName: string;
  members: FamilyMember[];
  busyNights: BusyNight[];
  meals: Meal[];
  groceryChecked: Record<string, boolean>;
}

interface StoreContext extends StoreState {
  addMember: (m: Omit<FamilyMember, "id" | "householdId">) => void;
  updateMember: (id: string, patch: Partial<FamilyMember>) => void;
  removeMember: (id: string) => void;
  toggleBusyNight: (date: string, reason?: string) => void;
  setMeals: (meals: Meal[]) => void;
  groceryList: GroceryItem[];
  toggleGroceryItem: (name: string) => void;
  resetDemo: () => void;
}

const Ctx = createContext<StoreContext | null>(null);

const initialState: StoreState = {
  householdName: "The Demo Household",
  members: demoMembers,
  busyNights: demoBusyNights,
  meals: demoMeals,
  groceryChecked: {},
};

function uid(): string {
  return `m-${Math.random().toString(36).slice(2, 10)}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const addMember: StoreContext["addMember"] = (m) =>
    setState((s) => ({
      ...s,
      members: [
        ...s.members,
        { ...m, id: uid(), householdId: DEMO_HOUSEHOLD_ID },
      ],
    }));

  const updateMember: StoreContext["updateMember"] = (id, patch) =>
    setState((s) => ({
      ...s,
      members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));

  const removeMember: StoreContext["removeMember"] = (id) =>
    setState((s) => ({
      ...s,
      members: s.members.filter((m) => m.id !== id),
    }));

  const toggleBusyNight: StoreContext["toggleBusyNight"] = (date, reason) =>
    setState((s) => {
      const exists = s.busyNights.find((b) => b.date === date);
      if (exists) {
        return { ...s, busyNights: s.busyNights.filter((b) => b.date !== date) };
      }
      return {
        ...s,
        busyNights: [...s.busyNights, { date, source: "manual", reason }],
      };
    });

  const setMeals: StoreContext["setMeals"] = (meals) =>
    setState((s) => ({ ...s, meals, groceryChecked: {} }));

  const toggleGroceryItem: StoreContext["toggleGroceryItem"] = (name) =>
    setState((s) => ({
      ...s,
      groceryChecked: {
        ...s.groceryChecked,
        [name]: !s.groceryChecked[name],
      },
    }));

  const resetDemo = () => setState(initialState);

  const groceryList = useMemo(
    () =>
      buildGroceryList({ meals: state.meals, members: state.members }).map(
        (item) => ({ ...item, checked: !!state.groceryChecked[item.name] }),
      ),
    [state.meals, state.members, state.groceryChecked],
  );

  const value: StoreContext = {
    ...state,
    addMember,
    updateMember,
    removeMember,
    toggleBusyNight,
    setMeals,
    groceryList,
    toggleGroceryItem,
    resetDemo,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
