import type { ActorScope, FormKind, RoleCode, TicketType } from "@prisma/client";

export type FlowContext = {
  role: RoleCode;
  isRequester: boolean;
  isAssignee: boolean;
};

export type TransitionRule = {
  id: string;
  actionCode: string;
  actionLabel: string;
  formKind: FormKind;
  assignOnTake: boolean;
  actorScope: ActorScope;
  fromCode: string;
  toCode: string;
  toIsTerminal: boolean;
  roleCodes: RoleCode[];
};

export const TYPE_LABEL: Record<TicketType, string> = {
  MACHINE: "ซ่อมเครื่องจักร",
  ELECTRIC: "ซ่อมไฟฟ้า",
  STAFF: "งานพนักงาน EM",
  IT: "งาน IT",
};

export const ROLE_LABEL: Record<RoleCode, string> = {
  REQUESTER: "ผู้ร้องขอ",
  SECTION_MANAGER: "หัวหน้าแผนก",
  GM: "GM",
  EM_MANAGER: "EM Manager",
  EM_TECHNICIAN: "ช่าง EM",
  IT_MANAGER: "IT Manager",
  IT_TECHNICIAN: "ช่าง IT",
  ADMIN: "Admin",
};

export const ALL_ROLES: RoleCode[] = [
  "REQUESTER",
  "SECTION_MANAGER",
  "GM",
  "EM_MANAGER",
  "EM_TECHNICIAN",
  "IT_MANAGER",
  "IT_TECHNICIAN",
  "ADMIN",
];

export function isTransitionAllowed(rule: TransitionRule, ctx: FlowContext): boolean {
  if (ctx.role === "ADMIN") return true;
  if (!rule.roleCodes.includes(ctx.role)) return false;
  if (rule.actorScope === "REQUESTER" && !ctx.isRequester) return false;
  if (rule.actorScope === "ASSIGNEE" && !ctx.isAssignee) return false;
  return true;
}

export function allowedTransitions(
  rules: TransitionRule[],
  currentStatus: string,
  ctx: FlowContext,
): TransitionRule[] {
  return rules.filter(
    (rule) => rule.fromCode === currentStatus && isTransitionAllowed(rule, ctx),
  );
}

export function nextClosedAt(
  formKind: FormKind,
  current: Date | null,
  now: Date,
): Date | null {
  if (formKind === "COMPLETE") return now;
  if (formKind === "REJECT") return null;
  return current;
}

export function slugCode(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9_]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
}

export function badgeTone(code: string, isTerminal: boolean, isInitial: boolean) {
  if (isTerminal) return "bg-brand-teal/15 text-brand-teal-dark";
  if (isInitial) return "bg-brand-navy/10 text-brand-navy";
  if (code.includes("PROGRESS") || code.includes("STAFF")) {
    return "bg-sky-100 text-sky-900";
  }
  if (code.includes("ACCEPT") || code.includes("REVIEW") || code.includes("PENDING")) {
    return "bg-violet-100 text-violet-900";
  }
  return "bg-slate-100 text-slate-800";
}
