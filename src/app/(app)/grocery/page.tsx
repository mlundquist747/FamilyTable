"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { groupBySection } from "@/lib/grocery";

export default function GroceryPage() {
  const { groceryList, toggleGroceryItem, shareGroceryList } = useStore();
  const groups = groupBySection(groceryList);
  const total = groceryList.length;
  const checked = groceryList.filter((i) => i.checked).length;
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function share() {
    setSharing(true);
    try {
      const token = await shareGroceryList();
      const url = `${window.location.origin}/share/${token}`;
      setShareUrl(url);
      navigator.clipboard?.writeText(url).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        () => {},
      );
    } catch {
      setShareUrl(null);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grocery list</h1>
          <p className="text-sm text-ink/60 mt-0.5">
            {checked} / {total} items · {groups.length} aisles
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={share}
          disabled={total === 0 || sharing}
        >
          {sharing ? "Sharing…" : "🔗 Share"}
        </button>
      </div>

      {shareUrl && (
        <div className="card p-4 text-sm">
          <p className="font-medium">{copied ? "Link copied!" : "Share link"}</p>
          <p className="mt-1 break-all text-ink/60 text-xs">{shareUrl}</p>
        </div>
      )}

      {total === 0 ? (
        <div className="card p-5 text-sm text-ink/60">
          No items yet — generate a meal plan first.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.section}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-sage-600 mb-2">
                {group.section}
              </h2>
              <div className="card divide-y divide-sage-100">
                {group.items.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => toggleGroceryItem(item.name)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                        item.checked
                          ? "bg-sage-600 border-sage-600 text-white"
                          : "border-sage-300"
                      }`}
                    >
                      {item.checked && "✓"}
                    </span>
                    <span
                      className={`flex-1 text-sm ${
                        item.checked ? "line-through text-ink/40" : ""
                      }`}
                    >
                      {item.name}
                    </span>
                    {item.quantity != null && (
                      <span className="text-xs text-ink/40">
                        {item.quantity} {item.unit ?? ""}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
