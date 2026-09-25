import type { RoleCode } from "@prisma/client";
import { ALL_ROLES } from "./workflow";

export const MIN_PASSWORD_LENGTH = 8;

export function parseUsername(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(value)) {
    return { ok: false as const, error: "username" as const };
  }
  return { ok: true as const, value };
}

export function parsePassword(raw: string, required: boolean) {
  if (!raw) {
    if (required) return { ok: false as const, error: "password" as const };
    return { ok: true as const, value: null };
  }
  if (raw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false as const, error: "password_short" as const };
  }
  return { ok: true as const, value: raw };
}

export function parseRole(raw: string): RoleCode | null {
  return ALL_ROLES.includes(raw as RoleCode) ? (raw as RoleCode) : null;
}

export function sectionRequiredForRole(role: RoleCode) {
  return role === "SECTION_MANAGER";
}

export function wouldLeaveNoAdmin(input: {
  targetIsAdmin: boolean;
  adminCount: number;
  nextRole: RoleCode;
  nextActive: boolean;
}) {
  if (!input.targetIsAdmin) return false;
  const stillAdmin = input.nextActive && input.nextRole === "ADMIN";
  if (stillAdmin) return false;
  return input.adminCount <= 1;
}

export function optionalText(raw: string) {
  const value = raw.trim();
  return value || null;
}
