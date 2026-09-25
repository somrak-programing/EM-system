# TCPR Ops Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add requester-set urgency and due dates, computed SLA state, manager editing, and a role-scoped `/ops` command center with current backlog, MTTR, on-time completion, charts, filters, and kanban.

**Architecture:** Keep `Ticket.priority`, `dueAt`, `startedAt`, and `closedAt` as the source of truth; do not add database columns or persist derived SLA states. Put clock math, access rules, filter parsing, and dashboard aggregation into pure TypeScript modules with Vitest coverage. Server Components query Prisma and render the command center; Server Actions validate all mutations and enforce role/section scope.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6/SQLite, Tailwind CSS 4, Vitest 2. No new runtime dependency and no client-side chart library.

## Global Constraints

- `priority` supports only `NORMAL` and `URGENT`.
- A new ticket requires a future `dueAt`; legacy tickets with null `dueAt` remain valid.
- MTTR is `closedAt - startedAt`, not acceptance time.
- The at-risk threshold is exactly 4 wall-clock hours.
- Ops roles are `SECTION_MANAGER`, `EM_MANAGER`, `IT_MANAGER`, `GM`, and `ADMIN`.
- `SECTION_MANAGER` is restricted to matching `sectionId`; the other ops roles see all sections.
- Priority and due date become immutable when status is `ACCEPTED`.
- The 7/30-day window affects MTTR and on-time completion only; current backlog and kanban are never date-window limited.
- Charts use HTML/CSS bars; do not add a chart package in this wave.
- Notifications, PM, inventory, checklist/signature, export, drag-and-drop, and periods longer than 30 days remain out of scope.
- The workspace is not a Git repository, so the commit checkpoints prescribed by the planning workflow cannot be executed. End each task with tests and a diff review instead.

---

## File map

**Create**

- `src/lib/sla.ts` — SLA state, labels, due-date validation, MTTR, and on-time helpers.
- `src/lib/sla.test.ts` — SLA and clock-metric unit tests.
- `src/lib/ops-access.ts` — ops-role and section-scope authorization.
- `src/lib/ops-access.test.ts` — authorization matrix tests.
- `src/lib/ops-metrics.ts` — filter parsing and pure dashboard aggregation.
- `src/lib/ops-metrics.test.ts` — KPI/chart/filter tests.
- `src/components/PriorityBadge.tsx` — NORMAL/URGENT badge.
- `src/components/SlaBadge.tsx` — six-state SLA badge.
- `src/components/TicketTiming.tsx` — reusable priority, due date, and SLA summary.
- `src/components/OpsFilters.tsx` — GET filters that preserve the chosen values.
- `src/components/OpsBars.tsx` — dependency-free horizontal bars for backlog and MTTR.
- `src/components/OpsKanban.tsx` — read-only three-column board.
- `src/components/TicketScheduleForm.tsx` — manager priority/due-date editor.
- `src/app/ops/page.tsx` — role-scoped command center.

**Modify**

- `src/app/actions.ts` — validate create schedule, persist priority/due date, add manager update action, and stop changing due date on COMPLETE.
- `src/components/TicketForm.tsx` — required priority and due-date controls and validation messages.
- `src/components/TransitionForms.tsx` — remove the technician due-date input.
- `src/lib/auth.ts` — add an ops guard that returns the authenticated user.
- `src/components/Nav.tsx` — show «ภาพรวมงาน» only to ops roles.
- `src/app/tickets/[id]/page.tsx` — show timing summary and manager editor.
- `src/app/tickets/page.tsx` — show priority, due date, and SLA.
- `src/app/queue/page.tsx` — show timing badges on new and assigned work.

---

### Task 1: SLA clock and metric primitives

**Files:**
- Create: `src/lib/sla.ts`
- Create: `src/lib/sla.test.ts`

**Interfaces:**
- Produces:
  - `type SlaState = "none" | "on_track" | "at_risk" | "overdue" | "on_time" | "late"`
  - `SLA_LABEL: Record<SlaState, string>`
  - `getSlaState(input: { dueAt: Date | null; closedAt: Date | null }, now?: Date): SlaState`
  - `validateFutureDueAt(raw: string, now?: Date): { ok: true; value: Date } | { ok: false; error: "due_required" | "due_invalid" | "due_past" }`
  - `calculateMttrHours(rows: Array<{ startedAt: Date | null; closedAt: Date | null }>): number | null`
  - `calculateOnTimePercent(rows: Array<{ dueAt: Date | null; closedAt: Date | null }>): number | null`

- [ ] **Step 1: Write failing tests for all six SLA states**

Use fixed UTC values so the tests do not depend on the machine timezone:

```ts
const now = new Date("2026-09-25T06:00:00.000Z");

expect(getSlaState({ dueAt: null, closedAt: null }, now)).toBe("none");
expect(getSlaState({
  dueAt: new Date("2026-09-25T12:00:01.000Z"),
  closedAt: null,
}, now)).toBe("on_track");
expect(getSlaState({
  dueAt: new Date("2026-09-25T10:00:00.000Z"),
  closedAt: null,
}, now)).toBe("at_risk");
expect(getSlaState({
  dueAt: new Date("2026-09-25T05:59:59.000Z"),
  closedAt: null,
}, now)).toBe("overdue");
expect(getSlaState({
  dueAt: new Date("2026-09-25T10:00:00.000Z"),
  closedAt: new Date("2026-09-25T09:00:00.000Z"),
}, now)).toBe("on_time");
expect(getSlaState({
  dueAt: new Date("2026-09-25T10:00:00.000Z"),
  closedAt: new Date("2026-09-25T10:00:01.000Z"),
}, now)).toBe("late");
```

Also assert that an unclaimed ticket can be overdue—the function intentionally has no `startedAt` input.

- [ ] **Step 2: Write failing tests for due-date parsing**

Cover missing, invalid, equal-to-now, past, and future values. Equal-to-now must fail because the design requires strictly future.

- [ ] **Step 3: Write failing MTTR and on-time tests**

Use completed rows of 2 and 4 hours and expect `3`. Include rows missing either timestamp and prove they are ignored. For on-time percentage, include two on-time rows, one late row, and one null due date and expect `66.666...`; return `null` when no eligible completed ticket exists.

- [ ] **Step 4: Run the new test file and verify RED**

Run:

```powershell
npx vitest run src/lib/sla.test.ts
```

Expected: FAIL because `./sla` does not exist.

- [ ] **Step 5: Implement the pure helpers**

Key implementation:

```ts
const AT_RISK_MS = 4 * 60 * 60 * 1000;

export function getSlaState(
  input: { dueAt: Date | null; closedAt: Date | null },
  now = new Date(),
): SlaState {
  if (!input.dueAt) return "none";
  if (input.closedAt) {
    return input.closedAt.getTime() <= input.dueAt.getTime() ? "on_time" : "late";
  }
  const remaining = input.dueAt.getTime() - now.getTime();
  if (remaining < 0) return "overdue";
  return remaining <= AT_RISK_MS ? "at_risk" : "on_track";
}
```

`validateFutureDueAt` must reject `Number.isNaN(date.getTime())`. `calculateMttrHours` averages positive or zero valid durations and ignores malformed negative durations. `calculateOnTimePercent` ignores rows without both `dueAt` and `closedAt`.

- [ ] **Step 6: Run SLA tests and the complete suite**

Run:

```powershell
npx vitest run src/lib/sla.test.ts
npm test
```

Expected: new tests PASS; existing tests remain PASS.

- [ ] **Step 7: Review the task diff**

Confirm no Prisma import, no `Date.now()` hidden inside metric reducers, and all functions accept deterministic dates for tests.

---

### Task 2: Ops authorization boundary

**Files:**
- Create: `src/lib/ops-access.ts`
- Create: `src/lib/ops-access.test.ts`
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Produces:
  - `OPS_ROLES: readonly RoleCode[]`
  - `isOpsRole(role: RoleCode): boolean`
  - `canManageTicketSchedule(actor: { role: RoleCode; sectionId: string | null }, ticket: { sectionId: string | null }): boolean`
  - `opsSectionWhere(actor): { sectionId: string } | undefined`
  - `requireOpsSession()` in `auth.ts`

- [ ] **Step 1: Write the role-matrix tests**

Assert all five allowed roles. Assert `REQUESTER`, `EM_TECHNICIAN`, and `IT_TECHNICIAN` are denied. For `SECTION_MANAGER`, assert same-section true, other-section false, and null-section false. Assert all four plant-wide roles can manage a ticket in any or no section.

- [ ] **Step 2: Run the test and verify RED**

```powershell
npx vitest run src/lib/ops-access.test.ts
```

Expected: FAIL because `./ops-access` does not exist.

- [ ] **Step 3: Implement pure access helpers**

Use an immutable role set. `opsSectionWhere` returns `{ sectionId: actor.sectionId }` only for a section manager with a non-null section; callers must reject a section manager with no section instead of accidentally treating `undefined` as plant-wide access.

- [ ] **Step 4: Add `requireOpsSession`**

In `src/lib/auth.ts`, call `requireSession()`, redirect unauthenticated users to `/login`, redirect non-ops users and section managers without a section to `/tickets`, and return the full auth object otherwise.

- [ ] **Step 5: Verify**

```powershell
npx vitest run src/lib/ops-access.test.ts
npx tsc --noEmit
```

Expected: PASS and exit code 0.

---

### Task 3: Persist priority and due date at ticket creation

**Files:**
- Modify: `src/app/actions.ts`
- Modify: `src/components/TicketForm.tsx`
- Modify: `src/components/TransitionForms.tsx`

**Interfaces:**
- Consumes: `validateFutureDueAt`
- Changes form contract: `createTicketAction` requires `priority` and `dueAt`

- [ ] **Step 1: Add server-side create validation**

In `createTicketAction`:

```ts
const priority = String(formData.get("priority") ?? "");
if (priority !== "NORMAL" && priority !== "URGENT") {
  redirect("/tickets/new?error=priority");
}
const dueResult = validateFutureDueAt(String(formData.get("dueAt") ?? ""));
if (!dueResult.ok) redirect(`/tickets/new?error=${dueResult.error}`);
```

Persist `priority` and `dueAt: dueResult.value` in `prisma.ticket.create`.

- [ ] **Step 2: Add required controls to the requester form**

Add a required two-option priority selector with Thai labels «ปกติ» and «เร่งด่วน». Add `DateTimeField` named `dueAt`, labelled «กำหนดเสร็จ», with quick picks «พรุ่งนี้» and «อีก 3 วัน». Do not include «วันนี้»: minute precision would make a current-minute value immediately fail strict-future validation. Because `DateTimeField` currently has no `required` prop, extend it with `required?: boolean` and pass the prop to its native input.

Add form errors:

- `priority` → «กรุณาเลือกความเร่งด่วน»
- `due_required` → «กรุณาเลือกกำหนดเสร็จ»
- `due_invalid` → «กำหนดเสร็จไม่ถูกต้อง»
- `due_past` → «กำหนดเสร็จต้องอยู่ในอนาคต»

- [ ] **Step 3: Remove technician ownership of the due date**

Delete the `DateTimeField` block and import from `TransitionForms.tsx`. Remove `dueRaw` and the COMPLETE-time `dueAt` update from `applyTransitionAction`.

- [ ] **Step 4: Run static and unit checks**

```powershell
npm test
npx tsc --noEmit
npx eslint src/app/actions.ts src/components/TicketForm.tsx src/components/DateTimeField.tsx src/components/TransitionForms.tsx
```

Expected: all exit 0.

- [ ] **Step 5: Browser-check creation**

Start the app on its available port. As `requester`, verify missing due date is blocked, a past due date returns the Thai error, and a valid NORMAL/URGENT ticket persists both fields. As `tech`, verify COMPLETE no longer asks for due date.

---

### Task 4: Manager schedule update with audit events

**Files:**
- Modify: `src/app/actions.ts`
- Create: `src/components/TicketScheduleForm.tsx`
- Modify: `src/app/tickets/[id]/page.tsx`

**Interfaces:**
- Produces: `updateTicketScheduleAction(formData: FormData): Promise<never>`
- Consumes: `canManageTicketSchedule`, `validateFutureDueAt`

- [ ] **Step 1: Implement the guarded Server Action**

Load auth and ticket server-side. Reject when:

- unauthenticated;
- actor fails `canManageTicketSchedule`;
- ticket status is `ACCEPTED`;
- priority is not `NORMAL` or `URGENT`;
- due date is missing or invalid.

Manager edits may deliberately set a past due date to represent a revised deadline that is already breached, so parse a valid date but do not call the “future” part of create validation. Add a small `parseDateTime` helper in `sla.ts` if needed and cover it with a unit test.

Build audit events only for changed fields:

```ts
const events = [
  priority !== ticket.priority
    ? {
        actorId: auth.session.id,
        fromStatus: ticket.status,
        toStatus: ticket.status,
        action: "PRIORITY_CHANGE",
        note: `ความเร่งด่วน: ${ticket.priority} → ${priority}`,
      }
    : null,
  dueAt.getTime() !== ticket.dueAt?.getTime()
    ? {
        actorId: auth.session.id,
        fromStatus: ticket.status,
        toStatus: ticket.status,
        action: "DUE_CHANGE",
        note: `กำหนดเสร็จ: ${formatWhen(ticket.dueAt)} → ${formatWhen(dueAt)}`,
      }
    : null,
].filter((event): event is NonNullable<typeof event> => event !== null);
```

Perform one Prisma update with `events: { create: events }`. A no-change submission redirects without writing an event.

- [ ] **Step 2: Create the manager editor**

`TicketScheduleForm` receives `ticketId`, `priority`, and an already formatted `dueAt` local input value. Render priority select, required `DateTimeField`, hidden ticket ID, and submit button. Keep it a Client Component only if controlled field behavior requires it; otherwise prefer a Server Component form.

- [ ] **Step 3: Wire the detail page**

Use `canManageTicketSchedule` to render the editor only when permitted and not `ACCEPTED`. Add error labels for `schedule_forbidden`, `schedule_locked`, and `schedule_invalid`. Existing event timeline automatically renders the two new event notes.

- [ ] **Step 4: Verify server authorization manually**

Test:

- section manager editing same-section ticket succeeds;
- section manager editing another section fails;
- technician posting directly to the action fails;
- accepted ticket fails;
- changing both fields creates two events.

- [ ] **Step 5: Run gates**

```powershell
npm test
npx tsc --noEmit
npx eslint src/app/actions.ts src/components/TicketScheduleForm.tsx src/app/tickets/[id]/page.tsx
```

Expected: all exit 0.

---

### Task 5: Shared timing badges across ticket surfaces

**Files:**
- Create: `src/components/PriorityBadge.tsx`
- Create: `src/components/SlaBadge.tsx`
- Create: `src/components/TicketTiming.tsx`
- Modify: `src/app/tickets/[id]/page.tsx`
- Modify: `src/app/tickets/page.tsx`
- Modify: `src/app/queue/page.tsx`

**Interfaces:**
- `PriorityBadge({ priority })`
- `SlaBadge({ state })`
- `TicketTiming({ priority, dueAt, closedAt, now?, compact? })`

- [ ] **Step 1: Build semantic badges**

Use existing Tailwind palette conventions:

- NORMAL: slate
- URGENT: red
- none: slate
- on_track/on_time: green/teal
- at_risk: amber
- overdue/late: red

Labels come from `SLA_LABEL`, not duplicated in JSX.

- [ ] **Step 2: Build the reusable summary**

`TicketTiming` computes `getSlaState({ dueAt, closedAt }, now)` and displays priority, SLA state, and `formatWhen(dueAt)`. `compact` uses an inline wrap suitable for table cells and queue cards.

- [ ] **Step 3: Add it to all required surfaces**

- ticket detail: full summary in the metadata grid;
- ticket list: add «ความเร่งด่วน / SLA» and «กำหนดเสร็จ» columns;
- queue new-work and my-work cards: compact badges and due date.

- [ ] **Step 4: Verify**

```powershell
npx tsc --noEmit
npx eslint src/components/PriorityBadge.tsx src/components/SlaBadge.tsx src/components/TicketTiming.tsx src/app/tickets src/app/queue/page.tsx
```

Browser-check responsive wrapping at desktop and mobile widths.

---

### Task 6: Dashboard aggregation and filters

**Files:**
- Create: `src/lib/ops-metrics.ts`
- Create: `src/lib/ops-metrics.test.ts`

**Interfaces:**

```ts
export type OpsFilters = {
  type: TicketType | "ALL";
  priority: TicketPriority | "ALL";
  sla: SlaState | "ALL";
  days: 7 | 30;
};

export type OpsTicket = {
  id: string;
  ticketNo: string;
  type: TicketType;
  status: string;
  priority: TicketPriority;
  subject: string;
  dueAt: Date | null;
  startedAt: Date | null;
  closedAt: Date | null;
  requesterName: string;
  assigneeName: string | null;
};
```

Produces:
- `parseOpsFilters(searchParams): OpsFilters`
- `buildOpsMetrics(rows, filters, now): { kpis; backlogByType; mttrByType; board }`

- [ ] **Step 1: Write filter parser tests**

Unknown type, priority, SLA, or days must fall back to `ALL`, `ALL`, `ALL`, and `7`. Valid `30` remains 30.

- [ ] **Step 2: Write aggregation tests**

Use a fixture that includes each board status, one accepted on-time ticket, one accepted late ticket, an overdue unclaimed ticket, and another type. Assert:

- queued and in-progress are current counts;
- pending acceptance appears in board but not queued/in-progress counts;
- overdue includes the unclaimed ticket;
- backlog groups only open board tickets;
- MTTR and on-time percent use completed rows inside the window;
- a ticket older than 30 days remains on the board if open;
- type/priority/SLA filters affect every resulting collection.

- [ ] **Step 3: Verify RED**

```powershell
npx vitest run src/lib/ops-metrics.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement pure aggregation**

Derive SLA once per row. Apply type, priority, and SLA filters before splitting into:

- current open rows with status in `QUEUED`, `IN_PROGRESS`, `PENDING_ACCEPTANCE`;
- completed-window rows where `closedAt >= now - days`.

Use `calculateMttrHours` and `calculateOnTimePercent`. Return all four ticket types with zero counts/null MTTR so the chart order is stable.

- [ ] **Step 5: Verify**

```powershell
npx vitest run src/lib/ops-metrics.test.ts
npm test
```

Expected: PASS.

---

### Task 7: `/ops` command-center UI

**Files:**
- Create: `src/components/OpsFilters.tsx`
- Create: `src/components/OpsBars.tsx`
- Create: `src/components/OpsKanban.tsx`
- Create: `src/app/ops/page.tsx`
- Modify: `src/components/Nav.tsx`

**Interfaces:**
- Consumes `requireOpsSession`, `opsSectionWhere`, `parseOpsFilters`, and `buildOpsMetrics`.

- [ ] **Step 1: Add the role-scoped route**

Call `requireOpsSession`. Build Prisma `where` from `opsSectionWhere` and query:

1. current board rows where status is in `QUEUED`, `IN_PROGRESS`, `PENDING_ACCEPTANCE`;
2. completed rows where `closedAt >=` the chosen 7/30-day boundary.

Apply type and priority in Prisma when not `ALL`; apply SLA in memory because it is derived. Merge rows by ticket ID before aggregation.

- [ ] **Step 2: Implement GET filters**

Render a `<form method="get">` with selects for type, priority, SLA, and 7/30 days. Use a submit button; no client-side state is required. Add a reset link to `/ops`.

- [ ] **Step 3: Render five KPIs**

Show:

- คิวรอรับ
- กำลังซ่อม
- เลยกำหนด
- MTTR (hours, one decimal; «—» when null)
- ปิดทันกำหนด (percent, one decimal; «—» when null)

- [ ] **Step 4: Render dependency-free charts**

`OpsBars` receives rows `{ label, value, displayValue }[]`. Calculate each width relative to the maximum positive value; zero rows show a track with 0 width. Use an accessible list and text values so information is not color-only.

Render backlog count by type and MTTR hours by type side-by-side at desktop width and stacked on mobile.

- [ ] **Step 5: Render read-only kanban**

Columns are fixed to `QUEUED`, `IN_PROGRESS`, `PENDING_ACCEPTANCE`. Every card links to `/tickets/[id]` and shows ticket number, subject, requester, assignee, priority, due date, and SLA badge. No drag handlers and no transition actions.

- [ ] **Step 6: Add navigation**

Use `isOpsRole(user.role)` in `Nav.tsx` to show «ภาพรวมงาน» linking to `/ops`. This is presentation only; route/action guards remain authoritative.

- [ ] **Step 7: Verify role scope and UI**

As seeded users:

- `manager` sees only PD-section tickets;
- `emmgr`, `itmgr`, `gm`, and `admin` see plant-wide data;
- `requester`, `tech`, and `ittech` do not see the nav link and are redirected from `/ops`;
- filters update URL query parameters and all visible widgets consistently;
- 7/30 changes MTTR/on-time only and does not remove old open work.

---

### Task 8: Final verification and regression review

**Files:**
- Review all files listed in the file map.

- [ ] **Step 1: Run the full automated gate**

```powershell
npm test
npx tsc --noEmit
npx eslint src
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify requester workflow**

Create NORMAL and URGENT tickets with future deadlines. Confirm persisted values on detail/list pages. Confirm missing/past deadline errors and that photos still upload.

- [ ] **Step 3: Verify technician workflow**

Claim and complete a ticket. Confirm `startedAt` and `closedAt` drive MTTR, COMPLETE has no due-date control, and SLA changes from open state to `on_time` or `late`.

- [ ] **Step 4: Verify manager workflow and audit**

Change priority and deadline on an open same-scope ticket; verify timeline events. Confirm cross-section, non-manager, and ACCEPTED mutations are rejected server-side.

- [ ] **Step 5: Verify command center**

Check all seeded manager roles, all four ticket types, both time windows, each SLA filter, empty chart groups, and kanban links. Verify mobile layout at approximately 390px and desktop at 1440px.

- [ ] **Step 6: Review scope**

Confirm no notification scheduler, PM model, inventory model, checklist/signature field, export control, chart dependency, or drag-and-drop behavior slipped into the wave.

- [ ] **Step 7: Record completion**

Update the design/spec only if implementation revealed an approved behavior change. Because this workspace has no Git metadata, report changed files and command outputs rather than a commit hash.
