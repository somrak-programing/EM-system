# Task 4: Manager schedule update with audit events

Work in `C:\dev\BSCB\apps\repair`.

## Files
- Modify `src/lib/sla.ts`
- Modify `src/lib/sla.test.ts`
- Modify `src/app/actions.ts`
- Modify `src/components/DateTimeField.tsx`
- Create `src/components/TicketScheduleForm.tsx`
- Modify `src/app/tickets/[id]/page.tsx`

## Required behavior

### Date parsing

Add a public pure helper for manager edits:

```ts
export function parseDateTime(
  raw: string,
): { ok: true; value: Date } | { ok: false; error: "due_required" | "due_invalid" };
```

It must reuse the strict round-trip component validation already used by `validateFutureDueAt`, but it permits valid past dates. Develop it RED→GREEN in `sla.test.ts`.

### Server action

Export `updateTicketScheduleAction(formData: FormData)` from `src/app/actions.ts`.

1. Require a session; unauthenticated redirects to `/login`.
2. Read `ticketId`; missing/not found redirects to `/tickets`.
3. Enforce `canManageTicketSchedule` from `ops-access.ts` on the server. Failure redirects to `/tickets/{id}?error=schedule_forbidden`.
4. If `ticket.status === "ACCEPTED"`, redirect with `schedule_locked`.
5. Only `NORMAL` or `URGENT` priority is valid.
6. Parse `dueAt` with `parseDateTime`. Invalid priority/date redirects with `schedule_invalid`.
7. A valid past due date is allowed for a manager edit.
8. Create audit records only for fields that changed:
   - `PRIORITY_CHANGE`, note `ความเร่งด่วน: <old> → <new>`
   - `DUE_CHANGE`, note `กำหนดเสร็จ: <formatted old> → <formatted new>`
   - each event uses current status for both `fromStatus` and `toStatus`.
9. Perform one Prisma update for changed values and nested events. If neither value changed, redirect without writing an event.
10. Redirect back to `/tickets/{id}` after success.

Use the existing `formatWhen` for due-date event notes.

### DateTimeField initial value

Extend `DateTimeField` with optional `initialValue?: string`. Initialize state from it (`useState(initialValue)`) so a manager can edit the existing value. Existing call sites without it remain unchanged.

### Manager editor

Create `TicketScheduleForm` that receives:

```ts
{
  ticketId: string;
  priority: TicketPriority;
  dueAt: Date | null;
}
```

Render a form posting to `updateTicketScheduleAction`, a priority select, and required `DateTimeField` with `initialValue={dueAt ? toDateTimeLocalValue(dueAt) : ""}`. Use only «พรุ่งนี้» and «อีก 3 วัน» quick picks; do not restore «วันนี้». Button label: «บันทึกกำหนดงาน».

### Ticket detail

- Everyone sees current priority and due date as plain values in the detail metadata. SLA badges are Task 5, so do not build a duplicate badge here.
- Render the manager editor only when `canManageTicketSchedule(actor, ticket)` is true and status is not `ACCEPTED`.
- Add errors:
  - `schedule_forbidden`: «คุณไม่มีสิทธิ์แก้กำหนดงานนี้»
  - `schedule_locked`: «ใบงานที่ยอมรับแล้วแก้กำหนดไม่ได้»
  - `schedule_invalid`: «กรุณาตรวจสอบความเร่งด่วนและกำหนดเสร็จ»
- Existing timeline must display the new event notes without special casing.

## Mandatory TDD and verification

1. Write failing `parseDateTime` tests first, including a valid past value and malformed normalized date.
2. Run targeted test and observe expected RED.
3. Implement minimal helper.
4. Integrate action/UI.
5. Run:

```powershell
npx vitest run src/lib/sla.test.ts
npm test
npx tsc --noEmit
npx eslint src/lib/sla.ts src/lib/sla.test.ts src/app/actions.ts src/components/DateTimeField.tsx src/components/TicketScheduleForm.tsx src/app/tickets/[id]/page.tsx
```

## Report

Write `C:\dev\BSCB\apps\repair\.superpowers\sdd\task-4-report.md` with RED/GREEN evidence, files changed, exact checks, self-review, and concerns. Do not commit or make unrelated changes.
