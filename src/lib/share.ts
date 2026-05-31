// Share-link payload encoding.
//
// Production sharing inserts a grocery_list row with an unguessable
// `share_token`, resolved server-side via the service role (PRD §6). For the
// demo (no DB), the list is encoded directly into a URL-safe payload so the
// public page renders without any server state. The two are distinguished by
// the "d~" prefix on demo payloads.

import { GrocerySection } from "./types";

export interface SharedItem {
  name: string;
  section: GrocerySection;
  quantity?: number;
  unit?: string;
}

export interface SharedList {
  householdName: string;
  items: SharedItem[];
}

const DEMO_PREFIX = "d~";

function toBase64Url(s: string): string {
  const b64 =
    typeof window === "undefined"
      ? Buffer.from(s, "utf-8").toString("base64")
      : btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof window === "undefined") {
    return Buffer.from(b64, "base64").toString("utf-8");
  }
  return decodeURIComponent(escape(atob(b64)));
}

/** Encode a list into a URL-safe demo payload. */
export function encodeListPayload(list: SharedList): string {
  return DEMO_PREFIX + toBase64Url(JSON.stringify(list));
}

/** True if the token is a self-contained demo payload (vs a DB token). */
export function isDemoPayload(token: string): boolean {
  return token.startsWith(DEMO_PREFIX);
}

/** Decode a demo payload back into a list, or null if invalid. */
export function decodeListPayload(token: string): SharedList | null {
  if (!isDemoPayload(token)) return null;
  try {
    const json = fromBase64Url(token.slice(DEMO_PREFIX.length));
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed as SharedList;
  } catch {
    return null;
  }
}

/** Generate an unguessable token for a DB-backed shared list. */
export function generateShareToken(): string {
  // 24 random bytes → 32-char url-safe string.
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return toBase64Url(bin);
}
