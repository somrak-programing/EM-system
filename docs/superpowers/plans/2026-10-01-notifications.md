# TCPR Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store an in-app notice for new tickets, status changes, and one overdue alert per recipient and due instant, let an admin switch bell and email by role, and send one Thai email per recipient when that switch and SMTP allow it.

**Architecture:** Pure TypeScript in `src/lib/notify.ts` decides recipients, messages, and preference normalization. Server actions and the overdue scanner call that module, write `Notification` rows, then send email only after those rows are committed. `/notifications` and the nav bell read the logged-in user's rows. `/admin/notifications` is the only place the grid is edited.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6/SQLite, Tailwind CSS 4, Vitest 2, `nodemailer` for SMTP. No queue, no in-process timer.

## Global Constraints

- Kinds are exactly `CREATED`, `CLAIMED`, `COMPLETED`, `REJECTED`, `ACCEPTED`, `OVERDUE`.
- Default bell and email are both on for `CREATED` and `OVERDUE` on `EM_TECHNICIAN` and `IT_TECHNICIAN`, and for `CLAIMED`, `COMPLETED`, and `REJECTED` on `REQUESTER`. Every other cell is off, including all of `ACCEPTED`.
- A missing `NotificationPreference` row means both switches are off at runtime. Seed writes the default-on cells. Saving the admin form upserts every role and kind.
- The email switch is stored on only when the bell switch in the same cell is on. Turning the bell off stores email off.
- `MACHINE`, `ELECTRIC`, and `STAFF` match `EM_MANAGER` and `EM_TECHNICIAN`. `IT` matches `IT_MANAGER` and `IT_TECHNICIAN`. `GM` and `ADMIN` match every type. `REQUESTER` matches only `ticket.requesterId`. `SECTION_MANAGER` matches only active managers whose `sectionId` equals the requester's section. A requester with no section matches no section manager.
- Inactive users are skipped. The actor who performed the action is always removed. That exclusion is not a switch.
- When `OVERDUE` has an assignee, `EM_TECHNICIAN` and `IT_TECHNICIAN` notify that assignee only, and only when the assignee is active and the assignee's role has the `OVERDUE` bell on. Other technician users are not added. Non-technician roles still receive overdue when their own bell is on.
- Overdue uniqueness is one row per `(ticketId, dueAt, recipientId, kind=OVERDUE)`. A later scan may add a recipient who does not yet have that row. A changed `dueAt` is a new instant.
- The scanner considers tickets with `closedAt` null, `dueAt` not null, and `dueAt` before now. It is `npm run notifications:scan`. It exits before reading tickets when `NOTIFY_CRON_SECRET` is missing. The Next.js process does not start a timer.
- Email is sent after the notification row is committed, one message per recipient, only when the email switch is on, `User.email` is non-empty, and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and `APP_URL` are set. Failure or missing SMTP stores `emailError` and leaves the row. No address or an off email switch skips email without an error string. There is no retry.
- In-app copy is exactly: `มีใบงานใหม่ {ticketNo}`, `{ticketNo} ถูกรับงานแล้ว`, `{ticketNo} รอตรวจรับ`, `{ticketNo} ถูกส่งกลับให้แก้ไข`, `{ticketNo} ตรวจรับแล้ว`, `{ticketNo} เลยกำหนดเสร็จ`.
- At-risk warnings, repeat overdue reminders, per-user preference pages, LINE, SMS, digests, push, and a worker queue stay out of scope.
- Action codes in the workflow stay `CLAIM`, `COMPLETE`, `REJECT`, and `ACCEPT`. Map them to `CLAIMED`, `COMPLETED`, `REJECTED`, and `ACCEPTED`.
- Commit from `apps/repair` with PowerShell here-strings. Do not commit `.env` or secrets.

---

## File map

**Create**

- `src/lib/notify.ts` — kinds, default grid, message text, preference parsing, recipient selection.
- `src/lib/notify.test.ts` — recipient and preference tests.
- `src/lib/notify-mail.ts` — SMTP skip and send.
- `src/lib/notify-mail.test.ts` — mail tests with a fake transport.
- `src/lib/notify-deliver.ts` — load users and preferences, insert rows, then send.
- `src/lib/notify-deliver.test.ts` — row insert and email-after-insert tests.
- `src/lib/notify-scan.ts` — secret gate and overdue selection.
- `src/lib/notify-scan.test.ts` — scanner tests.
- `scripts/notifications-scan.ts` — CLI entry for Task Scheduler.
- `prisma/ensure-notification-preferences.ts` — upsert default-on cells without deleting tickets.
- `src/app/notifications/page.tsx` — the signed-in user's notice list.
- `src/app/notifications/actions.ts` — mark all read.
- `src/app/admin/notifications/page.tsx` — admin grid.
- `src/app/admin/notifications/actions.ts` — save the grid.

**Modify**

- `prisma/schema.prisma` — `NotificationKind`, `NotificationPreference`, `Notification`, and relations.
- `prisma/seed.ts` — delete the new tables before users, then seed default-on cells.
- `package.json` — `notifications:scan` script and `nodemailer`.
- `src/app/actions.ts` — write notices inside the create and transition actions.
- `src/app/actions.test.ts` — assert a created ticket asks for `CREATED` rows and a failed create does not.
- `src/app/tickets/[id]/page.tsx` — mark the linked notice read when it belongs to the viewer.
- `src/components/Nav.tsx` — unread count and the admin grid link.

---

### Task 1: Preference rules and database tables

**Files:**
- Create: `src/lib/notify.ts`
- Create: `src/lib/notify.test.ts`
- Create: `prisma/ensure-notification-preferences.ts`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Produces:
  - `NOTIFICATION_KINDS`, `NotificationKind`
  - `PreferenceCell = { inApp: boolean; email: boolean }`
  - `defaultPreference(role: RoleCode, kind: NotificationKind): PreferenceCell`
  - `normalizePreference(inApp: boolean, email: boolean): PreferenceCell`
  - `notificationMessage(kind: NotificationKind, ticketNo: string): string`
  - `kindForAction(actionCode: string): NotificationKind | null`
  - `KIND_LABEL: Record<NotificationKind, string>`

- [ ] **Step 1: Write the failing preference and message tests**

Create `src/lib/notify.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { RoleCode } from "@prisma/client";
import {
  NOTIFICATION_KINDS,
  defaultPreference,
  kindForAction,
  normalizePreference,
  notificationMessage,
} from "./notify";

const roles: RoleCode[] = [
  "REQUESTER",
  "SECTION_MANAGER",
  "GM",
  "EM_MANAGER",
  "EM_TECHNICIAN",
  "IT_MANAGER",
  "IT_TECHNICIAN",
  "ADMIN",
];

describe("defaultPreference", () => {
  it("turns bell and email on for the agreed cells only", () => {
    expect(defaultPreference("EM_TECHNICIAN", "CREATED")).toEqual({
      inApp: true,
      email: true,
    });
    expect(defaultPreference("IT_TECHNICIAN", "OVERDUE")).toEqual({
      inApp: true,
      email: true,
    });
    expect(defaultPreference("REQUESTER", "CLAIMED")).toEqual({
      inApp: true,
      email: true,
    });
    expect(defaultPreference("REQUESTER", "COMPLETED").inApp).toBe(true);
    expect(defaultPreference("REQUESTER", "REJECTED").email).toBe(true);
    for (const role of roles) {
      expect(defaultPreference(role, "ACCEPTED")).toEqual({
        inApp: false,
        email: false,
      });
    }
    expect(defaultPreference("EM_MANAGER", "CREATED").inApp).toBe(false);
    expect(defaultPreference("ADMIN", "OVERDUE").email).toBe(false);
  });
});

describe("normalizePreference", () => {
  it("drops email when the bell is off", () => {
    expect(normalizePreference(false, true)).toEqual({
      inApp: false,
      email: false,
    });
    expect(normalizePreference(true, true)).toEqual({
      inApp: true,
      email: true,
    });
  });
});

describe("notificationMessage", () => {
  it("uses the Thai ticket sentences", () => {
    expect(notificationMessage("CREATED", "EM-1")).toBe("มีใบงานใหม่ EM-1");
    expect(notificationMessage("CLAIMED", "EM-1")).toBe("EM-1 ถูกรับงานแล้ว");
    expect(notificationMessage("COMPLETED", "EM-1")).toBe("EM-1 รอตรวจรับ");
    expect(notificationMessage("REJECTED", "EM-1")).toBe("EM-1 ถูกส่งกลับให้แก้ไข");
    expect(notificationMessage("ACCEPTED", "EM-1")).toBe("EM-1 ตรวจรับแล้ว");
    expect(notificationMessage("OVERDUE", "EM-1")).toBe("EM-1 เลยกำหนดเสร็จ");
  });
});

describe("kindForAction", () => {
  it("maps workflow actions and ignores anything else", () => {
    expect(kindForAction("CLAIM")).toBe("CLAIMED");
    expect(kindForAction("COMPLETE")).toBe("COMPLETED");
    expect(kindForAction("REJECT")).toBe("REJECTED");
    expect(kindForAction("ACCEPT")).toBe("ACCEPTED");
    expect(kindForAction("CREATE")).toBeNull();
    expect(NOTIFICATION_KINDS).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/notify.test.ts`

Expected: FAIL because `src/lib/notify.ts` does not exist.

- [ ] **Step 3: Implement the pure preference module**

Create `src/lib/notify.ts` with the functions above. `defaultPreference` returns `{ inApp: true, email: true }` only for the Global Constraints default cells. `kindForAction` returns null for unknown codes. `KIND_LABEL` is `ใบงานใหม่`, `รับงาน`, `ส่งตรวจ`, `ส่งกลับ`, `ตรวจรับ`, `เลยกำหนด` in kind order.

- [ ] **Step 4: Add the Prisma models**

In `prisma/schema.prisma`, add enum `NotificationKind` with the six kinds. Add `NotificationPreference` with `roleId`, `kind`, `inApp`, `email`, a relation to `Role`, and `@@unique([roleId, kind])`. Add `Notification` with `recipientId`, `ticketId`, `kind`, optional `dueAt`, `createdAt`, optional `readAt`, optional `emailSentAt`, optional `emailError`, relations to `User` and `Ticket`, and `@@unique([ticketId, dueAt, recipientId, kind])`. Add `notificationPreferences NotificationPreference[]` on `Role`, `notifications Notification[]` on `User` (name the relation `NotificationRecipient`), and `notifications Notification[]` on `Ticket`.

SQLite unique indexes treat null `dueAt` as distinct, so repeated status rows for the same ticket remain allowed. Overdue rows copy the ticket's exact `dueAt`, so that unique key holds.

- [ ] **Step 5: Seed default-on cells without wiping an existing database**

Create `prisma/ensure-notification-preferences.ts` that constructs its own `PrismaClient`, loads roles, and `upsert`s a row for every default-on cell from `defaultPreference`. It does not delete tickets or users. Call the same upsert from `prisma/seed.ts` after roles exist. In `seed.ts`, delete `notification` then `notificationPreference` before deleting users.

- [ ] **Step 6: Apply the schema and run the tests**

Run: `npx prisma db push`

Run: `npx tsx prisma/ensure-notification-preferences.ts`

Run: `npx vitest run src/lib/notify.test.ts`

Expected: PASS. `db push` prints that the database is in sync. If `prisma generate` hits `EPERM` on `query_engine-windows.dll.node` because `next dev` holds the file, stop the dev server, run `npx prisma generate`, then start the server again. Do not run `db:reset`.

- [ ] **Step 7: Commit**

```powershell
git add prisma/schema.prisma prisma/seed.ts prisma/ensure-notification-preferences.ts src/lib/notify.ts src/lib/notify.test.ts
git commit -m @"
Add notification tables and the default role grid.

Seed only the cells that start with bell and email on, and treat a missing row as off.
"@
```

---

### Task 2: Choose recipients

**Files:**
- Modify: `src/lib/notify.ts`
- Modify: `src/lib/notify.test.ts`

**Interfaces:**
- Consumes: `defaultPreference`, `NotificationKind`, `PreferenceCell` from Task 1.
- Produces:
  - `NotifyUser = { id: string; role: RoleCode; active: boolean; email: string | null; sectionId: string | null }`
  - `NotifyTicket = { id: string; ticketNo: string; type: TicketType; requesterId: string; requesterSectionId: string | null; assigneeId: string | null; dueAt: Date | null }`
  - `StoredPreference = { role: RoleCode; kind: NotificationKind; inApp: boolean; email: boolean }`
  - `RecipientPlan = { userId: string; email: string | null; sendEmail: boolean }`
  - `selectRecipients(input: { kind: NotificationKind; ticket: NotifyTicket; actorId: string | null; users: NotifyUser[]; preferences: StoredPreference[]; alreadyNotifiedUserIds?: string[] }): RecipientPlan[]`

- [ ] **Step 1: Write the failing recipient tests**

Append this file content's imports by adding `selectRecipients` to the import from `./notify`, and add `ALL_ROLES` from `@/lib/workflow` if it is not already imported. Then append:

```ts
import type { TicketType } from "@prisma/client";
import { ALL_ROLES } from "@/lib/workflow";
import { NOTIFICATION_KINDS, defaultPreference, selectRecipients } from "./notify";

const users = [
  { id: "requester", role: "REQUESTER" as const, active: true, email: "r@example.com", sectionId: "pd" },
  { id: "em-tech", role: "EM_TECHNICIAN" as const, active: true, email: "em@example.com", sectionId: "em" },
  { id: "em-tech-2", role: "EM_TECHNICIAN" as const, active: true, email: "em2@example.com", sectionId: "em" },
  { id: "em-tech-off", role: "EM_TECHNICIAN" as const, active: false, email: "off@example.com", sectionId: "em" },
  { id: "it-tech", role: "IT_TECHNICIAN" as const, active: true, email: "it@example.com", sectionId: "it" },
  { id: "em-manager", role: "EM_MANAGER" as const, active: true, email: "mgr@example.com", sectionId: "em" },
  { id: "section-manager", role: "SECTION_MANAGER" as const, active: true, email: "sm@example.com", sectionId: "pd" },
  { id: "other-section-manager", role: "SECTION_MANAGER" as const, active: true, email: "sm2@example.com", sectionId: "em" },
];

function prefs() {
  return ALL_ROLES.flatMap((role) =>
    NOTIFICATION_KINDS.map((kind) => ({ role, kind, ...defaultPreference(role, kind) })),
  );
}

function ticket(type: TicketType, extra: Partial<{ assigneeId: string | null; requesterSectionId: string | null }> = {}) {
  return {
    id: "ticket-1",
    ticketNo: "EM-1",
    type,
    requesterId: "requester",
    requesterSectionId: extra.requesterSectionId === undefined ? "pd" : extra.requesterSectionId,
    assigneeId: extra.assigneeId === undefined ? null : extra.assigneeId,
    dueAt: new Date("2026-10-01T00:00:00.000Z"),
  };
}

describe("selectRecipients", () => {
  it("notifies active EM technicians for a new machine ticket, excluding the actor", () => {
    const plans = selectRecipients({
      kind: "CREATED",
      ticket: ticket("MACHINE"),
      actorId: "requester",
      users,
      preferences: prefs(),
    });
    expect(plans.map((plan) => plan.userId).sort()).toEqual(["em-tech", "em-tech-2"]);
    expect(plans.every((plan) => plan.sendEmail)).toBe(true);
  });

  it("notifies only IT technicians for a new IT ticket", () => {
    const plans = selectRecipients({
      kind: "CREATED",
      ticket: ticket("IT"),
      actorId: "requester",
      users,
      preferences: prefs(),
    });
    expect(plans.map((plan) => plan.userId)).toEqual(["it-tech"]);
  });

  it("notifies the requester for claim, complete, and reject, and nobody for accept", () => {
    for (const kind of ["CLAIMED", "COMPLETED", "REJECTED"] as const) {
      const plans = selectRecipients({
        kind,
        ticket: ticket("STAFF"),
        actorId: "em-tech",
        users,
        preferences: prefs(),
      });
      expect(plans.map((plan) => plan.userId)).toEqual(["requester"]);
    }
    expect(
      selectRecipients({
        kind: "ACCEPTED",
        ticket: ticket("STAFF"),
        actorId: "em-tech",
        users,
        preferences: prefs(),
      }),
    ).toEqual([]);
  });

  it("limits claimed overdue to the active assignee and fans out when unclaimed", () => {
    const claimed = selectRecipients({
      kind: "OVERDUE",
      ticket: ticket("STAFF", { assigneeId: "em-tech" }),
      actorId: null,
      users,
      preferences: prefs(),
    });
    expect(claimed.map((plan) => plan.userId)).toEqual(["em-tech"]);

    const unclaimed = selectRecipients({
      kind: "OVERDUE",
      ticket: ticket("STAFF"),
      actorId: null,
      users,
      preferences: prefs(),
    });
    expect(unclaimed.map((plan) => plan.userId).sort()).toEqual(["em-tech", "em-tech-2"]);
  });

  it("does not notify an inactive assignee", () => {
    const plans = selectRecipients({
      kind: "OVERDUE",
      ticket: ticket("STAFF", { assigneeId: "em-tech-off" }),
      actorId: null,
      users,
      preferences: prefs(),
    });
    expect(plans).toEqual([]);
  });

  it("suppresses a recipient who already has this due instant", () => {
    const plans = selectRecipients({
      kind: "OVERDUE",
      ticket: ticket("STAFF", { assigneeId: "em-tech" }),
      actorId: null,
      users,
      preferences: prefs(),
      alreadyNotifiedUserIds: ["em-tech"],
    });
    expect(plans).toEqual([]);
  });

  it("adds EM managers only for EM ticket types when that cell is on", () => {
    const preferences = prefs().map((cell) =>
      cell.role === "EM_MANAGER" && cell.kind === "CREATED"
        ? { ...cell, inApp: true, email: true }
        : cell,
    );
    const machine = selectRecipients({
      kind: "CREATED",
      ticket: ticket("MACHINE"),
      actorId: "requester",
      users,
      preferences,
    });
    expect(machine.map((plan) => plan.userId)).toContain("em-manager");
    const it = selectRecipients({
      kind: "CREATED",
      ticket: ticket("IT"),
      actorId: "requester",
      users,
      preferences,
    });
    expect(it.map((plan) => plan.userId)).not.toContain("em-manager");
  });

  it("notifies a technician on accept only after that cell is turned on", () => {
    const preferences = prefs().map((cell) =>
      cell.role === "EM_TECHNICIAN" && cell.kind === "ACCEPTED"
        ? { ...cell, inApp: true, email: false }
        : cell,
    );
    const plans = selectRecipients({
      kind: "ACCEPTED",
      ticket: ticket("ELECTRIC", { assigneeId: "em-tech" }),
      actorId: "requester",
      users,
      preferences,
    });
    expect(plans).toEqual([{ userId: "em-tech", email: "em@example.com", sendEmail: false }]);
  });

  it("limits section managers to the requester section", () => {
    const preferences = prefs().map((cell) =>
      cell.role === "SECTION_MANAGER" && cell.kind === "CREATED"
        ? { ...cell, inApp: true, email: true }
        : cell,
    );
    const matched = selectRecipients({
      kind: "CREATED",
      ticket: ticket("STAFF"),
      actorId: "em-tech",
      users,
      preferences,
    });
    expect(matched.map((plan) => plan.userId)).toContain("section-manager");
    expect(matched.map((plan) => plan.userId)).not.toContain("other-section-manager");
    const missing = selectRecipients({
      kind: "CREATED",
      ticket: ticket("STAFF", { requesterSectionId: null }),
      actorId: "em-tech",
      users,
      preferences,
    });
    expect(missing.map((plan) => plan.userId)).not.toContain("section-manager");
  });

  it("skips email when the switch is off or the address is blank", () => {
    const preferences = prefs().map((cell) =>
      cell.role === "EM_TECHNICIAN" && cell.kind === "CREATED"
        ? { ...cell, inApp: true, email: false }
        : cell,
    );
    const switchedOff = selectRecipients({
      kind: "CREATED",
      ticket: ticket("STAFF"),
      actorId: "requester",
      users,
      preferences,
    });
    expect(switchedOff.every((plan) => plan.sendEmail === false)).toBe(true);
    const blank = selectRecipients({
      kind: "CREATED",
      ticket: ticket("STAFF"),
      actorId: "requester",
      users: users.map((user) => (user.id === "em-tech" ? { ...user, email: "  " } : user)),
      preferences: prefs(),
    });
    expect(blank.find((plan) => plan.userId === "em-tech")?.sendEmail).toBe(false);
    expect(blank.find((plan) => plan.userId === "em-tech-2")?.sendEmail).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/notify.test.ts`

Expected: FAIL because `selectRecipients` is not exported.

- [ ] **Step 3: Implement `selectRecipients`**

Add this to `src/lib/notify.ts`. Import `RoleCode` and `TicketType` from `@prisma/client`.

```ts
const EM_TYPES: TicketType[] = ["MACHINE", "ELECTRIC", "STAFF"];
const TECH_ROLES: RoleCode[] = ["EM_TECHNICIAN", "IT_TECHNICIAN"];

export function selectRecipients(input: {
  kind: NotificationKind;
  ticket: NotifyTicket;
  actorId: string | null;
  users: NotifyUser[];
  preferences: StoredPreference[];
  alreadyNotifiedUserIds?: string[];
}): RecipientPlan[] {
  const seen = new Set(input.alreadyNotifiedUserIds ?? []);
  const plans: RecipientPlan[] = [];
  for (const user of input.users) {
    if (!user.active || user.id === input.actorId || seen.has(user.id)) continue;
    const preference = input.preferences.find(
      (cell) => cell.role === user.role && cell.kind === input.kind && cell.inApp,
    );
    if (!preference) continue;
    if (!roleMatchesTicket(user, input.ticket)) continue;
    if (
      input.kind === "OVERDUE" &&
      TECH_ROLES.includes(user.role) &&
      input.ticket.assigneeId &&
      user.id !== input.ticket.assigneeId
    ) {
      continue;
    }
    seen.add(user.id);
    const email = user.email?.trim() ? user.email.trim() : null;
    plans.push({
      userId: user.id,
      email,
      sendEmail: Boolean(preference.email && email),
    });
  }
  return plans;
}

function roleMatchesTicket(user: NotifyUser, ticket: NotifyTicket): boolean {
  if (user.role === "REQUESTER") return user.id === ticket.requesterId;
  if (user.role === "SECTION_MANAGER") {
    return Boolean(user.sectionId && user.sectionId === ticket.requesterSectionId);
  }
  if (user.role === "EM_MANAGER" || user.role === "EM_TECHNICIAN") {
    return EM_TYPES.includes(ticket.type);
  }
  if (user.role === "IT_MANAGER" || user.role === "IT_TECHNICIAN") {
    return ticket.type === "IT";
  }
  return user.role === "GM" || user.role === "ADMIN";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/notify.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/notify.ts src/lib/notify.test.ts
git commit -m @"
Select notification recipients from the role grid.

Keep the line split, skip the actor, and limit claimed overdue mail to the assignee.
"@
```

---

### Task 3: Write rows from ticket actions

**Files:**
- Create: `src/lib/notify-deliver.ts`
- Create: `src/lib/notify-deliver.test.ts`
- Modify: `src/app/actions.ts`
- Modify: `src/app/actions.test.ts`

**Interfaces:**
- Consumes: `selectRecipients`, `kindForAction`, `NotifyTicket`, `NotifyUser`, `StoredPreference`, `RecipientPlan`.
- Produces:
  - `deliverNotifications(db: NotifyDb, input: { kind: NotificationKind; ticket: NotifyTicket; actorId: string | null }): Promise<RecipientPlan[]>`
  - `NotifyDb` is the subset of Prisma used here: `user.findMany`, `notificationPreference.findMany` including `role.code`, `notification.findMany` for overdue, `notification.createMany`.
  - Callers in this task ignore the returned plans. Task 6 sends email from that array after the ticket transaction commits.

- [ ] **Step 1: Write the failing deliver test**

Create `src/lib/notify-deliver.test.ts` with a fake `db`. For a `CREATED` `STAFF` ticket, `user.findMany` returns one active `EM_TECHNICIAN` with an email and one inactive technician. Preferences contain the default-on `EM_TECHNICIAN` / `CREATED` cell. Expect `notification.createMany` once with `kind: "CREATED"`, `dueAt: null`, and only the active technician's id. Expect the create to happen, and do not call a mailer in this task.

Add a second test: `kind: "OVERDUE"` with `dueAt` set and an existing notification for that recipient and due instant. Expect `createMany` not to be called.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/notify-deliver.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement delivery of rows**

`deliverNotifications` loads active and inactive users with `role.code`, `email`, and `sectionId`, loads every preference with its role code, and for `OVERDUE` loads existing rows for the same `ticketId`, `kind: "OVERDUE"`, and `dueAt`. It calls `selectRecipients`. When the plan is empty it returns without `createMany`. Otherwise `createMany` writes `recipientId`, `ticketId`, `kind`, and `dueAt` (`ticket.dueAt` for `OVERDUE`, otherwise null).

- [ ] **Step 4: Call delivery from the ticket actions**

In `createTicketAction`, change `prisma.ticket.create` into `prisma.$transaction`. Inside the transaction, create the ticket, then call `deliverNotifications` with the transaction client, `kind: "CREATED"`, `actorId: session.id`, and a `NotifyTicket` whose `requesterSectionId` is `user.sectionId`. Photo attachment writes stay after the transaction, as they do now. If `ticket.create` throws, the transaction rolls back and no notice row remains.

In `applyTransitionAction`, after the transition is allowed, map `kindForAction(rule.actionCode)`. When it returns null, keep the current `ticket.update` and do not deliver. When it returns a kind, run `ticket.update` and `deliverNotifications` in one `prisma.$transaction`. The assignee passed to `selectRecipients` is `rule.assignOnTake ? auth.session.id : ticket.assigneeId`. `requesterId` stays `ticket.requesterId`. Load the requester's `sectionId` with the ticket (`include: { requester: true }`) and pass it as `requesterSectionId`.

- [ ] **Step 5: Extend the action tests**

In `src/app/actions.test.ts`, add `notification.createMany`, `notification.findMany`, `notificationPreference.findMany`, and `user.findMany` to the Prisma mock. Default `user.findMany` to `[]` and `findMany` preference and notification queries to `[]` in `beforeEach`, so existing tests still redirect without writing notices.

Add one test that returns an active `EM_TECHNICIAN` and a `CREATED` preference with both switches on, then expects `notification.createMany` to have been called with that user. Add one test that makes `ticket.create` reject and expects `notification.createMany` not to have been called.

`prisma.$transaction` in the mock should run the callback with the same `mocks.prisma` object and return its result.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib/notify-deliver.test.ts src/app/actions.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/notify-deliver.ts src/lib/notify-deliver.test.ts src/app/actions.ts src/app/actions.test.ts
git commit -m @"
Write in-app notices in the ticket create and transition actions.

Roll the notice rows back when the ticket write fails.
"@
```

---

### Task 4: Bell, notice list, and mark read

**Files:**
- Create: `src/app/notifications/page.tsx`
- Create: `src/app/notifications/actions.ts`
- Modify: `src/components/Nav.tsx`
- Modify: `src/app/tickets/[id]/page.tsx`

**Interfaces:**
- Consumes: `notificationMessage` is not required on the page; the stored event is rendered with `notificationMessage(kind, ticket.ticketNo)` at read time so the sentence stays the spec text.
- Produces:
  - `markAllNotificationsReadAction(): Promise<void>`
  - Page route `/notifications`
  - Ticket query `notice` marks one row read

- [ ] **Step 1: Add the list page and mark-all action**

`src/app/notifications/page.tsx` calls `requireSession` and redirects to `/login` when missing. It loads `prisma.notification.findMany` where `recipientId` is `auth.session.id`, includes `ticket: { select: { ticketNo: true } }`, and orders by `createdAt desc`. Render `Nav`, the heading `การแจ้งเตือน`, and a form whose action is `markAllNotificationsReadAction` with button `อ่านทั้งหมด`. Each row shows `notificationMessage`, `formatWhen(createdAt)`, and a link to `/tickets/${ticketId}?notice=${id}`. Rows with `readAt` null use a stronger text color; read rows stay on the page. An empty list says `ยังไม่มีการแจ้งเตือน`.

`markAllNotificationsReadAction` requires a session, `updateMany` where `recipientId` is the session user and `readAt` is null, sets `readAt` to `new Date()`, then `redirect("/notifications")`.

- [ ] **Step 2: Mark one notice read from the ticket link**

In `src/app/tickets/[id]/page.tsx`, read `notice` from `searchParams`. When it is a non-empty string, `updateMany` where `id` is that value, `recipientId` is `auth.session.id`, and `readAt` is null. A notice id owned by someone else updates zero rows.

- [ ] **Step 3: Show the unread count on the nav**

Change `Nav` to an async server component. Count notifications where `recipientId` is `user.id` and `readAt` is null. Add a link to `/notifications` labeled `แจ้งเตือน` with the count in parentheses when it is greater than zero. Place it before the user chip. Use the same link classes as `ใบงานของฉัน`.

- [ ] **Step 4: Run the unit tests and typecheck the new pages**

Run: `npx vitest run`

Run: `npx tsc --noEmit`

Expected: existing tests PASS and `tsc` prints nothing.

The list is a server page with no pure branch to unit test. Confirm later in the browser that a signed-in user sees only their rows, the ticket link clears that row's unread state, `อ่านทั้งหมด` clears the badge, and another user's `notice` id does not mark their row.

- [ ] **Step 5: Commit**

```powershell
git add src/app/notifications/page.tsx src/app/notifications/actions.ts src/components/Nav.tsx src/app/tickets/[id]/page.tsx
git commit -m @"
Show each user's notices and unread count.

Opening a notice link marks that row read, and mark-all clears only the current user.
"@
```

---

### Task 5: Admin bell and email grid

**Files:**
- Create: `src/app/admin/notifications/page.tsx`
- Create: `src/app/admin/notifications/actions.ts`
- Modify: `src/lib/notify.ts`
- Modify: `src/lib/notify.test.ts`
- Modify: `src/components/Nav.tsx`

**Interfaces:**
- Consumes: `ALL_ROLES`, `ROLE_LABEL`, `NOTIFICATION_KINDS`, `KIND_LABEL`, `normalizePreference`.
- Produces:
  - `parsePreferenceForm(formData: FormData): StoredPreference[]`
  - `saveNotificationPreferencesAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Write the failing form parser test**

Append a test that builds `FormData` with `inApp:EM_MANAGER:CREATED=on` and `email:EM_MANAGER:CREATED=on`, plus `inApp:REQUESTER:ACCEPTED` absent and `email:REQUESTER:ACCEPTED=on`. Expect the `EM_MANAGER` / `CREATED` cell on for both, and the `REQUESTER` / `ACCEPTED` cell off for both because the bell checkbox was omitted. Expect one entry per role and kind (48).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/notify.test.ts`

Expected: FAIL because `parsePreferenceForm` is not exported.

- [ ] **Step 3: Implement the parser and the admin page**

`parsePreferenceForm` loops `ALL_ROLES` and `NOTIFICATION_KINDS`. A checkbox is on only when `formData.get(\`inApp:${role}:${kind}\`) === "on"` or the email field equals `"on"`. Pass both flags through `normalizePreference`.

`saveNotificationPreferencesAction` calls `requireAdmin`, parses the form, and upserts all 48 `NotificationPreference` rows by `roleId_kind` after looking up role ids. Redirect to `/admin/notifications`.

The page calls `requireAdmin`, loads roles and preferences, and renders a table. Columns are `ROLE_LABEL`. Rows are `KIND_LABEL`. Each cell has two checkboxes, `กระดิ่ง` and `อีเมล`, with the field names above. Checked state comes from the stored row, or both unchecked when the row is missing. The submit button says `บันทึก`. Copy under the heading says `ปิดกระดิ่งแล้วอีเมลของช่องนั้นจะถูกปิดด้วย`.

Add a nav link `การแจ้งเตือน` to `/admin/notifications` next to `ผู้ใช้`, visible only when `user.role === "ADMIN"`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/notify.test.ts`

Run: `npx tsc --noEmit`

Expected: PASS and a clean typecheck.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/notify.ts src/lib/notify.test.ts src/app/admin/notifications/page.tsx src/app/admin/notifications/actions.ts src/components/Nav.tsx
git commit -m @"
Let admins switch notification bell and email by role.

Saving the grid turns email off wherever the bell is off.
"@
```

---

### Task 6: Send email after the row is stored

**Files:**
- Create: `src/lib/notify-mail.ts`
- Create: `src/lib/notify-mail.test.ts`
- Modify: `src/lib/notify-deliver.ts`
- Modify: `src/lib/notify-deliver.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `notificationMessage`, `RecipientPlan`.
- Produces:
  - `smtpConfigured(env: NodeJS.ProcessEnv): boolean`
  - `sendNotificationEmail(input: { to: string; ticketId: string; body: string }, env: NodeJS.ProcessEnv, transport: { sendMail: (message: object) => Promise<unknown> }): Promise<{ ok: true } | { ok: false; error: string }>`
  - `deliverNotifications` now also updates `emailSentAt` or `emailError` after `createMany`.

- [ ] **Step 1: Write the failing mail tests**

Cover a blank address returning `{ ok: false, error: "no-address" }` without calling `sendMail`. Cover missing `SMTP_HOST` returning `{ ok: false, error: "smtp-unset" }` without calling `sendMail`. Cover a thrown `sendMail` returning `{ ok: false, error: "down" }`. Cover a successful send calling `sendMail` with `to`, subject equal to the body, and text containing `${APP_URL}/tickets/${ticketId}`. `smtpConfigured` is true only when all six variables are non-empty: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `APP_URL`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/notify-mail.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Install nodemailer and implement the sender**

Run: `npm install nodemailer`

Run: `npm install -D @types/nodemailer`

`sendNotificationEmail` returns `no-address` before the SMTP check when `to.trim()` is empty. It returns `smtp-unset` when `smtpConfigured` is false. Otherwise it `sendMail`s and returns `{ ok: true }`, or `{ ok: false, error }` from a thrown `Error.message`. The real transport is created only in `createSmtpTransport(env)` via `nodemailer.createTransport` and is not used by the unit tests.

- [ ] **Step 4: Send after the rows commit**

Extend `deliverNotifications` so `createMany` finishes before any SMTP call. Then, for each plan with `sendEmail` true, call `sendNotificationEmail`. On `{ ok: true }`, set `emailSentAt`. On `{ ok: false }` with an error other than `no-address`, set `emailError`. Do not delete the row. The ticket transaction must not include these updates: perform them with the root `prisma` client after `deliverNotifications` returns the created plans, or pass a separate `afterCommit` client. The simplest shape that keeps the tests honest is for `deliverNotifications` to accept `mail?: { send: typeof sendNotificationEmail }` and, when `db` is a transaction, document that callers pass the mailer only after the transaction resolves.

Do it this way instead: `deliverNotifications` returns `RecipientPlan[]` plus the ticket id and kind. `createTicketAction` and `applyTransitionAction` await the transaction, then call `sendDeliveredEmails(plans, ticket)` which updates the matching notification row. A failure in `sendMail` does not throw to the action.

Update the deliver test: a plan with `sendEmail: false` does not call the mailer. A plan with `sendEmail: true` whose mailer throws still leaves the created row and writes `emailError`. A missing SMTP result writes `emailError: "smtp-unset"`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/notify-mail.test.ts src/lib/notify-deliver.test.ts src/app/actions.test.ts`

Expected: PASS. Action tests that do not set a mailer must not throw.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json src/lib/notify-mail.ts src/lib/notify-mail.test.ts src/lib/notify-deliver.ts src/lib/notify-deliver.test.ts src/app/actions.ts src/app/actions.test.ts
git commit -m @"
Send one notification email after the in-app row is stored.

Keep the ticket and the notice when SMTP is missing or the send fails.
"@
```

---

### Task 7: Overdue scanner

**Files:**
- Create: `src/lib/notify-scan.ts`
- Create: `src/lib/notify-scan.test.ts`
- Create: `scripts/notifications-scan.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `selectRecipients`, `deliverNotifications`, `sendDeliveredEmails`.
- Produces:
  - `assertScanSecret(env: NodeJS.ProcessEnv): void`
  - `scanOverdue(db: NotifyDb, now: Date): Promise<Array<{ ticketId: string; dueAt: Date; plans: RecipientPlan[] }>>`
  - CLI `npm run notifications:scan`

- [ ] **Step 1: Write the failing scanner tests**

`assertScanSecret({})` throws `Error` whose message includes `NOTIFY_CRON_SECRET`. `assertScanSecret({ NOTIFY_CRON_SECRET: "local" })` does not throw.

`scanOverdue` with a fake db:

- A ticket with `closedAt` set is not passed to recipient selection. Assert no `notification.createMany`.
- A ticket with `dueAt` in the future is ignored.
- A ticket with `dueAt: null` is ignored.
- An open ticket with `dueAt` before `now` and no assignee writes one overdue row per active line technician and copies that `dueAt`.
- The same ticket, when those recipients already have overdue rows for that `dueAt`, writes nothing.
- After `dueAt` changes, a recipient who only has a row for the old instant gets one new row.
- A role whose `OVERDUE` bell is off in the first call and on in the second call receives a row on the second call while the ticket is still open and past the same `dueAt`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/notify-scan.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the scan and the command**

`scanOverdue` queries tickets where `closedAt` is null, `dueAt` is not null, and `dueAt` is less than `now`. It includes `requester.sectionId` and `assignee`. For each ticket it calls `deliverNotifications` with `kind: "OVERDUE"` and `actorId: null`. It returns the tickets that produced at least one plan.

`scripts/notifications-scan.ts` calls `assertScanSecret(process.env)` first and `process.exit(1)` when it throws, before constructing a `PrismaClient`. Otherwise it scans, calls `sendDeliveredEmails` for the returned plans, disconnects Prisma, and exits 0.

Add `"notifications:scan": "tsx scripts/notifications-scan.ts"` to `package.json` scripts.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/notify-scan.test.ts src/lib/notify.test.ts src/lib/notify-deliver.test.ts`

Expected: PASS.

Do not start a `setInterval` inside Next.js. Document in the script's top comment that Windows Task Scheduler should run `npm run notifications:scan` at least once a minute from `apps/repair`, with `NOTIFY_CRON_SECRET` set in that task's environment.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/notify-scan.ts src/lib/notify-scan.test.ts scripts/notifications-scan.ts package.json
git commit -m @"
Scan open tickets once per due instant for overdue notices.

Require the local scan secret before reading tickets, and leave scheduling to Task Scheduler.
"@
```

---

### Task 8: Verify the whole slice

**Files:**
- No new product files unless a test or typecheck shows a break.

**Interfaces:**
- Consumes every export from Tasks 1–7.

- [ ] **Step 1: Run the full test file and the typecheck**

Run: `npx vitest run`

Run: `npx tsc --noEmit`

Expected: all tests PASS and `tsc` prints nothing.

- [ ] **Step 2: Check the running app in the browser**

Restart `npm run dev -- -p 3001` if it is not already up. Do not run `next build` while that process owns `.next`.

Sign in as `admin` / `admin123`. Open `/admin/notifications` and confirm the default cells are checked for both switches, `ตรวจรับ` is unchecked, and saving with the EM technician email box cleared leaves the bell on. Turn `ใบงานใหม่` on for `EM Manager`, save, and sign out.

Sign in as `requester` / `requester123`. Create a staff ticket with a future due date. Sign in as `tech` / `tech123` and confirm `/notifications` shows `มีใบงานใหม่` and the nav count. Open the ticket from that row and confirm the count drops. Sign in as `emmgr` / `emmgr123` and confirm that manager also received the new-ticket notice. Sign back in as the requester, accept nothing yet, and have `tech` claim the ticket. The requester's list shows `ถูกรับงานแล้ว`. The technician who clicked claim does not get that row.

- [ ] **Step 3: Commit only if Step 1 or Step 2 forced a code fix**

If nothing changed, leave the tree clean. If a fix was required, commit that fix with a message that says what broke.
