"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/members", label: "Family", icon: "👪" },
  { href: "/plan", label: "Plan", icon: "🍽️" },
  { href: "/grocery", label: "Grocery", icon: "🛒" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-sage-100 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-2xl grid-cols-4">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
                active ? "text-sage-600" : "text-ink/45 hover:text-ink/70"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
