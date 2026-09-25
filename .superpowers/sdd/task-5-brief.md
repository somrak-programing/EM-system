# Task 5: Shared timing badges across ticket surfaces

Work in `C:\dev\BSCB\apps\repair`.

## Files
- Create `src/components/PriorityBadge.tsx`
- Create `src/components/SlaBadge.tsx`
- Create `src/components/TicketTiming.tsx`
- Modify `src/app/tickets/[id]/page.tsx`
- Modify `src/app/tickets/page.tsx`
- Modify `src/app/queue/page.tsx`

## Interfaces

```ts
export function PriorityBadge({ priority }: { priority: TicketPriority }): JSX.Element;
export function SlaBadge({ state }: { state: SlaState }): JSX.Element;

export function TicketTiming(props: {
  priority: TicketPriority;
  dueAt: Date | null;
  closedAt: Date | null;
  now?: Date;
  compact?: boolean;
}): JSX.Element;
```

## Behavior and presentation

- Use `SLA_LABEL` and `getSlaState` from `src/lib/sla.ts`; do not duplicate clock logic or labels.
- Badge tones:
  - NORMAL: slate
  - URGENT: red
  - none: slate
  - on_track and on_time: green/teal
  - at_risk: amber
  - overdue and late: red
- Priority labels are «ปกติ» and «เร่งด่วน».
- `TicketTiming` shows priority badge, SLA badge, and «กำหนด: <formatWhen(dueAt)>».
- `compact` uses a wrapping inline layout suitable for list rows and cards; normal mode may use a small metadata block.
- Components remain server-compatible: do not add `"use client"` or time-based effects.

## Surface integration

- Ticket detail: replace/augment the raw priority/due metadata from Task 4 with one full `TicketTiming`. Do not display duplicate values.
- Ticket list: add columns «ความเร่งด่วน / SLA» and «กำหนดเสร็จ», or one combined column if it remains readable. Use compact timing.
- Queue, both “คิวงานใหม่” and “งานของฉัน”: show compact timing with due date.
- Preserve existing status badges, links, claim action, and responsive behavior.
- Compute one `const now = new Date()` per page render and pass it to every row/card so all SLA badges use the same instant.

## Verification

No new business logic is introduced; Task 1 already tests SLA logic. Run:

```powershell
npm test
npx tsc --noEmit
npx eslint src/components/PriorityBadge.tsx src/components/SlaBadge.tsx src/components/TicketTiming.tsx src/app/tickets src/app/queue/page.tsx
```

Inspect for duplicate priority/due output and horizontal overflow.

## Report

Write `C:\dev\BSCB\apps\repair\.superpowers\sdd\task-5-report.md` with status, changed files, exact verification, self-review, and concerns. Do not commit or make unrelated changes.
