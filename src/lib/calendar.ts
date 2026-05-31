// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar integration (PRD §5.2).
//
// Detects evening conflicts (events overlapping ~5–9pm) and flags those nights
// for simpler meals/leftovers. Manual flags take precedence over detected ones.
// ─────────────────────────────────────────────────────────────────────────────

import { BusyNight } from "./types";

export interface CalendarEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

const EVENING_START_HOUR = 17; // 5pm
const EVENING_END_HOUR = 21; // 9pm

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Does this event overlap the 5–9pm evening window on its date?
 * All-day events (date but no dateTime) are treated as busy evenings too.
 */
function overlapsEvening(event: CalendarEvent): boolean {
  if (event.start?.date && !event.start.dateTime) {
    return true; // all-day event
  }
  if (!event.start?.dateTime || !event.end?.dateTime) return false;
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);

  const windowStart = new Date(start);
  windowStart.setHours(EVENING_START_HOUR, 0, 0, 0);
  const windowEnd = new Date(start);
  windowEnd.setHours(EVENING_END_HOUR, 0, 0, 0);

  // Overlap if event starts before window ends AND ends after window starts.
  return start < windowEnd && end > windowStart;
}

/**
 * Reduce calendar events to busy-night flags, one per date, source="calendar".
 */
export function detectBusyNights(events: CalendarEvent[]): BusyNight[] {
  const byDate = new Map<string, string>();
  for (const event of events) {
    if (!overlapsEvening(event)) continue;
    const startStr = event.start?.dateTime ?? event.start?.date;
    if (!startStr) continue;
    const date = localDateKey(new Date(startStr));
    if (!byDate.has(date)) {
      byDate.set(date, event.summary ?? "Evening event");
    }
  }
  return [...byDate.entries()].map(([date, reason]) => ({
    date,
    source: "calendar" as const,
    reason,
  }));
}

/**
 * Merge calendar-detected and manual flags. Manual entries take precedence
 * (PRD §5.2) — if a date is flagged manually, that flag wins.
 */
export function mergeBusyNights(
  detected: BusyNight[],
  manual: BusyNight[],
): BusyNight[] {
  const merged = new Map<string, BusyNight>();
  for (const n of detected) merged.set(n.date, n);
  for (const n of manual) merged.set(n.date, { ...n, source: "manual" });
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch evening events from Google Calendar between two ISO dates using the
 * user's OAuth access token (calendar.readonly scope).
 */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "100");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status}`);
  }
  const data = (await res.json()) as { items?: CalendarEvent[] };
  return data.items ?? [];
}

export const __testing = { overlapsEvening, localDateKey };
