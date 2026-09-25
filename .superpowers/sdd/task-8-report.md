# Task 8 — Final verification and regression review — Report

**Working dir:** `C:\dev\BSCB\apps\repair`
**Date:** 2026-09-25
**Final status:** `DONE_WITH_CONCERNS` (all automated gates + static acceptance pass; browser acceptance not executed because no app server is running — see Blockers)

---

## 1. Automated gate evidence

Run sequentially, not concurrently. Exact results:

| Gate | Command | Result | Exit code |
|------|---------|--------|-----------|
| Unit tests | `npm test` (vitest run) | **9 test files passed, 71 tests passed (0 failed)**, duration ~2.25s | `0` |
| Type check | `npx tsc --noEmit` | No errors, clean | `0` |
| Lint | `npx eslint src` | No errors, no warnings (empty output) | `0` |
| Build | `npm run build` (next build) | Compiled successfully in ~4.2s; 11/11 static pages generated; all routes built incl. `/ops` | `0` |

### Test breakdown (71 tests across 9 files)
```
 src/lib/photo-picker.test.ts   (4 tests)
 src/lib/ops-access.test.ts     (22 tests)
 src/lib/workflow.test.ts       (6 tests)
 src/lib/attachments.test.ts    (7 tests)
 src/lib/ops-metrics.test.ts    (5 tests)
 src/lib/sla.test.ts            (15 tests)
 src/app/actions.test.ts        (3 tests)
 src/lib/datetime.test.ts       (6 tests)
 src/lib/brand.test.ts          (3 tests)
 Test Files  9 passed (9)
      Tests  71 passed (71)
```

### Build route table (excerpt)
```
Route (app)
ƒ /                        ƒ /ops
ƒ /admin/flows            ƒ /queue
ƒ /admin/flows/[type]     ƒ /tickets
ƒ /api/attachments/[id]   ƒ /tickets/[id]
ƒ /login                  ƒ /tickets/new
ƒ Middleware (34 kB)
✓ Generating static pages (11/11)
```

> Note: benign non-error notices only — Vite CJS deprecation warning (vitest) and Next serverActions experiment notice. Neither affects exit codes.

---

## 2. Static acceptance checklist

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Requester creation requires + persists NORMAL/URGENT plus a future due date | ✅ PASS | `createTicketAction` validates `priority ∈ {NORMAL,URGENT}` (redirect `error=priority`) and `validateFutureDueAt(dueAt)` (rejects `due_required`/`due_invalid`/`due_past`); persists `priority` and `dueAt` on `prisma.ticket.create`. UI: `TicketForm` `priority` select `required` with disabled empty placeholder; `DateTimeField name="dueAt" required`. (`src/app/actions.ts` L71–79, L115/L129; `src/lib/sla.ts` `validateFutureDueAt`; `src/components/TicketForm.tsx`) |
| 2 | COMPLETE does not render or write due date | ✅ PASS | `TransitionForms` COMPLETE branch renders only `cause` + `resolution` (no due field). `applyTransitionAction` COMPLETE path writes `cause`/`resolution`/`closedAt` only; never sets `dueAt`. (`src/components/TransitionForms.tsx` L22–34; `src/app/actions.ts` L186–213) |
| 3 | Manager edit is server-authorized, section-scoped, locked after ACCEPTED, and audited | ✅ PASS | `updateTicketScheduleAction` calls `canManageTicketSchedule` (server), blocks `status === "ACCEPTED"` (`schedule_locked`), and appends `PRIORITY_CHANGE` / `DUE_CHANGE` audit events. `canManageTicketSchedule`: plant-wide roles allowed; `SECTION_MANAGER` only when `actor.sectionId === ticket.sectionId`. (`src/app/actions.ts` L217–298; `src/lib/ops-access.ts`) |
| 4 | Timing badges appear on detail, list, and both queue sections | ✅ PASS | `TicketTiming` (Priority + SLA badges + due) on: detail (`tickets/[id]/page.tsx` L114), list table (`tickets/page.tsx` L80), queue "คิวงานใหม่" (L79) and queue "งานของฉัน" (L124). Ops kanban cards also render `PriorityBadge`+`SlaBadge`. |
| 5 | `/ops` role guard and nav visibility are correct | ✅ PASS | `requireOpsSession` redirects non-ops roles → `/tickets`, and `SECTION_MANAGER` with null section → `/tickets`. `Nav` renders `/ops` link only when `isOpsRole(user.role)`. (`src/lib/auth.ts` L82–90; `src/components/Nav.tsx` L45–49) |
| 6 | Open query is not limited by 7/30 days | ✅ PASS | `OpsPage` open-tickets query filters by `status ∈ OPEN_STATUSES` with **no date filter**; the `days` window applies only to the closed-tickets query (MTTR/on-time). `buildOpsMetrics` open rows filtered by board status only; `days` used solely in `isClosedInWindow`. Filter UI labels `days` as "ช่วงเวลางานที่ปิด" (closed work window). (`src/app/ops/page.tsx` L61–74; `src/lib/ops-metrics.ts` L83–108) |
| 7 | No chart library or new dependency was added | ✅ PASS | `package.json` deps: `@prisma/client, bcryptjs, jose, next, react, react-dom`; devDeps are standard tooling only. Charts implemented as CSS `<div>` bars in `OpsBars.tsx`. Repo-wide grep for `chart/recharts/d3/victory/nivo/dnd/...` → **no matches**. |
| 8 | Notifications, PM, inventory, checklists/signatures, export, and drag/drop remain absent | ✅ PASS | Grep for `notif\|inventory\|checklist\|signature\|draggable\|dnd\|onDragStart\|export csv\|xlsx\|pdfkit\|preventive` across `src` → **no matches**. |

Additional `/ops` structural confirmations (support browser checks 3):
- **5 KPIs**: คิวรอรับ, กำลังซ่อม, เลยกำหนด, MTTR, ปิดทันกำหนด (`ops/page.tsx` L84–90).
- **2 charts**: two `OpsBars` — backlog-by-type & MTTR-by-type (`ops/page.tsx` L112–129).
- **3 kanban columns**: QUEUED / IN_PROGRESS / PENDING_ACCEPTANCE (`OpsKanban.tsx` L11–15).
- **Filters**: type, priority, SLA state, closed-window days (`OpsFilters.tsx`).

---

## 3. Browser checks

**Not executed.** No repair app server is running.

Server probe results:
- Only listening dev-range port is **3000**, owned by process **`grafana`** (PID 9164), which returns HTTP 200 — this is **not** the repair app.
- The single running `node` process (PID 19076) has **no listening TCP port** (not a dev/prod server for this app).
- No Next.js server for `apps/repair` detected on 3000/3001/3002/3003/4000/5173/8080.

Because the seeded app is unavailable, the six browser acceptance checks were left unverified rather than claimed. See below.

### Server URL / availability for the browser worker
- **App server: NOT AVAILABLE.** Port 3000 is occupied by Grafana. A browser worker would need the repair app started (e.g. `npm run dev`, which would fall back off :3000 to :3001 since Grafana holds :3000), and the DB seeded (`npm run db:seed` / `db:reset`), before running the browser suite.

---

## 4. Blockers / unverified items

Unverified browser acceptance items (require a running, seeded app server):
1. Requester ticket form shows required priority + due date with only «พรุ่งนี้» / «อีก 3 วัน» quick picks. — *Statically confirmed in `TicketForm.tsx` (only these two `quickPicks`), but not visually verified.*
2. Technician COMPLETE form has cause/resolution but no due date. — *Statically confirmed in `TransitionForms.tsx`; not visually verified.*
3. Ops manager `/ops` shows filters + five KPIs + two charts + three kanban columns. — *Statically confirmed; not visually verified.*
4. Requester/technician cannot open `/ops`. — *Statically confirmed via `requireOpsSession`; not runtime-verified.*
5. Manager ticket detail shows editable schedule for an open ticket; non-manager does not. — *Statically confirmed via `canEditSchedule` gate; not runtime-verified.*
6. Responsive layout at ~390px and ~1440px with no destructive horizontal overflow. — *Not verifiable statically; requires browser.*

No functional defects were found; no TDD/fix cycle was needed.

---

## 5. Changed files

**None.** This was a verification-only task; no production code was modified. (Temporary gate-output scratch files created during the run were removed.)

---

## 6. Final status

**`DONE_WITH_CONCERNS`**

- All four automated gates pass with exit code 0 (tests 71/71, tsc clean, eslint clean, build success).
- All eight static acceptance criteria pass.
- Browser follow-up completed after starting the repair app explicitly on port 3001. Five browser acceptance areas passed; the technician COMPLETE form remains runtime-unverified because no existing ticket was assigned and ready for completion.

---

## 7. Browser acceptance follow-up

App URL: `http://localhost:3001`

Passed:

1. Requester `/tickets/new` visibly requires priority and due date. The only due-date quick picks are «พรุ่งนี้» and «อีก 3 วัน»; «วันนี้» is absent.
2. Manager `/ops` visibly renders the filter form, five KPI cards, two chart sections, and three kanban columns.
3. Direct `/ops` navigation as requester and technician redirects to `/tickets`.
4. An open ticket shows the schedule editor to a manager and hides it from requester/technician.
5. `/ops` has no destructive horizontal overflow at approximately 1440px desktop or 390px mobile by DOM measurement.

Unverified:

- Technician COMPLETE form at runtime: no existing assigned/complete-ready ticket was available. The browser run avoided mutating production data. Static inspection confirms the form has required cause/resolution and no due-date field.

Screenshots:

- Desktop `/ops`: `C:\Users\somrak.y\AppData\Local\Temp\cursor\screenshots\page-2026-09-25T08-14-20-027Z.png`
- Mobile `/ops`: `C:\Users\somrak.y\AppData\Local\Temp\cursor\screenshots\page-2026-09-25T08-14-32-186Z.png`
