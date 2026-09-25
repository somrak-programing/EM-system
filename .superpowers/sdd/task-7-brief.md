# Task 7: `/ops` command-center UI

Work in `C:\dev\BSCB\apps\repair`.

## Files
- Create `src/components/OpsFilters.tsx`
- Create `src/components/OpsBars.tsx`
- Create `src/components/OpsKanban.tsx`
- Create `src/app/ops/page.tsx`
- Modify `src/components/Nav.tsx`

## Existing interfaces to consume

- `requireOpsSession()` from `src/lib/auth.ts`
- `isOpsRole()` and `opsSectionWhere()` from `src/lib/ops-access.ts`
- `parseOpsFilters()`, `buildOpsMetrics()`, `OpsFilters`, and `OpsTicket` from `src/lib/ops-metrics.ts`
- `PriorityBadge`, `SlaBadge`, `TYPE_LABEL`, `SLA_LABEL`, `getSlaState`, and `formatWhen`

## Route and query

`src/app/ops/page.tsx` is a Server Component accepting:

```ts
{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}
```

1. Call `requireOpsSession()` before querying.
2. Parse filters once and create one `now = new Date()`.
3. Use `opsSectionWhere(auth.session)` for Prisma section scope. `requireOpsSession` already rejects a section manager without a section.
4. Apply non-ALL type and priority filters in both Prisma queries.
5. Query current rows with statuses exactly `QUEUED`, `IN_PROGRESS`, `PENDING_ACCEPTANCE`, ordered oldest first.
6. Query completed rows where `closedAt` is in `[now - days, now]`, ordered newest first.
7. Include requester and assignee names.
8. Map both result sets to `OpsTicket`, merge by ID, and call `buildOpsMetrics`. SLA filtering stays in memory because it is derived.

The time window must not limit current open work.

## Components

### OpsFilters

- GET form targeting `/ops`.
- Selects: type (all + four types), priority (all/NORMAL/URGENT), SLA (all + six states), days (7/30).
- Values use existing Thai labels.
- Submit label «กรองข้อมูล» and reset link «ล้างตัวกรอง» to `/ops`.
- No client state or `"use client"`.

### OpsBars

Props:

```ts
{
  title: string;
  caption: string;
  rows: Array<{ label: string; value: number | null; displayValue: string }>;
}
```

- Accessible `<section>` and list.
- Bar widths are relative to the largest positive value; null/zero render 0 width.
- Text label and `displayValue` always remain visible; do not convey data by color alone.
- Use brand teal for the fill and neutral Tailwind tokens for tracks.
- No SVG/canvas/chart package and no client code.

### OpsKanban

Props:

```ts
{
  board: {
    QUEUED: OpsTicket[];
    IN_PROGRESS: OpsTicket[];
    PENDING_ACCEPTANCE: OpsTicket[];
  };
  now: Date;
}
```

- Three fixed columns: «รอช่าง», «กำลังซ่อม», «รอตรวจรับ».
- Each card links to `/tickets/{id}` and shows ticket number, subject, requester, assignee, priority, due date, and SLA badge.
- Empty column text: «ไม่มีใบงาน».
- Read-only: no drag behavior and no transition forms.

## `/ops` layout

1. `Nav`
2. Heading «ภาพรวมงานซ่อม» and scope caption («เฉพาะแผนกของคุณ» for SECTION_MANAGER, otherwise «ทั้งโรงงาน»).
3. `OpsFilters`.
4. Five KPI cards:
   - คิวรอรับ
   - กำลังซ่อม
   - เลยกำหนด
   - MTTR (one decimal hour or «—»)
   - ปิดทันกำหนด (one decimal percent or «—»)
5. Side-by-side `OpsBars` on desktop:
   - backlog by all four types; integer counts; caption indicates current open work.
   - MTTR by all four types; one decimal hours or «—»; caption indicates selected 7/30-day window.
6. `OpsKanban`.

Use the existing brand styles and responsive grids. Do not add a dependency.

## Navigation

Use `isOpsRole(user.role)` in `Nav.tsx` to show link «ภาพรวมงาน» → `/ops`. Route guard remains authoritative.

## Verification

```powershell
npm test
npx tsc --noEmit
npx eslint src/components/OpsFilters.tsx src/components/OpsBars.tsx src/components/OpsKanban.tsx src/app/ops/page.tsx src/components/Nav.tsx
npm run build
```

Inspect code to confirm both queries share section/type/priority scope and the time window never touches open-query criteria.

## Report

Write `C:\dev\BSCB\apps\repair\.superpowers\sdd\task-7-report.md` with status, files, exact verification, self-review against every UI/query rule, and concerns. Do not commit or make unrelated changes.
