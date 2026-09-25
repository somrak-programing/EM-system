# Task 3 Report

## Status

Implemented. Ticket creation now validates and persists `priority` and a future `dueAt` server-side, and technician completion no longer reads or writes the deadline.

## Changed Files

- `src/app/actions.ts`
- `src/app/actions.test.ts`
- `src/components/TicketForm.tsx`
- `src/components/DateTimeField.tsx`
- `src/components/TransitionForms.tsx`

## Verification

- RED check: `npm test -- src/app/actions.test.ts` failed before implementation with missing priority/dueAt persistence and completion dueAt ownership failures.
- `npm test`: exit 0. Vitest reported 8 passed test files and 63 passed tests.
- `npx tsc --noEmit`: exit 0. No TypeScript diagnostics were reported.
- `npx eslint src/app/actions.ts src/components/TicketForm.tsx src/components/DateTimeField.tsx src/components/TransitionForms.tsx`: exit 0. No ESLint diagnostics were reported.

Note: the shell wrapper emitted repeated PowerShell `Add-Content` stream errors during verification output capture. The project commands above still returned exit code 0.

## Self-Review

- `createTicketAction` accepts only `NORMAL` and `URGENT`, redirects invalid/missing priority to `/tickets/new?error=priority`, validates `dueAt` via `validateFutureDueAt(String(formData.get("dueAt") ?? ""))`, redirects helper failures with the helper error code, and persists `priority` plus `dueAt: result.value`.
- `applyTransitionAction` no longer reads `dueAt` and no longer includes `dueAt` in `prisma.ticket.update`.
- Requester form includes the required priority select, required due date field, required error messages, and the requested quick picks.
- `DateTimeField` gained an optional `required` prop while preserving existing call sites.
- Completion form retains cause/resolution requirements and no longer imports or renders a due-date field.
- Confirmed there is only one production writer for `dueAt` after this task: `createTicketAction` in `src/app/actions.ts`.

## Concerns

- The requested `วันนี้` quick pick uses `{}` exactly as specified, which sets the current local minute. Because server validation requires a strictly future due date, a user submitting after that minute may receive `due_past`.
- Verification output was noisy because of the shell wrapper `Add-Content` capture errors, though command exit codes and project diagnostics were clean.

## Review Fix

Removed the `วันนี้` quick pick from the requester due-date field in `src/components/TicketForm.tsx`; the field now offers only `พรุ่งนี้` and `อีก 3 วัน`. Strict-future server validation remains unchanged.

Verification after the review fix:

- `npm test`: exit 0. Vitest reported 8 passed test files and 63 passed tests.
- `npx tsc --noEmit`: exit 0. No TypeScript diagnostics were reported.
- `npx eslint src/app/actions.ts src/components/TicketForm.tsx src/components/DateTimeField.tsx src/components/TransitionForms.tsx`: exit 0. No ESLint diagnostics were reported.

The PowerShell shell wrapper again emitted repeated `Add-Content` stream errors while capturing output; the project commands above still returned exit code 0.
