# TCPR Ops Command Center Design

Wave 1 of the maintenance-system gap list: urgency, calendar due date, SLA status, and a manager command center. Later waves (notifications, PM, parts, checklist/signature) are out of scope.

## Problem

TCPR already stores `priority`, `dueAt`, `startedAt`, and `closedAt` on `Ticket`, but requesters cannot set urgency or due date at create time, technicians set `dueAt` on complete (the wrong moment), and nobody has a plant-level view of backlog, overdue work, or MTTR.

## Audience and access

Roles that may open `/ops` and change due date / priority on a ticket:

- `SECTION_MANAGER` — tickets whose `sectionId` matches the manager’s section
- `EM_MANAGER`, `IT_MANAGER`, `GM`, `ADMIN` — all tickets

Everyone else who hits `/ops` or the update action is rejected on the server (redirect to `/tickets` or a forbidden error). Hiding the nav link is not sufficient.

Technicians keep `/queue`. Requesters keep `/tickets`. Both surfaces show urgency and due-date badges; they do not get the command center.

## Clock rules

- **Due date (`dueAt`)** is a calendar completion deadline. The requester must set it when creating a ticket. A manager may change it until the ticket reaches `ACCEPTED`. After `ACCEPTED`, both `priority` and `dueAt` are frozen.
- **Overdue** uses wall-clock time against `dueAt`, even if a technician has not claimed the ticket yet (`startedAt` is null).
- **MTTR** is the mean of `closedAt - startedAt` for tickets that have both timestamps in the selected window. `closedAt` is written on `COMPLETE` (technician submits work). Requester `ACCEPT` time is not part of MTTR.
- No SLA policy table, no business-hours calendar, no pause clock.

`dueAt` is removed from the technician COMPLETE form so there is a single source of truth.

## SLA states (computed, not stored)

Pure functions in `src/lib/sla.ts` take the ticket timestamps and `now`. Existing tickets with a null `dueAt` are valid and map to `none`.

| Code | Thai label | Rule |
|------|------------|------|
| `none` | ไม่มีกำหนด | `dueAt` is null |
| `on_track` | ตามแผน | not yet COMPLETE and `now < dueAt` and remaining time > 4 hours |
| `at_risk` | ใกล้ครบ | not yet COMPLETE and remaining time ≤ 4 hours and `now <= dueAt` |
| `overdue` | เลยกำหนด | not yet COMPLETE and `now > dueAt` |
| `on_time` | ทัน | `closedAt` present and `closedAt <= dueAt` |
| `late` | ช้า | `closedAt` present and `closedAt > dueAt` |

“COMPLETE” here means `closedAt` is set (technician submit). A ticket in `PENDING_ACCEPTANCE` or `ACCEPTED` therefore uses `on_time` / `late`, not `overdue`.

## Create and edit

On `/tickets/new`:

- `priority` is required: `NORMAL` or `URGENT` (no extra levels).
- `dueAt` is required and must be strictly in the future at submit time.
- Due-date quick picks are «พรุ่งนี้» and «อีก 3 วัน». There is no «วันนี้» shortcut because `datetime-local` stores minute precision and a current-minute value would immediately violate the strict-future rule.

On `/tickets/[id]`:

- Everyone who can see the ticket sees current priority, due date, and SLA badge.
- Managers (per audience rules) get a form to change `priority` and `dueAt` while status is not `ACCEPTED`.
- Each successful change writes a `TicketEvent` with `action` `PRIORITY_CHANGE` or `DUE_CHANGE` and a note of old → new value. The existing timeline on the detail page shows these events.

A section manager cannot update another section’s ticket.

## Command center `/ops`

Layout, top to bottom:

1. Filters: ticket type, priority, SLA state, and a 7 / 30 day window. Type, priority, and SLA state apply to every widget. The window applies only to MTTR and on-time percent (tickets whose `closedAt` falls in the window). Queued / in-progress / overdue counts, the backlog chart, and the kanban are **current open work**, not limited by the window — otherwise old queued tickets would vanish from the board.
2. Five KPI chips: queued count, in-progress count, overdue count, MTTR for the window, on-time complete percent for tickets whose `closedAt` falls in the window.
3. Two charts: open backlog by ticket type (current open work); MTTR by ticket type (window).
4. Kanban with three columns only: queued (`QUEUED`), in progress (`IN_PROGRESS`), pending acceptance (`PENDING_ACCEPTANCE`). Accepted tickets are omitted from the board (they still feed MTTR / on-time percent). Cards show ticket number, type, priority, due date, SLA badge. Clicking a card goes to `/tickets/[id]`. Cards are not draggable.

`SECTION_MANAGER` queries are always constrained by `sectionId`. Other ops roles see the whole plant.

The nav label is «ภาพรวมงาน» and appears only for ops roles.

## Explicitly out of scope

Notifications, PM schedules, parts inventory, checklists, signatures, CSV/Excel export, history windows longer than 30 days, per-shift or per-technician charts, drag-and-drop status changes.

## Error handling

- Create without due date, or with a due date in the past: reject, show a form error, do not write the ticket.
- Non-ops user on `/ops` or on the update action: redirect / reject.
- Section manager on another section’s ticket: reject.
- Update after `ACCEPTED`: reject.
- Missing `dueAt` on legacy tickets: SLA `none`; they do not increment overdue.

## Testing

Vitest on the pure SLA/MTTR helpers covers all six states, including unclaimed-but-overdue, MTTR skipping tickets without `startedAt` or `closedAt`, and on-time percent counting only tickets closed in the window. Authorization tests cover ops vs technician vs section-scoped manager.

## Done when

- Requesters set priority and due date at create.
- Ops roles see `/ops` with KPIs, two charts, kanban, and shared filters, scoped correctly.
- Ops roles can edit priority and due date on open tickets, with timeline events.
- Technicians see badges on queue and lists but cannot open `/ops`.
