import { describe, expect, it } from "vitest";
import {
  SLA_LABEL,
  calculateMttrHours,
  calculateOnTimePercent,
  getSlaState,
  parseDateTime,
  validateFutureDueAt,
} from "./sla";

describe("SLA_LABEL", () => {
  it("maps every SLA state to the Thai label", () => {
    expect(SLA_LABEL.none).toBe("ไม่มีกำหนด");
    expect(SLA_LABEL.on_track).toBe("ตามแผน");
    expect(SLA_LABEL.at_risk).toBe("ใกล้ครบ");
    expect(SLA_LABEL.overdue).toBe("เลยกำหนด");
    expect(SLA_LABEL.on_time).toBe("ทัน");
    expect(SLA_LABEL.late).toBe("ช้า");
  });
});

describe("getSlaState", () => {
  const now = new Date("2026-09-25T06:00:00.000Z");

  it("covers all six SLA states", () => {
    expect(getSlaState({ dueAt: null, closedAt: null }, now)).toBe("none");
    expect(
      getSlaState(
        {
          dueAt: new Date("2026-09-25T12:00:01.000Z"),
          closedAt: null,
        },
        now,
      ),
    ).toBe("on_track");
    expect(
      getSlaState(
        {
          dueAt: new Date("2026-09-25T10:00:00.000Z"),
          closedAt: null,
        },
        now,
      ),
    ).toBe("at_risk");
    expect(
      getSlaState(
        {
          dueAt: new Date("2026-09-25T05:59:59.000Z"),
          closedAt: null,
        },
        now,
      ),
    ).toBe("overdue");
    expect(
      getSlaState(
        {
          dueAt: new Date("2026-09-25T10:00:00.000Z"),
          closedAt: new Date("2026-09-25T09:00:00.000Z"),
        },
        now,
      ),
    ).toBe("on_time");
    expect(
      getSlaState(
        {
          dueAt: new Date("2026-09-25T10:00:00.000Z"),
          closedAt: new Date("2026-09-25T10:00:01.000Z"),
        },
        now,
      ),
    ).toBe("late");
  });

  it("treats due time equal to now as at_risk, not overdue", () => {
    expect(
      getSlaState(
        {
          dueAt: new Date("2026-09-25T06:00:00.000Z"),
          closedAt: null,
        },
        now,
      ),
    ).toBe("at_risk");
  });

  it("marks an unclaimed open ticket overdue when past due", () => {
    expect(
      getSlaState(
        {
          dueAt: new Date("2026-09-25T05:00:00.000Z"),
          closedAt: null,
        },
        now,
      ),
    ).toBe("overdue");
  });
});

describe("validateFutureDueAt", () => {
  const now = new Date("2026-09-25T06:00:00.000Z");

  it("rejects missing, invalid, equal-to-now, past, and accepts future values", () => {
    expect(validateFutureDueAt("", now)).toEqual({ ok: false, error: "due_required" });
    expect(validateFutureDueAt("   ", now)).toEqual({ ok: false, error: "due_required" });
    expect(validateFutureDueAt("not-a-date", now)).toEqual({ ok: false, error: "due_invalid" });
    expect(validateFutureDueAt("2026-09-25T06:00:00.000Z", now)).toEqual({
      ok: false,
      error: "due_past",
    });
    expect(validateFutureDueAt("2026-09-25T05:00:00.000Z", now)).toEqual({
      ok: false,
      error: "due_past",
    });
    expect(validateFutureDueAt("2026-09-25T12:00:00.000Z", now)).toEqual({
      ok: true,
      value: new Date("2026-09-25T12:00:00.000Z"),
    });
  });

  it("rejects malformed datetime-local components that Date would normalize", () => {
    expect(validateFutureDueAt("2026-13-10T12:00", now)).toEqual({
      ok: false,
      error: "due_invalid",
    });
    expect(validateFutureDueAt("2026-02-30T12:00", now)).toEqual({
      ok: false,
      error: "due_invalid",
    });
    expect(validateFutureDueAt("2026-09-25T12:99", now)).toEqual({
      ok: false,
      error: "due_invalid",
    });
  });

  it("accepts datetime-local values strictly in the future using local calendar components", () => {
    const localNow = new Date(2026, 8, 25, 13, 0, 0, 0);
    expect(validateFutureDueAt("2026-09-25T15:00", localNow)).toEqual({
      ok: true,
      value: new Date(2026, 8, 25, 15, 0, 0, 0),
    });
  });
});

describe("parseDateTime", () => {
  it("accepts valid past datetime-local values", () => {
    expect(parseDateTime("2026-09-24T15:30")).toEqual({
      ok: true,
      value: new Date(2026, 8, 24, 15, 30, 0, 0),
    });
  });

  it("rejects malformed datetime-local values that Date would normalize", () => {
    expect(parseDateTime("2026-02-30T12:00")).toEqual({
      ok: false,
      error: "due_invalid",
    });
  });

  it("requires a datetime value", () => {
    expect(parseDateTime("   ")).toEqual({ ok: false, error: "due_required" });
  });
});

describe("calculateMttrHours", () => {
  it("averages valid closed durations and ignores invalid rows", () => {
    const twoHours = 2 * 60 * 60 * 1000;
    const fourHours = 4 * 60 * 60 * 1000;
    const start = new Date("2026-09-25T00:00:00.000Z");

    expect(
      calculateMttrHours([
        {
          startedAt: start,
          closedAt: new Date(start.getTime() + twoHours),
        },
        {
          startedAt: start,
          closedAt: new Date(start.getTime() + fourHours),
        },
        { startedAt: null, closedAt: new Date("2026-09-25T08:00:00.000Z") },
        { startedAt: start, closedAt: null },
        {
          startedAt: new Date("2026-09-25T10:00:00.000Z"),
          closedAt: new Date("2026-09-25T08:00:00.000Z"),
        },
      ]),
    ).toBe(3);
  });

  it("counts zero-duration closures as valid", () => {
    const at = new Date("2026-09-25T08:00:00.000Z");
    expect(calculateMttrHours([{ startedAt: at, closedAt: at }])).toBe(0);
  });

  it("returns null when no valid row remains", () => {
    expect(calculateMttrHours([])).toBeNull();
    expect(calculateMttrHours([{ startedAt: null, closedAt: null }])).toBeNull();
  });
});

describe("calculateOnTimePercent", () => {
  it("computes on-time percentage from eligible closed rows only", () => {
    const due = new Date("2026-09-25T10:00:00.000Z");
    expect(
      calculateOnTimePercent([
        { dueAt: due, closedAt: new Date("2026-09-25T09:00:00.000Z") },
        { dueAt: due, closedAt: new Date("2026-09-25T09:30:00.000Z") },
        { dueAt: due, closedAt: new Date("2026-09-25T10:30:00.000Z") },
        { dueAt: null, closedAt: new Date("2026-09-25T08:00:00.000Z") },
      ]),
    ).toBeCloseTo(66.66666666666667, 10);
  });

  it("returns null when no eligible row remains", () => {
    expect(calculateOnTimePercent([])).toBeNull();
    expect(
      calculateOnTimePercent([{ dueAt: null, closedAt: new Date("2026-09-25T08:00:00.000Z") }]),
    ).toBeNull();
  });
});
