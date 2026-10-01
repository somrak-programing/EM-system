# TCPR Notifications Design

In-app notifications plus email for new queue tickets, status changes, and a single overdue alert. An admin sets, per role, which of those events ring the bell and which also send email. At-risk (4-hour) warnings, PM, parts inventory, and checklist/signature stay out of scope.

## Problem

Technicians learn about new work only by opening `/queue`. Requesters learn about claim, completion, and rejection only by opening the ticket. Overdue work is visible on `/ops` for managers, but the assignee (or the line's technicians, when nobody has claimed it) is not told when `dueAt` passes.

## Channel

Every notification is stored in the app first. The nav bell and `/notifications` are the source of truth.

Email is a second copy of a row that already exists. It is sent only when all of these are true: the role's bell switch for that event is on, the role's email switch for that event is on, and the recipient's `User.email` is non-empty. The message is Thai, names the ticket number, and links to `{APP_URL}/tickets/{id}`.

Each recipient gets their own email. Five technicians with addresses receive five messages.

Missing SMTP settings, a recipient with no email, an email switch that is off, or a failed send does not roll back the ticket change or the in-app row. Failed email is not retried.

## Admin preferences

Only `ADMIN` can open `/admin/notifications`. The page is a grid. Rows are events: `CREATED`, `CLAIMED`, `COMPLETED`, `REJECTED`, `ACCEPTED`, `OVERDUE`. Columns are the eight roles: `REQUESTER`, `SECTION_MANAGER`, `EM_MANAGER`, `EM_TECHNICIAN`, `IT_MANAGER`, `IT_TECHNICIAN`, `GM`, `ADMIN`.

Each cell has two switches: in-app bell, and email. The email switch can be saved on only while the bell switch in that same cell is on. Turning the bell off stores the email switch off as well.

A missing preference row means both switches are off. Seed writes the default-on cells below so a new install matches this table. Changing a switch affects later notifications only. Rows already stored stay as they are.

Default bell and email, both on:

| Event | Roles |
|---|---|
| `CREATED` | `EM_TECHNICIAN`, `IT_TECHNICIAN` |
| `CLAIMED`, `COMPLETED`, `REJECTED` | `REQUESTER` |
| `ACCEPTED` | nobody |
| `OVERDUE` | `EM_TECHNICIAN`, `IT_TECHNICIAN` |

Every other cell defaults to off. An admin can turn those on, including `ACCEPTED` and manager roles for new tickets or overdue.

## Who receives a switched-on cell

Only active users. The user who just performed the action is removed from that action's recipient list. This exclusion is not a switch.

When a role's bell is on for the event, the people who match are:

| Role | People |
|---|---|
| `REQUESTER` | The ticket's requester |
| `SECTION_MANAGER` | Active section managers whose section is the requester's section. None, when the requester has no section |
| `EM_MANAGER`, `EM_TECHNICIAN` | Active users with that role, and only when the ticket type is `MACHINE`, `ELECTRIC`, or `STAFF` |
| `IT_MANAGER`, `IT_TECHNICIAN` | Active users with that role, and only when the ticket type is `IT` |
| `GM`, `ADMIN` | Active users with that role, for every ticket type |

`OVERDUE` adds one limit for the two technician roles. If `assigneeId` is set, those roles notify that assignee only, and only when the assignee is active and the assignee's own role has `OVERDUE` bell on. Other technicians on the line are not added. An inactive assignee produces no technician overdue row. Roles that are not technician roles still receive overdue by the table above when their own `OVERDUE` bell is on.

`CREATED` for `REQUESTER` notifies the requester only when someone else created the ticket. The creator is removed by the actor rule.

## Events

Each recipient gets their own row. One person marking an item read does not affect anyone else.

| Event | When |
|---|---|
| `CREATED` | A ticket is created into the queue |
| `CLAIMED` | `CLAIM` succeeds |
| `COMPLETED` | `COMPLETE` succeeds. The technician submitted work, `closedAt` is set, and the status is pending acceptance |
| `REJECTED` | `REJECT` succeeds. The ticket returns to the technician and `closedAt` is cleared |
| `ACCEPTED` | `ACCEPT` succeeds. The requester closed the ticket. Default recipients: nobody |
| `OVERDUE` | The scanner finds the open ticket past `dueAt` |

Status events fire on every successful action. A later `CLAIM` after `REJECT` notifies again, using the preferences in force at that moment.

Overdue is once per ticket, recipient, and exact `dueAt` instant:

- If the ticket is closed or `dueAt` is changed before the scan observes the crossing, that old deadline produces no notification.
- If a manager sets a new `dueAt`, that new instant can notify once when it is crossed.
- Recipients who already have an overdue row for this `dueAt` are not notified again. A later claim therefore does not send those people a second overdue notice.
- A recipient who has no overdue row yet for this `dueAt` can still receive one on a later scan, including a role the admin turned on after the first scan, while the ticket stays open and past that `dueAt`.

There is no notification when remaining time is 4 hours or less (`at_risk`).

## In-app bell

The nav shows a bell with the logged-in user's unread count. The bell links to `/notifications`.

Each row shows a short Thai message, the time, and a link to the ticket. Following that link marks that row read. A control on the page marks every row for the current user read. Older rows stay on the page. Nothing overlays the ticket page.

Users can read only their own rows. Other users' ids in the URL do not reveal those rows.

Messages:

- `CREATED`: `มีใบงานใหม่ {ticketNo}`
- `CLAIMED`: `{ticketNo} ถูกรับงานแล้ว`
- `COMPLETED`: `{ticketNo} รอตรวจรับ`
- `REJECTED`: `{ticketNo} ถูกส่งกลับให้แก้ไข`
- `ACCEPTED`: `{ticketNo} ตรวจรับแล้ว`
- `OVERDUE`: `{ticketNo} เลยกำหนดเสร็จ`

## When rows are written

Create, claim, complete, reject, and accept write notification rows in the same server action as the ticket write, for every recipient the preference grid selects. If that action fails, no notification row is kept. Accept writes rows only when at least one role has `ACCEPTED` bell on.

Overdue rows are written only by the scanner. The ticket actions do not scan for overdue.

## Overdue scanner

The scanner selects tickets where `closedAt` is null, `dueAt` is not null, `dueAt` is before now, and at least one selected recipient has no overdue notification yet for that ticket and that `dueAt`.

The scanner is a local command, `npm run notifications:scan`. It reads `NOTIFY_CRON_SECRET` from the environment and exits without writing rows when the secret is missing. It is not an unauthenticated public URL. On this machine, Windows Task Scheduler runs that command at least once a minute. The Next.js process does not start its own timer.

## Email

SMTP settings are `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. When those settings are absent, the app keeps the in-app row and skips email.

The message is Thai, names the ticket number, states the same fact as the in-app text, and links to `{APP_URL}/tickets/{id}`.

Send email only after the notification row is committed, and only for recipients whose role has the email switch on for that event. A slow or failed SMTP call must not sit inside the ticket transaction.

## Data

`NotificationPreference` stores one row per role and event:

- role id
- kind: `CREATED`, `CLAIMED`, `COMPLETED`, `REJECTED`, `ACCEPTED`, `OVERDUE`
- in-app boolean
- email boolean

Uniqueness is `(roleId, kind)`.

`Notification` stores:

- recipient user id
- ticket id
- kind, same six values
- `dueAt` snapshot, required for `OVERDUE` and null otherwise
- created time
- read time, null until read
- optional email sent time and optional email error text

Overdue uniqueness is `(ticketId, dueAt, recipientId, kind=OVERDUE)`. Status and created rows are not unique for the life of the ticket, because the same action can happen again after rejection.

## Error handling

- Ticket action fails: no notification for that attempt.
- Bell switch off for every matching role: no row.
- Recipient inactive: no row.
- Email switch off, or the recipient has no email: keep the in-app row, skip email.
- SMTP unset or send throws: ticket and in-app row stay committed; store the email error; do not retry.
- Scanner secret missing: exit before reading tickets.
- Legacy ticket with null `dueAt`: the scanner ignores it.
- A non-admin opening `/admin/notifications` is sent away the same way as the other admin pages.

## Out of scope

At-risk warnings, repeat overdue reminders, per-user preference pages, LINE, SMS, digest emails, automatic email retry, push notifications, and a separate worker queue.

## Testing

Pure tests cover recipient selection with the default grid: EM versus IT line, inactive users excluded, actor excluded, requester notified on claim, complete, and reject, nobody notified on accept, assignee-only overdue for technician roles, unclaimed overdue to the whole technician line, and a second overdue suppressed for a recipient who already has a row for that `dueAt`.

Preference tests cover an admin turning email off for line technicians so a new ticket still writes the in-app row and sends no mail, turning `CREATED` on for `EM_MANAGER` so those managers are added for an EM ticket, turning `ACCEPTED` on for `EM_TECHNICIAN` so the technician is notified, and a section manager receiving only tickets from their own section.

Action tests assert a created ticket writes technician rows and a failed create writes none.

Scanner tests assert a closed ticket and a still-future `dueAt` produce nothing, a crossed `dueAt` writes once, a changed `dueAt` can write once more, and a role enabled after the first overdue scan receives a row on the next scan while that deadline is still open.

Email tests assert no address, email switch off, or missing SMTP skips send without removing the row, and a thrown send records the error and keeps the row.

## Done when

A technician sees a bell count for a new ticket in their line and can open it from `/notifications`. The requester is notified on claim, complete, and reject, and not on their own accept, under the default grid. An open ticket notifies once when `dueAt` passes: the assignee if there is one, otherwise the line technicians, plus any other role the admin has switched on. An admin can turn email off for a role that already receives the bell, and can turn the bell on for a role that the default grid skips. Email goes out only when that switch is on, the user has an address, and SMTP is configured. A failed email leaves the in-app notice in place.
