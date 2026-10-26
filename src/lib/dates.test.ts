import { describe, expect, it } from "vitest";
import {
  formatShortDate,
  fromDateKey,
  getCalendarCells,
  shiftDate,
  toDateKey,
} from "./dates";

describe("local date helpers", () => {
  it("round-trips date keys without converting to the previous UTC day", () => {
    const key = "2026-10-26";
    expect(toDateKey(fromDateKey(key))).toBe(key);
  });

  it("moves across month boundaries", () => {
    expect(shiftDate("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds complete Monday-first calendar weeks", () => {
    const cells = getCalendarCells(fromDateKey("2026-10-01"));
    expect(cells.length % 7).toBe(0);
    expect(cells[0].date.getDay()).toBe(1);
    expect(cells.some((cell) => cell.dateKey === "2026-10-31")).toBe(true);
  });

  it("formats Chinese dates", () => {
    expect(formatShortDate("2026-10-26")).toMatch(/10月26日/);
  });
});
