# Final review fix report

Status: **DONE (with one environment concern on the in-place build)**. Nothing committed (the folder is not a git repository).

## Important fix: clear `closedAt` on REJECT

### RED
Added a `nextClosedAt` describe block to `src/lib/workflow.test.ts` with three tests, one per branch (`COMPLETE` → `now`, `REJECT` → `null`, `NONE` → `current`), each also covering a `null` current value. This was done before any production code.

`npx vitest run src/lib/workflow.test.ts` → exit 1:

```
FAIL src/lib/workflow.test.ts > nextClosedAt > ... TypeError: nextClosedAt is not a function
Test Files  1 failed (1)
     Tests  3 failed | 6 passed (9)
```

This failed for the expected reason: the helper did not exist yet.

### GREEN
- Added the pure exported `nextClosedAt(formKind, current, now)` to `src/lib/workflow.ts`.
- `npx vitest run src/lib/workflow.test.ts` → exit 0, `Tests 9 passed (9)`.
- Wired it into `applyTransitionAction` in `src/app/actions.ts`: `closedAt: nextClosedAt(rule.formKind, ticket.closedAt, now)`.
- `startedAt` is unchanged (`rule.assignOnTake ? now : ticket.startedAt`), so REJECT keeps the original claim time and MTTR includes the rework interval.

## Safe Minor cleanups
- `src/lib/ops-metrics.ts`: exported `BoardStatus` and `BOARD_STATUSES`. `src/app/ops/page.tsx` removed its local `OPEN_STATUSES` and queries with `BOARD_STATUSES`.
- `src/components/PriorityBadge.tsx`: `PRIORITY_LABEL` is now exported. It is reused in:
  - `TicketForm.tsx` and `TicketScheduleForm.tsx` for the option labels;
  - `OpsFilters.tsx`, where `PRIORITY_OPTIONS` is replaced by a `PRIORITIES` list plus `PRIORITY_LABEL`.
- `TicketForm.tsx`, `TicketScheduleForm.tsx` and `OpsFilters.tsx`: the primary submit buttons now have `type="submit"`.
- `src/app/actions.ts`: the `PRIORITY_CHANGE` audit note now reads `ความเร่งด่วน: ${PRIORITY_LABEL[old]} → ${PRIORITY_LABEL[new]}`, so it shows Thai labels instead of enum codes.

Not touched (per the brief): JWT-vs-DB dashboard scoping, the hardcoded `ACCEPTED` freeze, `/queue` access behavior, and any out-of-scope features.

## Changed files
- `src/lib/workflow.ts`
- `src/lib/workflow.test.ts`
- `src/app/actions.ts`
- `src/lib/ops-metrics.ts`
- `src/app/ops/page.tsx`
- `src/components/PriorityBadge.tsx`
- `src/components/TicketForm.tsx`
- `src/components/TicketScheduleForm.tsx`
- `src/components/OpsFilters.tsx`

## Verification (run sequentially)
| Command | Result |
|---|---|
| `npx vitest run src/lib/workflow.test.ts` | exit 0 — 9/9 passed |
| `npm test` | exit 0 — 9 files, 74/74 passed |
| `npx tsc --noEmit` | exit 0, no output |
| `npx eslint src` | exit 0, no output |
| `npm run build` (in place) | **exit 1** — compiled OK, then failed in "Collecting page data" (`PageNotFoundError: /tickets/new`, `Cannot find module './vendor-chunks/bcryptjs.js'`) |
| `npm run build` (isolated copy, same sources, shared `node_modules`) | **exit 0** — compiled, type/lint check OK, 11/11 pages generated |

Why the in-place build failed: a `next dev -p 3001` server (PIDs 46016 and 13996) is running from this app directory and writing to the same `.next` folder. The dev server's chunks collided with the production build's. This is an environment conflict, not a code error: compile, type checking and linting all passed in place. To confirm, I copied the app without `.next`, `node_modules` and `.superpowers` into `%TEMP%\repair-build-verify`, linked in the real `node_modules`, and the build passed there. The temp copy has been deleted, and I did not stop the user's dev server.

## Concerns
1. The failed in-place `next build` may have left `.next` in a mixed state for the running dev server on port 3001. If pages show chunk or module errors, restart it. Deleting `.next` first is the safest option. To re-run the build gate in place, stop the dev server before `npm run build`.
2. No test covers `applyTransitionAction`'s REJECT path end to end. The fix is covered by the pure helper's tests plus a one-line change at the call site. `actions.test.ts` passes unchanged.
3. Existing `PRIORITY_CHANGE` timeline entries still contain enum codes (`NORMAL → URGENT`). Only new entries use Thai labels, and there is no backfill.
4. Tickets that were already rejected before this fix still have a stale `closedAt` in the database, so they are still counted as completed in MTTR and on-time metrics until they are completed again. Clearing them needs a one-off data fix, which is outside this brief.
