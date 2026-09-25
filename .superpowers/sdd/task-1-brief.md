# Task 1: SLA clock and metric primitives

Work in `C:\dev\BSCB\apps\repair`.

## Files
- Create `src/lib/sla.ts`
- Create `src/lib/sla.test.ts`

## Required interfaces

```ts
export type SlaState =
  | "none"
  | "on_track"
  | "at_risk"
  | "overdue"
  | "on_time"
  | "late";

export const SLA_LABEL: Record<SlaState, string>;

export function getSlaState(
  input: { dueAt: Date | null; closedAt: Date | null },
  now?: Date,
): SlaState;

export function validateFutureDueAt(
  raw: string,
  now?: Date,
):
  | { ok: true; value: Date }
  | {
      ok: false;
      error: "due_required" | "due_invalid" | "due_past";
    };

export function calculateMttrHours(
  rows: Array<{ startedAt: Date | null; closedAt: Date | null }>,
): number | null;

export function calculateOnTimePercent(
  rows: Array<{ dueAt: Date | null; closedAt: Date | null }>,
): number | null;
```

## Behavior

- SLA labels: none=ไม่มีกำหนด, on_track=ตามแผน, at_risk=ใกล้ครบ, overdue=เลยกำหนด, on_time=ทัน, late=ช้า.
- At-risk threshold is exactly 4 wall-clock hours.
- No due date => `none`.
- A closed ticket is `on_time` when `closedAt <= dueAt`, otherwise `late`.
- An open ticket is `overdue` only when `now > dueAt`; equality remains `at_risk`.
- Ticket claim time does not affect SLA state.
- Future due-date validation rejects empty, invalid, equal-to-now, and past values. Equal-to-now/past return `due_past`.
- MTTR averages `closedAt - startedAt` in hours. Ignore rows missing either timestamp and malformed negative durations. Zero duration is valid. Return null when no valid row remains.
- On-time percent ignores rows without both `dueAt` and `closedAt`; return null when no eligible row remains.

## Mandatory TDD sequence

1. Create the test file first.
2. Run `npx vitest run src/lib/sla.test.ts`; record the expected RED caused by the missing module.
3. Implement only enough production code to pass.
4. Run the targeted test and `npm test`.
5. Self-review for determinism and unnecessary imports.

Tests must use fixed UTC dates. Cover all six states, an unclaimed overdue ticket, all due-date validation outcomes, MTTR valid/ignored rows, and on-time percentage.

## Report

Write the full report to `C:\dev\BSCB\apps\repair\.superpowers\sdd\task-1-report.md` with:
- status (`DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`);
- files changed;
- RED command and observed failure;
- GREEN commands and exact pass counts;
- self-review notes;
- concerns.

Do not commit: this workspace has no Git repository.
