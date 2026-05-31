"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  ALLERGENS,
  ALLERGEN_LABELS,
  DIETARY_PATTERNS,
  DIETARY_PATTERN_LABELS,
  FamilyMember,
  PortionSize,
} from "@/lib/types";
import { AllergenChip, DietChip } from "@/components/Badges";

type Draft = Omit<FamilyMember, "id" | "householdId">;

const emptyDraft: Draft = {
  name: "",
  dietaryPatterns: [],
  allergens: [],
  dislikes: [],
  preferences: [],
  portionSize: "medium",
};

export default function MembersPage() {
  const { members, addMember, updateMember, removeMember } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your family</h1>
        {!adding && (
          <button
            className="btn-primary"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            + Add member
          </button>
        )}
      </div>

      {adding && (
        <MemberForm
          initial={emptyDraft}
          onCancel={() => setAdding(false)}
          onSave={(d) => {
            addMember(d);
            setAdding(false);
          }}
        />
      )}

      <div className="space-y-3">
        {members.map((m) =>
          editingId === m.id ? (
            <MemberForm
              key={m.id}
              initial={m}
              onCancel={() => setEditingId(null)}
              onSave={(d) => {
                updateMember(m.id, d);
                setEditingId(null);
              }}
              onDelete={() => {
                removeMember(m.id);
                setEditingId(null);
              }}
            />
          ) : (
            <MemberCard
              key={m.id}
              member={m}
              onEdit={() => {
                setEditingId(m.id);
                setAdding(false);
              }}
            />
          ),
        )}
        {members.length === 0 && !adding && (
          <p className="text-ink/50 text-sm">
            No members yet. Add your first family member to get started.
          </p>
        )}
      </div>
    </div>
  );
}

function MemberCard({
  member,
  onEdit,
}: {
  member: FamilyMember;
  onEdit: () => void;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{member.name}</h3>
          <p className="text-xs text-ink/50 capitalize">
            {member.portionSize} portion
          </p>
        </div>
        <button className="btn-ghost text-sm" onClick={onEdit}>
          Edit
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {member.dietaryPatterns.map((d) => (
          <DietChip key={d} pattern={d} />
        ))}
        {member.allergens.map((a) => (
          <AllergenChip key={a} allergen={a} />
        ))}
      </div>
      {(member.dislikes.length > 0 || member.preferences.length > 0) && (
        <div className="mt-3 space-y-1 text-sm text-ink/60">
          {member.preferences.length > 0 && (
            <p>👍 Likes: {member.preferences.join(", ")}</p>
          )}
          {member.dislikes.length > 0 && (
            <p>👎 Dislikes: {member.dislikes.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function MemberForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Draft;
  onSave: (d: Draft) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);

  const toggle = <K extends "dietaryPatterns" | "allergens">(
    key: K,
    value: Draft[K][number],
  ) =>
    setDraft((d) => {
      const set = new Set(d[key] as string[]);
      set.has(value as string)
        ? set.delete(value as string)
        : set.add(value as string);
      return { ...d, [key]: [...set] } as Draft;
    });

  const setList = (key: "dislikes" | "preferences", raw: string) =>
    setDraft((d) => ({
      ...d,
      [key]: raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }));

  return (
    <div className="card p-5 space-y-4 border-sage-300">
      <div>
        <label className="label">Name</label>
        <input
          className="input"
          value={draft.name}
          placeholder="e.g. Ava"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </div>

      <div>
        <label className="label">Dietary patterns</label>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_PATTERNS.map((p) => {
            const on = draft.dietaryPatterns.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggle("dietaryPatterns", p)}
                className={`chip border ${
                  on
                    ? "bg-sage-600 text-white border-sage-600"
                    : "bg-white text-ink/70 border-sage-200"
                }`}
              >
                {DIETARY_PATTERN_LABELS[p]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label">Allergies</label>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => {
            const on = draft.allergens.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggle("allergens", a)}
                className={`chip border ${
                  on
                    ? "bg-clay-500 text-white border-clay-500"
                    : "bg-white text-ink/70 border-sage-200"
                }`}
              >
                {ALLERGEN_LABELS[a]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="label">Likes (comma-separated)</label>
          <input
            className="input"
            defaultValue={draft.preferences.join(", ")}
            placeholder="pasta, mexican, grilled"
            onChange={(e) => setList("preferences", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Dislikes (comma-separated)</label>
          <input
            className="input"
            defaultValue={draft.dislikes.join(", ")}
            placeholder="mushrooms, olives"
            onChange={(e) => setList("dislikes", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Portion size</label>
        <div className="flex gap-2">
          {(["small", "medium", "large"] as PortionSize[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDraft({ ...draft, portionSize: p })}
              className={`btn flex-1 capitalize ${
                draft.portionSize === p
                  ? "bg-sage-600 text-white"
                  : "bg-sage-50 text-sage-700 border border-sage-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <button
            className="btn-primary"
            disabled={!draft.name.trim()}
            onClick={() => onSave(draft)}
          >
            Save
          </button>
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
        {onDelete && (
          <button className="btn-ghost text-clay-600" onClick={onDelete}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
