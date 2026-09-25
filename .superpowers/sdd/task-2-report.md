# Task 2 Report: Ops authorization boundary

## Status

**Complete (GREEN)** — pure ops-access helpers and `requireOpsSession()` implemented per brief; all verification commands exit 0.

## Changed files

| File | Action |
|------|--------|
| `src/lib/ops-access.test.ts` | Created — role matrix and section scoping tests (TDD first) |
| `src/lib/ops-access.ts` | Created — `OPS_ROLES`, `isOpsRole`, `canManageTicketSchedule`, `opsSectionWhere` |
| `src/lib/auth.ts` | Modified — import `isOpsRole`; added `requireOpsSession()` |

No other files touched. No commit performed.

## RED evidence

Command:

```powershell
npx vitest run src/lib/ops-access.test.ts
```

Result (before `ops-access.ts` existed):

```
 FAIL  src/lib/ops-access.test.ts [ src/lib/ops-access.test.ts ]
Error: Failed to load url ./ops-access (resolved id: ./ops-access) in C:/dev/BSCB/apps/repair/src/lib/ops-access.test.ts. Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

Exit code: **1**

## GREEN results

### Targeted tests

```powershell
npx vitest run src/lib/ops-access.test.ts
```

```
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

Exit code: **0**

### Full suite

```powershell
npm test
```

```
 Test Files  7 passed (7)
      Tests  60 passed (60)
```

Exit code: **0**

### Typecheck

```powershell
npx tsc --noEmit
```

Exit code: **0** (no output)

## Implementation notes

### `ops-access.ts`

- `OPS_ROLES`: readonly tuple of `SECTION_MANAGER`, `EM_MANAGER`, `IT_MANAGER`, `GM`, `ADMIN`.
- `isOpsRole`: membership in an immutable `Set` derived from `OPS_ROLES`.
- `canManageTicketSchedule`:
  - Non-ops (`REQUESTER`, `EM_TECHNICIAN`, `IT_TECHNICIAN`) → `false`.
  - Plant-wide ops (`EM_MANAGER`, `IT_MANAGER`, `GM`, `ADMIN`) → `true` for any ticket section (including `null`).
  - `SECTION_MANAGER` → `true` only when both actor and ticket have the same non-null `sectionId`; `null` actor or ticket → `false`.
- `opsSectionWhere`:
  - `SECTION_MANAGER` with non-null `sectionId` → `{ sectionId }`.
  - All other cases → `undefined` (including section manager with null section and plant-wide roles).

### `requireOpsSession()` in `auth.ts`

Mirrors `requireAdmin()` pattern:

1. `requireSession()` → missing/inactive → `redirect("/login")`.
2. `!isOpsRole(session.role)` → `redirect("/tickets")`.
3. `SECTION_MANAGER` with `sectionId === null` → `redirect("/tickets")`.
4. Otherwise return full `{ session, user }` auth object.

## Test coverage summary

| Area | Cases |
|------|--------|
| `OPS_ROLES` / `isOpsRole` | All 8 `RoleCode` values; exact five ops roles in constant |
| Non-ops | `REQUESTER`, `EM_TECHNICIAN`, `IT_TECHNICIAN` denied for schedule manage and `opsSectionWhere` |
| `SECTION_MANAGER` | Same section allowed; other section denied; null actor denied; null ticket denied |
| Plant-wide ops | Each of `EM_MANAGER`, `IT_MANAGER`, `GM`, `ADMIN` allowed for arbitrary/null ticket sections |
| `opsSectionWhere` | Section filter only for scoped section manager; `undefined` for null-section manager and plant-wide roles |

`requireOpsSession()` is not unit-tested in this task file (Next.js `redirect` / Prisma coupling); behavior follows the same guard structure as existing `requireAdmin()`.

## Self-review

- [x] Exact ops role list matches brief (five roles).
- [x] Section manager never gets plant-wide manage or filter when `sectionId` is null.
- [x] `opsSectionWhere` does not return a filter for plant-wide roles (callers use absence of filter as unscoped ops access, with separate rejection for null-section managers at session gate).
- [x] Minimal diff; no unrelated cleanup.
- [x] TDD order: tests → RED → implement → GREEN.

## Concerns

1. **`requireOpsSession` lacks dedicated tests** — Only pure helpers are covered in `ops-access.test.ts`. Session gate logic is structurally aligned with `requireAdmin()` but would need mocks for `requireSession` / `redirect` to test in isolation (could be a follow-up).
2. **`canManageTicketSchedule` vs `opsSectionWhere` for section managers** — A section manager with a section cannot manage tickets with `sectionId: null` (`canManageTicketSchedule` false), while list scoping via `opsSectionWhere` would still restrict to their section. Callers combining both APIs should treat null-section tickets as outside section-manager schedule authority (consistent with tests).
