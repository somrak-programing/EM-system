import { describe, expect, it } from "vitest";
import { shiftDateTime, toDateTimeLocalValue } from "./datetime";

describe("toDateTimeLocalValue", () => {
  it("formats a local date for a datetime-local input", () => {
    const value = toDateTimeLocalValue(new Date(2026, 8, 10, 9, 5));

    expect(value).toBe("2026-09-10T09:05");
  });

  it("pads single digit months, days and hours", () => {
    const value = toDateTimeLocalValue(new Date(2026, 0, 2, 3, 4));

    expect(value).toBe("2026-01-02T03:04");
  });
});

describe("shiftDateTime", () => {
  const base = new Date(2026, 8, 10, 12, 0);

  it("moves back by hours", () => {
    expect(toDateTimeLocalValue(shiftDateTime(base, { hours: -1 }))).toBe("2026-09-10T11:00");
  });

  it("moves back by days", () => {
    expect(toDateTimeLocalValue(shiftDateTime(base, { days: -1 }))).toBe("2026-09-09T12:00");
  });

  it("moves forward across a month boundary", () => {
    const endOfMonth = new Date(2026, 8, 30, 8, 30);

    expect(toDateTimeLocalValue(shiftDateTime(endOfMonth, { days: 3 }))).toBe("2026-10-03T08:30");
  });

  it("leaves the original date untouched", () => {
    shiftDateTime(base, { days: -5 });

    expect(toDateTimeLocalValue(base)).toBe("2026-09-10T12:00");
  });
});
