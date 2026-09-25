# Task 6: Dashboard aggregation and filters

Work in `C:\dev\BSCB\apps\repair`.

## Files
- Create `src/lib/ops-metrics.ts`
- Create `src/lib/ops-metrics.test.ts`

## Required types

```ts
export type OpsFilters = {
  type: TicketType | "ALL";
  priority: TicketPriority | "ALL";
  sla: SlaState | "ALL";
  days: 7 | 30;
};

export type OpsTicket = {
  id: string;
  ticketNo: string;
  type: TicketType;
  status: string;
  priority: TicketPriority;
  subject: string;
  dueAt: Date | null;
  startedAt: Date | null;
  closedAt: Date | null;
  requesterName: string;
  assigneeName: string | null;
};

export function parseOpsFilters(
  params: Record<string, string | string[] | undefined>,
): OpsFilters;

export function buildOpsMetrics(
  rows: OpsTicket[],
  filters: OpsFilters,
  now?: Date,
): {
  kpis: {
    queued: number;
    inProgress: number;
    overdue: number;
    mttrHours: number | null;
    onTimePercent: number | null;
  };
  backlogByType: Array<{ type: TicketType; value: number }>;
  mttrByType: Array<{ type: TicketType; value: number | null }>;
  board: {
    QUEUED: OpsTicket[];
    IN_PROGRESS: OpsTicket[];
    PENDING_ACCEPTANCE: OpsTicket[];
  };
};
```

## Filter rules

- Valid ticket types: MACHINE, ELECTRIC, STAFF, IT; otherwise `ALL`.
- Valid priorities: NORMAL, URGENT; otherwise `ALL`.
- Valid SLA: all six `SlaState` values; otherwise `ALL`.
- `days` is 30 only when raw value is exactly `"30"`; otherwise 7.
- If a query value is an array, use its first value.
- Type, priority, and SLA filters apply before every metric and collection.

## Aggregation rules

- Derive SLA exactly once per row with `getSlaState`.
- Current open board statuses are exactly `QUEUED`, `IN_PROGRESS`, `PENDING_ACCEPTANCE`.
- `queued` counts QUEUED; `inProgress` counts IN_PROGRESS.
- `overdue` counts current open rows whose derived SLA is `overdue`, including unclaimed tickets.
- `backlogByType` counts all three current open statuses.
- The time window is `[now - days, now]`, based on `closedAt`; it affects only MTTR, on-time percent, and MTTR-by-type.
- MTTR uses `calculateMttrHours`; on-time percent uses `calculateOnTimePercent`.
- Open tickets older than 30 days remain on the board and in backlog.
- Return all four ticket types in enum order MACHINE, ELECTRIC, STAFF, IT, including zero backlog and null MTTR groups.
- Preserve board row input order; the page query will determine ordering.

## Mandatory TDD

Write tests first and observe the missing-module RED. Fixture coverage must include:

- each board status;
- one accepted on-time and one accepted-late ticket;
- overdue unclaimed ticket;
- another ticket type;
- an open ticket older than 30 days;
- a completed ticket outside the selected window;
- invalid and array query parameters;
- type, priority, and SLA filters.

Run:

```powershell
npx vitest run src/lib/ops-metrics.test.ts
npm test
npx tsc --noEmit
npx eslint src/lib/ops-metrics.ts src/lib/ops-metrics.test.ts
```

## Report

Write `C:\dev\BSCB\apps\repair\.superpowers\sdd\task-6-report.md` with RED/GREEN evidence, exact test counts/checks, files, self-review, and concerns. Do not commit or edit unrelated files.
