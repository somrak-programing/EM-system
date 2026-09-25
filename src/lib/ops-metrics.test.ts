import { describe, expect, it } from "vitest";
import type { OpsTicket } from "./ops-metrics";
import { buildOpsMetrics, parseOpsFilters } from "./ops-metrics";

const NOW = new Date("2026-09-25T07:00:00.000Z");

function ticket(overrides: Partial<OpsTicket> & Pick<OpsTicket, "id">): OpsTicket {
  const { id, ...rest } = overrides;

  return {
    id,
    ticketNo: `T-${id}`,
    type: "MACHINE",
    status: "QUEUED",
    priority: "NORMAL",
    subject: `Subject ${id}`,
    dueAt: new Date("2026-09-26T07:00:00.000Z"),
    startedAt: null,
    closedAt: null,
    requesterName: `Requester ${id}`,
    assigneeName: null,
    ...rest,
  };
}

const rows: OpsTicket[] = [
  ticket({ id: "queued-machine" }),
  ticket({
    id: "in-progress-machine",
    status: "IN_PROGRESS",
    priority: "URGENT",
    dueAt: new Date("2026-09-25T08:00:00.000Z"),
    startedAt: new Date("2026-09-25T06:00:00.000Z"),
    assigneeName: "Tech One",
  }),
  ticket({
    id: "pending-electric",
    type: "ELECTRIC",
    status: "PENDING_ACCEPTANCE",
    dueAt: new Date("2026-09-25T12:00:00.000Z"),
    startedAt: new Date("2026-09-25T05:00:00.000Z"),
    assigneeName: "Tech Two",
  }),
  ticket({
    id: "overdue-unclaimed",
    priority: "URGENT",
    dueAt: new Date("2026-09-24T07:00:00.000Z"),
  }),
  ticket({
    id: "old-open-staff",
    type: "STAFF",
    status: "IN_PROGRESS",
    dueAt: new Date("2026-08-01T07:00:00.000Z"),
    startedAt: new Date("2026-08-01T06:00:00.000Z"),
    assigneeName: "Staff Tech",
  }),
  ticket({
    id: "accepted-on-time",
    status: "ACCEPTED",
    dueAt: new Date("2026-09-24T12:00:00.000Z"),
    startedAt: new Date("2026-09-24T08:00:00.000Z"),
    closedAt: new Date("2026-09-24T10:00:00.000Z"),
  }),
  ticket({
    id: "accepted-late",
    type: "IT",
    status: "ACCEPTED",
    priority: "URGENT",
    dueAt: new Date("2026-09-24T09:00:00.000Z"),
    startedAt: new Date("2026-09-24T08:00:00.000Z"),
    closedAt: new Date("2026-09-24T14:00:00.000Z"),
  }),
  ticket({
    id: "outside-window",
    type: "ELECTRIC",
    status: "ACCEPTED",
    dueAt: new Date("2026-08-20T09:00:00.000Z"),
    startedAt: new Date("2026-08-20T08:00:00.000Z"),
    closedAt: new Date("2026-08-20T10:00:00.000Z"),
  }),
];

describe("parseOpsFilters", () => {
  it("keeps valid scalar filters and accepts only 30 as the long window", () => {
    expect(
      parseOpsFilters({
        type: "IT",
        priority: "URGENT",
        sla: "late",
        days: "30",
      }),
    ).toEqual({
      type: "IT",
      priority: "URGENT",
      sla: "late",
      days: 30,
    });
  });

  it("uses the first array value and falls back for invalid parameters", () => {
    expect(
      parseOpsFilters({
        type: ["MACHINE", "IT"],
        priority: ["BAD", "URGENT"],
        sla: ["overdue", "late"],
        days: ["14", "30"],
      }),
    ).toEqual({
      type: "MACHINE",
      priority: "ALL",
      sla: "overdue",
      days: 7,
    });
  });
});

describe("buildOpsMetrics", () => {
  it("builds dashboard KPIs, backlog, MTTR groups and board columns", () => {
    const metrics = buildOpsMetrics(rows, {
      type: "ALL",
      priority: "ALL",
      sla: "ALL",
      days: 7,
    }, NOW);

    expect(metrics.kpis).toEqual({
      queued: 2,
      inProgress: 2,
      overdue: 2,
      mttrHours: 4,
      onTimePercent: 50,
    });
    expect(metrics.backlogByType).toEqual([
      { type: "MACHINE", value: 3 },
      { type: "ELECTRIC", value: 1 },
      { type: "STAFF", value: 1 },
      { type: "IT", value: 0 },
    ]);
    expect(metrics.mttrByType).toEqual([
      { type: "MACHINE", value: 2 },
      { type: "ELECTRIC", value: null },
      { type: "STAFF", value: null },
      { type: "IT", value: 6 },
    ]);
    expect(metrics.board.QUEUED.map((row) => row.id)).toEqual([
      "queued-machine",
      "overdue-unclaimed",
    ]);
    expect(metrics.board.IN_PROGRESS.map((row) => row.id)).toEqual([
      "in-progress-machine",
      "old-open-staff",
    ]);
    expect(metrics.board.PENDING_ACCEPTANCE.map((row) => row.id)).toEqual([
      "pending-electric",
    ]);
  });

  it("applies type and priority filters before every metric and collection", () => {
    const metrics = buildOpsMetrics(rows, {
      type: "IT",
      priority: "URGENT",
      sla: "ALL",
      days: 30,
    }, NOW);

    expect(metrics.kpis).toEqual({
      queued: 0,
      inProgress: 0,
      overdue: 0,
      mttrHours: 6,
      onTimePercent: 0,
    });
    expect(metrics.backlogByType).toEqual([
      { type: "MACHINE", value: 0 },
      { type: "ELECTRIC", value: 0 },
      { type: "STAFF", value: 0 },
      { type: "IT", value: 0 },
    ]);
    expect(metrics.mttrByType).toEqual([
      { type: "MACHINE", value: null },
      { type: "ELECTRIC", value: null },
      { type: "STAFF", value: null },
      { type: "IT", value: 6 },
    ]);
    expect(metrics.board).toEqual({
      QUEUED: [],
      IN_PROGRESS: [],
      PENDING_ACCEPTANCE: [],
    });
  });

  it("applies SLA filters using the derived row state", () => {
    const metrics = buildOpsMetrics(rows, {
      type: "ALL",
      priority: "ALL",
      sla: "overdue",
      days: 30,
    }, NOW);

    expect(metrics.kpis).toEqual({
      queued: 1,
      inProgress: 1,
      overdue: 2,
      mttrHours: null,
      onTimePercent: null,
    });
    expect(metrics.backlogByType).toEqual([
      { type: "MACHINE", value: 1 },
      { type: "ELECTRIC", value: 0 },
      { type: "STAFF", value: 1 },
      { type: "IT", value: 0 },
    ]);
    expect(metrics.mttrByType).toEqual([
      { type: "MACHINE", value: null },
      { type: "ELECTRIC", value: null },
      { type: "STAFF", value: null },
      { type: "IT", value: null },
    ]);
    expect(metrics.board.QUEUED.map((row) => row.id)).toEqual(["overdue-unclaimed"]);
    expect(metrics.board.IN_PROGRESS.map((row) => row.id)).toEqual(["old-open-staff"]);
    expect(metrics.board.PENDING_ACCEPTANCE).toEqual([]);
  });
});

