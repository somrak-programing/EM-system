# Task 1 Implementation Report: SLA clock and metric primitives

## status

`DONE`

## files changed

- `src/lib/sla.test.ts` (created)
- `src/lib/sla.ts` (created)

## RED command and observed failure

Command:

```powershell
npx vitest run src/lib/sla.test.ts
```

Observed failure (exit code 1):

```
 FAIL  src/lib/sla.test.ts [ src/lib/sla.test.ts ]
Error: Failed to load url ./sla (resolved id: ./sla) in C:/dev/BSCB/apps/repair/src/lib/sla.test.ts. Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

## GREEN commands and exact pass counts

Command:

```powershell
npx vitest run src/lib/sla.test.ts
```

Result:

```
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

Command:

```powershell
npm test
```

Result:

```
 Test Files  6 passed (6)
      Tests  37 passed (37)
```

## self-review notes

- Followed RED→GREEN TDD: tests were authored before `sla.ts`, RED was recorded, then minimal production code was added to pass.
- All SLA tests use fixed UTC instants; open-ticket scenarios pass an explicit `now` argument.
- `getSlaState` uses a 4 wall-clock hour at-risk window (`AT_RISK_MS`); open tickets with `now === dueAt` stay `at_risk`, and overdue requires `now > dueAt`.
- Closed tickets compare `closedAt` to `dueAt` only; `now` does not affect closed outcomes. No `startedAt` input is used for SLA state.
- `validateFutureDueAt` trims input, rejects empty (`due_required`), unparseable (`due_invalid`), and non-future including equal-to-now (`due_past`). Parses `datetime-local` strings in local time and ISO strings via `Date`.
- `calculateMttrHours` averages `(closedAt - startedAt)` in hours, skips incomplete rows and negative durations, accepts zero duration, returns `null` when no valid rows remain.
- `calculateOnTimePercent` considers only rows with both timestamps; returns percentage 0–100 or `null` when no eligible rows.
- No Prisma or other framework imports; metric reducers do not call `Date.now()` internally (only optional/default `now` on entry functions).
- `SLA_LABEL` uses the brief’s Thai strings verbatim.

## concerns

- `parseDueDate` is module-private. Task 4’s plan mentions a exported `parseDateTime` helper for manager schedule edits that may allow past dates; that API is not part of Task 1 and may require a small follow-up export or shared parser.
- The datetime-local acceptance test depends on the runner’s local timezone (it asserts “future relative to `now`” rather than a fixed instant). ISO-Z tests are fully deterministic; consider tightening if CI runs in multiple zones.

## Review fixes

Addressed code-review findings: strict datetime-local component round-trip validation in `parseDueDate`, and a timezone-independent datetime-local acceptance test.

### RED

Command:

```powershell
npx vitest run src/lib/sla.test.ts
```

Observed failure (exit code 1):

```
 FAIL  src/lib/sla.test.ts > validateFutureDueAt > rejects malformed datetime-local components that Date would normalize
AssertionError: expected { ok: true, …(1) } to deeply equal { ok: false, error: 'due_invalid' }

 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
```

(`2026-13-10T12:00` was accepted as a future date after Date normalization to January 2027.)

### GREEN

Command:

```powershell
npx vitest run src/lib/sla.test.ts
```

Result:

```
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

Command:

```powershell
npm test
```

Result:

```
 Test Files  6 passed (6)
      Tests  38 passed (38)
```
