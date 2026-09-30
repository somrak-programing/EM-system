# TCPR Notifications Design

In-app notifications plus email for new queue tickets, status changes, and a single overdue alert. At-risk (4-hour) warnings, PM, parts inventory, and checklist/signature stay out of scope.

## Problem

Technicians learn about new work only by opening `/queue`. Requesters learn about claim, completion, and rejection only by opening the ticket. Overdue work is visible on `/ops` for managers, but the assignee (or the line's technicians, when nobody has claimed it) is not told when `dueAt` passes.

## Channel

Every notification is stored in the app first. The nav bell and `/notifications` are the source of truth.

If the recipient's `User.email` is non-empty, the app also sends one Thai email with the ticket number and a link to `/tickets/[id]`. The link origin comes from `APP_URL`.

Missing SMTP settings, a recipient with no email, or a failed send does not roll back the ticket change or the in-app row. Failed email is not retried.

## Audience

Line technicians:

- `MACHINE`, `ELECTRIC`, and `STAFF` tickets go to active users whose role is `EM_TECHNICIAN`.
- `IT` tickets go to active users whose role is `IT_TECHNICIAN`.

Inactive users are skipped. Managers, GM, admin, and the requester's section manager do not receive new-ticket or overdue notifications.

The user who just performed the action is never a recipient of that action.

## Events

Each recipient gets their own row. One person marking an item read does not affect anyone else.

| Event | Recipients |
|---|---|
| Ticket created into the queue | Active line technicians, excluding the creator |
| `CLAIM`, `COMPLETE`, or `REJECT` | The requester, when the requester is not the actor |
| `ACCEPT` | Nobody |
| `dueAt` crossed, ticket still open, `assigneeId` set | That assignee, once for this `dueAt` |
| `dueAt` crossed, ticket still open, no assignee | Active line technicians, once for this `dueAt` |

`COMPLETE` is the technician submitting work (`closedAt` is set, status becomes pending acceptance). `REJECT` sends the ticket back to the technician and clears `closedAt`. `ACCEPT` is the requester closing the ticket and produces no notification.

Status events fire on every successful action. A later `CLAIM` after `REJECT` notifies the requester again.

Overdue is once per ticket plus the exact `dueAt` instant:

- If the ticket is closed or `dueAt` is changed before the scan observes the crossing, that old deadline produces no notification.
- If a manager sets a new `dueAt`, that new instant can notify once when it is crossed.
- If an unclaimed ticket already produced overdue rows for this `dueAt`, a later claim does not send another overdue notice for the same instant.

There is no notification when remaining time is 4 hours or less (`at_risk`).

## In-app bell

The nav shows a bell with the logged-in user's unread count. The bell links to `/notifications`.

Each row shows a short Thai message, the time, and a link to the ticket. Following that link marks that row read. A control on the page marks every row for the current user read. Older rows stay on the page. Nothing overlays the ticket page.

Users can read only their own rows. Other users' ids in the URL do not reveal those rows.

Suggested messages:

- Created: `มีใบงานใหม่ {ticketNo}`
- Claimed: `{ticketNo} ถูกรับงานแล้ว`
- Completed: `{ticketNo} รอตรวจรับ`
- Rejected: `{ticketNo} ถูกส่งกลับให้แก้ไข`
- Overdue: `{ticketNo} เลยกำหนดเสร็จ`

## When rows are written

Create, claim, complete, and reject write notification rows in the same server action as the ticket write. If that action fails, no notification row is kept.

Overdue rows are written only by the scanner. The ticket actions do not scan for overdue.

## Overdue scanner

A protected command runs at least once a minute. It selects tickets where `closedAt` is null, `dueAt` is not null, `dueAt` is before now, and no overdue notification already exists for that ticket and that `dueAt`.

The scanner is a local command, `npm run notifications:scan`. It reads `NOTIFY_CRON_SECRET` from the environment and exits without writing rows when the secret is missing. It is not an unauthenticated public URL. On this machine, Windows Task Scheduler runs that command at least once a minute. The Next.js process does not start its own timer.

## Email

SMTP settings are `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. When those settings are absent, the app keeps the in-app row and skips email.

The message is Thai, names the ticket number, states the same fact as the in-app text, and links to `{APP_URL}/tickets/{id}`.

Send email only after the notification row is committed. A slow or failed SMTP call must not sit inside the ticket transaction.

## Data

`Notification` stores:

- recipient user id
- ticket id
- kind: `CREATED`, `CLAIMED`, `COMPLETED`, `REJECTED`, `OVERDUE`
- `dueAt` snapshot, required for `OVERDUE` and null otherwise
- created time
- read time, null until read
- optional email sent time and optional email error text

Overdue uniqueness is `(ticketId, dueAt, recipientId, kind=OVERDUE)`. Status and created rows are not unique for the life of the ticket, because the same action can happen again after rejection.

## Error handling

- Ticket action fails: no notification for that attempt.
- Recipient inactive or has no email: skip email; inactive users get no row.
- SMTP unset or send throws: ticket and in-app row stay committed; store the email error; do not retry.
- Scanner secret missing or wrong: reject before reading tickets.
- Legacy ticket with null `dueAt`: the scanner ignores it.

## Out of scope

At-risk warnings, repeat overdue reminders, manager or requester overdue mail, notification on `ACCEPT`, LINE, SMS, digest emails, automatic email retry, push notifications, and a separate worker queue.

## Testing

Pure tests cover recipient selection: EM versus IT line, inactive users excluded, actor excluded, requester notified on claim, complete, and reject, nobody notified on accept, assignee-only overdue, unclaimed overdue to the whole line, and a second overdue suppressed for the same `dueAt` after claim.

Action tests assert a created ticket writes technician rows and a failed create writes none.

Scanner tests assert a closed ticket and a still-future `dueAt` produce nothing, a crossed `dueAt` writes once, and a changed `dueAt` can write once more.

Email tests assert no address or missing SMTP skips send without removing the row, and a thrown send records the error and keeps the row.

## Done when

A technician sees a bell count for a new ticket in their line and can open it from `/notifications`. The requester is notified on claim, complete, and reject, and not on their own accept. An open ticket notifies once when `dueAt` passes: the assignee if there is one, otherwise the line technicians. Email goes out only when the user has an address and SMTP is configured. A failed email leaves the in-app notice in place.
