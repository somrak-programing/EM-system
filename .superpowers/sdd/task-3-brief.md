# Task 3: Persist priority and due date at ticket creation

Work in `C:\dev\BSCB\apps\repair`.

## Files
- Modify `src/app/actions.ts`
- Modify `src/components/TicketForm.tsx`
- Modify `src/components/DateTimeField.tsx`
- Modify `src/components/TransitionForms.tsx`

## Requirements

### Server action

In `createTicketAction`:

- Read `priority`; only `NORMAL` and `URGENT` are valid. Invalid/missing redirects to `/tickets/new?error=priority`.
- Pass `String(formData.get("dueAt") ?? "")` to the existing `validateFutureDueAt` from `src/lib/sla.ts`.
- On validation failure redirect to `/tickets/new?error=${result.error}`.
- Persist `priority` and `dueAt: result.value` in `prisma.ticket.create`.
- Validation must remain server-side even though the form uses required controls.

In `applyTransitionAction`:

- Remove `dueRaw`.
- Remove the COMPLETE-time `dueAt` update. Technician completion must never own or change the deadline.

### Requester form

- Add required priority select with values `NORMAL` («ปกติ») and `URGENT` («เร่งด่วน»).
- Add a required `DateTimeField` named `dueAt`, labelled «กำหนดเสร็จ».
- Quick picks: «พรุ่งนี้» `{ days: 1 }` and «อีก 3 วัน» `{ days: 3 }`. Do not include «วันนี้»: the user explicitly chose to remove it after review showed that minute precision makes a current-minute value immediately fail strict-future validation.
- Add error messages:
  - `priority`: «กรุณาเลือกความเร่งด่วน»
  - `due_required`: «กรุณาเลือกกำหนดเสร็จ»
  - `due_invalid`: «กำหนดเสร็จไม่ถูกต้อง»
  - `due_past`: «กำหนดเสร็จต้องอยู่ในอนาคต»

Extend `DateTimeField` with optional `required?: boolean` and pass it to the native `<input>`. Existing call sites must remain valid.

### Technician completion form

- Remove the due-date field and its import from `TransitionForms.tsx`.
- Keep cause and resolution requirements unchanged.

## Validation

The behavioral helper already has RED/GREEN coverage from Task 1. Do not duplicate its logic. Run:

```powershell
npm test
npx tsc --noEmit
npx eslint src/app/actions.ts src/components/TicketForm.tsx src/components/DateTimeField.tsx src/components/TransitionForms.tsx
```

If implementation exposes a bug in the helper, add a failing test before fixing it. Do not add a chart library, database field, or unrelated cleanup.

## Report

Write `C:\dev\BSCB\apps\repair\.superpowers\sdd\task-3-report.md` with status, changed files, exact test/typecheck/lint results, self-review, and concerns. Explicitly confirm there is only one writer for `dueAt` after this task.

Do not commit.
