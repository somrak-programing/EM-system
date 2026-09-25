# Task 2: Ops authorization boundary

Work in `C:\dev\BSCB\apps\repair`.

## Files
- Create `src/lib/ops-access.ts`
- Create `src/lib/ops-access.test.ts`
- Modify `src/lib/auth.ts`

## Required interfaces

```ts
export const OPS_ROLES: readonly RoleCode[];
export function isOpsRole(role: RoleCode): boolean;

export function canManageTicketSchedule(
  actor: { role: RoleCode; sectionId: string | null },
  ticket: { sectionId: string | null },
): boolean;

export function opsSectionWhere(
  actor: { role: RoleCode; sectionId: string | null },
): { sectionId: string } | undefined;
```

Add `requireOpsSession()` in `src/lib/auth.ts`.

## Authorization rules

- Ops roles: `SECTION_MANAGER`, `EM_MANAGER`, `IT_MANAGER`, `GM`, `ADMIN`.
- `REQUESTER`, `EM_TECHNICIAN`, and `IT_TECHNICIAN` are not ops roles.
- A `SECTION_MANAGER` can manage only tickets with an exact non-null section match.
- A `SECTION_MANAGER` with null `sectionId` must never receive plant-wide access.
- `EM_MANAGER`, `IT_MANAGER`, `GM`, and `ADMIN` can manage tickets in any section, including null.
- `opsSectionWhere` returns `{ sectionId }` only for a section manager with a non-null section. It returns `undefined` for plant-wide ops roles. Callers must separately reject a section manager whose section is null.
- `requireOpsSession()` calls `requireSession()`, redirects unauthenticated users to `/login`, redirects non-ops users and section managers without a section to `/tickets`, and returns the full authenticated object otherwise.

## Mandatory TDD

1. Write `ops-access.test.ts` first.
2. Cover all eight roles and section match/mismatch/null cases.
3. Run `npx vitest run src/lib/ops-access.test.ts`; record RED caused by the missing module.
4. Implement minimal pure helpers.
5. Add `requireOpsSession`.
6. Run targeted tests, `npm test`, and `npx tsc --noEmit`.

## Report

Write `C:\dev\BSCB\apps\repair\.superpowers\sdd\task-2-report.md` with status, changed files, RED evidence, exact GREEN results, self-review, and concerns.

Do not commit and do not modify unrelated files.
