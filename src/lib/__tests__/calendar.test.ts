import { describe, expect, it } from "vitest";
import { detectBusyNights, mergeBusyNights } from "../calendar";
import { BusyNight } from "../types";

describe("detectBusyNights", () => {
  it("flags an event overlapping the 5–9pm window", () => {
    const nights = detectBusyNights([
      {
        summary: "Soccer practice",
        start: { dateTime: "2026-06-02T18:00:00-04:00" },
        end: { dateTime: "2026-06-02T20:00:00-04:00" },
      },
    ]);
    expect(nights).toHaveLength(1);
    expect(nights[0].source).toBe("calendar");
    expect(nights[0].reason).toBe("Soccer practice");
  });

  it("ignores a daytime event entirely outside the window", () => {
    const nights = detectBusyNights([
      {
        summary: "Lunch meeting",
        start: { dateTime: "2026-06-02T12:00:00-04:00" },
        end: { dateTime: "2026-06-02T13:00:00-04:00" },
      },
    ]);
    expect(nights).toHaveLength(0);
  });

  it("treats all-day events as busy evenings", () => {
    const nights = detectBusyNights([
      { summary: "Conference", start: { date: "2026-06-03" } },
    ]);
    expect(nights).toHaveLength(1);
  });

  it("collapses multiple evening events on one date to a single flag", () => {
    const nights = detectBusyNights([
      {
        summary: "A",
        start: { dateTime: "2026-06-02T17:30:00-04:00" },
        end: { dateTime: "2026-06-02T18:30:00-04:00" },
      },
      {
        summary: "B",
        start: { dateTime: "2026-06-02T19:00:00-04:00" },
        end: { dateTime: "2026-06-02T20:00:00-04:00" },
      },
    ]);
    expect(nights).toHaveLength(1);
  });
});

describe("mergeBusyNights", () => {
  it("lets manual flags take precedence over calendar ones", () => {
    const detected: BusyNight[] = [
      { date: "2026-06-02", source: "calendar", reason: "Game" },
    ];
    const manual: BusyNight[] = [
      { date: "2026-06-02", source: "manual", reason: "Date night" },
    ];
    const merged = mergeBusyNights(detected, manual);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("manual");
    expect(merged[0].reason).toBe("Date night");
  });

  it("unions distinct dates and sorts them", () => {
    const merged = mergeBusyNights(
      [{ date: "2026-06-05", source: "calendar" }],
      [{ date: "2026-06-02", source: "manual" }],
    );
    expect(merged.map((m) => m.date)).toEqual(["2026-06-02", "2026-06-05"]);
  });
});
