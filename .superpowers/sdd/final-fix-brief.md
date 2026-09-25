# Final review fix: clear completion timestamp on rejection

Work in `C:\dev\BSCB\apps\repair`.

## Important correctness fix

The default `REJECT` transition returns a ticket from `PENDING_ACCEPTANCE` to `IN_PROGRESS`. The current action preserves the prior `closedAt`, causing the active ticket to be classified as completed and counted in MTTR/on-time metrics.

Use strict RED→GREEN TDD:

1. Add a pure exported helper in `src/lib/workflow.ts`:

```ts
export function nextClosedAt(
  formKind: FormKind,
  current: Date | null,
  now: Date,
): Date | null;
```

Rules:
- `COMPLETE` => `now`
- `REJECT` => `null`
- `NONE` => `current`

2. Add tests first in `src/lib/workflow.test.ts` for all three branches and observe the expected RED.
3. Use `nextClosedAt(rule.formKind, ticket.closedAt, now)` in `src/app/actions.ts` instead of the current conditional.
4. Keep `startedAt` unchanged on REJECT so MTTR includes the rework interval from the original claim.

## Safe Minor cleanups from final review

Also make these low-risk consistency changes:

- Export one board/open-status constant from `src/lib/ops-metrics.ts` and consume it from `src/app/ops/page.tsx` so the lists cannot drift.
- Export a single `PRIORITY_LABEL` from `src/components/PriorityBadge.tsx` and reuse it in `TicketForm.tsx`, `TicketScheduleForm.tsx`, and `OpsFilters.tsx`.
- Add explicit `type="submit"` to the primary submit buttons in `TicketForm.tsx`, `TicketScheduleForm.tsx`, and `OpsFilters.tsx`.
- Use `PRIORITY_LABEL` in schedule audit notes so timeline notes show Thai labels instead of enum codes.

Do not change:

- JWT-vs-DB dashboard scoping;
- hardcoded `ACCEPTED` freeze;
- pre-existing `/queue` access behavior;
- any out-of-scope maintenance feature.

## Verification

Run sequentially:

```powershell
npx vitest run src/lib/workflow.test.ts
npm test
npx tsc --noEmit
npx eslint src
npm run build
```

Write `C:\dev\BSCB\apps\repair\.superpowers\sdd\final-fix-report.md` with RED/GREEN evidence, changed files, exact results, and concerns. Do not commit.
