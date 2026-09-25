import type { RoleCode } from "@prisma/client";

export const OPS_ROLES = [
  "SECTION_MANAGER",
  "EM_MANAGER",
  "IT_MANAGER",
  "GM",
  "ADMIN",
] as const satisfies readonly RoleCode[];

const OPS_ROLE_SET = new Set<RoleCode>(OPS_ROLES);

const PLANT_WIDE_OPS = new Set<RoleCode>([
  "EM_MANAGER",
  "IT_MANAGER",
  "GM",
  "ADMIN",
]);

export function isOpsRole(role: RoleCode): boolean {
  return OPS_ROLE_SET.has(role);
}

export function canManageTicketSchedule(
  actor: { role: RoleCode; sectionId: string | null },
  ticket: { sectionId: string | null },
): boolean {
  if (!isOpsRole(actor.role)) {
    return false;
  }

  if (PLANT_WIDE_OPS.has(actor.role)) {
    return true;
  }

  if (actor.role === "SECTION_MANAGER") {
    if (actor.sectionId === null || ticket.sectionId === null) {
      return false;
    }
    return actor.sectionId === ticket.sectionId;
  }

  return false;
}

export function opsSectionWhere(
  actor: { role: RoleCode; sectionId: string | null },
): { sectionId: string } | undefined {
  if (actor.role === "SECTION_MANAGER" && actor.sectionId !== null) {
    return { sectionId: actor.sectionId };
  }
  return undefined;
}
