# Task 7 Report: `/ops` command-center UI

## Status

DONE — all verification commands pass. Nothing committed.

## Files

- Created `src/components/OpsFilters.tsx`
- Created `src/components/OpsBars.tsx`
- Created `src/components/OpsKanban.tsx`
- Created `src/app/ops/page.tsx`
- Modified `src/components/Nav.tsx` (import `isOpsRole`, add «ภาพรวมงาน» → `/ops` link)

## Verification (run in `C:\dev\BSCB\apps\repair`)

| Command | Result |
| --- | --- |
| `npm test` | 9 files, 71/71 tests passed |
| `npx tsc --noEmit` | exit 0, no output |
| `npx eslint src/components/OpsFilters.tsx src/components/OpsBars.tsx src/components/OpsKanban.tsx src/app/ops/page.tsx src/components/Nav.tsx` | exit 0, no output |
| `npm run build` | success; "Compiled successfully", `/ops` listed as dynamic route (181 B / 111 kB) |

## Self-review

### Route and query (`src/app/ops/page.tsx`)

- Server Component with `searchParams: Promise<Record<string, string | string[] | undefined>>`. ✅
- `requireOpsSession()` is the first call, before any query. ✅
- `parseOpsFilters` is called once; one `now = new Date()` is reused for the window, `buildOpsMetrics`, and `OpsKanban`. ✅
- A single shared `scope` object = `opsSectionWhere(auth.session)` + non-ALL `type` + non-ALL `priority`. Both queries spread the same `scope`. ✅
- Open query: `{ ...scope, status: { in: ["QUEUED","IN_PROGRESS","PENDING_ACCEPTANCE"] } }`, `orderBy createdAt asc` (oldest first). No `closedAt` / time-window condition. ✅
- Completed query: `{ ...scope, closedAt: { gte: now - days*24h, lte: now } }`, `orderBy closedAt desc`. ✅
- Both include `requester.displayName` and `assignee.displayName` (select only). ✅
- Rows mapped to `OpsTicket`, merged by ID via `Map` (first wins; duplicates are identical DB rows), passed to `buildOpsMetrics(rows, filters, now)`. SLA filter is not in Prisma; it is applied in memory by `buildOpsMetrics`. ✅

### OpsFilters

- `<form method="get" action="/ops">`, no `"use client"`, no state; `defaultValue` from parsed filters. ✅
- Type (ALL + 4 via `TYPE_LABEL`), priority (ALL/NORMAL/URGENT), SLA (ALL + 6 via `SLA_LABEL`), days (7/30). ✅
- Submit «กรองข้อมูล»; reset `<Link href="/ops">` «ล้างตัวกรอง». ✅

### OpsBars

- `<section aria-label={title}>` with heading, caption, and `<ul>/<li>` list. ✅
- Width = value / max positive value × 100; null/zero/non-positive → 0%; max 0 → all 0%. ✅
- Label and `displayValue` always rendered as text; bar track marked `aria-hidden`. ✅
- Fill `bg-brand-teal`, track `bg-slate-100`. Plain divs only — no SVG/canvas/package/client code. ✅

### OpsKanban

- Three fixed columns «รอช่าง», «กำลังซ่อม», «รอตรวจรับ» (with count chip). ✅
- Each card is a `Link` to `/tickets/{id}` showing ticketNo, subject, requester, assignee (or «—»), due date via `formatWhen`, `PriorityBadge`, and `SlaBadge` (`getSlaState(ticket, now)`). ✅
- Empty column: «ไม่มีใบงาน». Read-only; no drag, no forms. ✅

### `/ops` layout

- `Nav` → heading «ภาพรวมงานซ่อม» + scope caption («เฉพาะแผนกของคุณ» for SECTION_MANAGER, else «ทั้งโรงงาน») → `OpsFilters` → five KPI cards (คิวรอรับ, กำลังซ่อม, เลยกำหนด, MTTR `x.x ชม.`/«—», ปิดทันกำหนด `x.x%`/«—») → two `OpsBars` in `lg:grid-cols-2` → `OpsKanban`. ✅
- Backlog bar: all 4 types, integer counts, caption «ใบงานที่ยังเปิดอยู่ในปัจจุบัน». MTTR bar: all 4 types, one-decimal hours or «—», caption «ใบงานที่ปิดใน {7|30} วันล่าสุด». ✅
- Responsive grids (KPIs 2/3/5 cols, bars 1/2 cols, kanban 1/3 cols, filters 1/2/5 cols), brand navy/teal tokens matching existing pages. No dependencies added. ✅

### Navigation

- `isOpsRole(user.role)` gates the «ภาพรวมงาน» link; the route guard in `requireOpsSession` remains authoritative. ✅

## Concerns

- `PRIORITY_LABEL` in `PriorityBadge.tsx` is not exported, so `OpsFilters` repeats the two Thai priority labels («ปกติ», «เร่งด่วน») locally to avoid editing a file outside the task list. Exporting it would remove the duplication.
- The board and KPI counts only include tickets whose `status` string is exactly `QUEUED`/`IN_PROGRESS`/`PENDING_ACCEPTANCE` (per brief). Any workflow using other stage codes for open work would not appear.
- No browser/manual render check was performed (requires a seeded DB and an ops login); verification is limited to typecheck, lint, tests, and build.
