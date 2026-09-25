# Task 4 Report: Manager schedule update with audit events

## RED/GREEN evidence
- RED: Added `parseDateTime` expectations in `src/lib/sla.test.ts` before implementation, including valid past datetime-local input, malformed normalized date (`2026-02-30T12:00`), and required empty input. `npx vitest run src/lib/sla.test.ts` failed with `3 failed | 12 passed`; all failures were `parseDateTime is not a function`.
- GREEN: Implemented public `parseDateTime` in `src/lib/sla.ts`, reusing the existing strict `parseDueDate` parsing and omitting the future-date check. `npx vitest run src/lib/sla.test.ts` passed with `15 passed`.

## Files changed
- `src/lib/sla.ts`: exported `parseDateTime`.
- `src/lib/sla.test.ts`: added focused parser tests.
- `src/app/actions.ts`: added `updateTicketScheduleAction` with session requirement, server-side schedule permission checks, locked status handling, validation, changed-field audit events, and success redirect.
- `src/components/DateTimeField.tsx`: added optional `initialValue`.
- `src/components/TicketScheduleForm.tsx`: added manager schedule edit form.
- `src/app/tickets/[id]/page.tsx`: added plain priority/due metadata, schedule error messages, and gated manager editor rendering.

## Verification
- `npx vitest run src/lib/sla.test.ts` -> exit 0, `15 passed`.
- `npm test` -> exit 0, `8 passed`, `66 passed`.
- `npx tsc --noEmit` -> exit 0.
- `npx eslint src/lib/sla.ts src/lib/sla.test.ts src/app/actions.ts src/components/DateTimeField.tsx src/components/TicketScheduleForm.tsx src/app/tickets/[id]/page.tsx` -> exit 0.

## Self-review
- Confirmed manager edits allow past due dates through `parseDateTime`.
- Confirmed unchanged schedule submissions redirect without Prisma update or audit events.
- Confirmed priority and due-date audit events use current status for both `fromStatus` and `toStatus`, and due notes use `formatWhen`.
- Confirmed ticket detail does not add SLA badges and only renders the editor for authorized non-`ACCEPTED` tickets.

## Concerns
- The shell wrapper printed repeated `Add-Content` diagnostics during some successful command captures, but each required verification command returned exit code 0 and showed passing tool status.
