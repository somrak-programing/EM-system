# Task 8: Final verification and regression review

Work in `C:\dev\BSCB\apps\repair`.

This is a verification task. Do not modify production code unless a failing check exposes a real defect; if that happens, reproduce it with a failing test before fixing and document the change.

## Automated gate

Run sequentially, not concurrently:

```powershell
npm test
npx tsc --noEmit
npx eslint src
npm run build
```

Record exact pass counts and exit codes.

## Static acceptance inspection

Confirm from code and/or database:

- requester creation requires and persists NORMAL/URGENT plus future due date;
- COMPLETE does not render or write due date;
- manager edit is server-authorized, section-scoped, locked after ACCEPTED, and audited;
- timing badges appear on detail, list, and both queue sections;
- `/ops` role guard and nav visibility are correct;
- open query is not limited by 7/30 days;
- no chart library or new dependency was added;
- notifications, PM, inventory, checklists/signatures, export, and drag/drop remain absent.

## Browser acceptance

Use the seeded app and browser if available. Verify at minimum:

1. Requester ticket form shows required priority and due date with only «พรุ่งนี้» / «อีก 3 วัน» quick picks.
2. Technician COMPLETE form has cause/resolution but no due date.
3. Ops manager can open `/ops` and sees filters, five KPIs, two charts, and three kanban columns.
4. Requester/technician cannot open `/ops`.
5. Manager ticket detail shows editable schedule for an open ticket; a non-manager does not.
6. Mobile width around 390px and desktop around 1440px have no destructive horizontal overflow.

Do not create destructive sample data when existing seed/demo data can verify the UI. If browser login or server availability blocks a check, report it explicitly rather than claiming success.

## Report

Write `C:\dev\BSCB\apps\repair\.superpowers\sdd\task-8-report.md` with:

- automated gate evidence;
- static acceptance checklist;
- browser checks completed and screenshots/URLs if available;
- blockers or unverified items;
- changed files if any;
- final status (`DONE`, `DONE_WITH_CONCERNS`, or `BLOCKED`).

Do not commit.
