import {
  ALLERGEN_LABELS,
  Allergen,
  DIETARY_PATTERN_LABELS,
  DietaryPattern,
} from "@/lib/types";

export function AllergenChip({ allergen }: { allergen: Allergen }) {
  return (
    <span className="chip bg-clay-100 text-clay-600">
      {ALLERGEN_LABELS[allergen]}
    </span>
  );
}

export function DietChip({ pattern }: { pattern: DietaryPattern }) {
  return (
    <span className="chip bg-sage-100 text-sage-700">
      {DIETARY_PATTERN_LABELS[pattern]}
    </span>
  );
}

export function SafetyBadge({ safe }: { safe: boolean }) {
  return safe ? (
    <span className="chip bg-sage-100 text-sage-700">✓ Safe for all</span>
  ) : (
    <span className="chip bg-clay-100 text-clay-600">⚠ Check warnings</span>
  );
}

export function SimpleBadge() {
  return (
    <span className="chip bg-amber-100 text-amber-700">⚡ Simple night</span>
  );
}
