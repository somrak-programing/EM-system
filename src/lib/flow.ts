import type { TicketType } from "@prisma/client";
import { prisma } from "./prisma";
import type { TransitionRule } from "./workflow";

const includeTransition = {
  fromStage: true,
  toStage: true,
  roles: true,
} as const;

export async function loadWorkflow(type: TicketType) {
  return prisma.workflow.findUnique({
    where: { type },
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
      transitions: {
        orderBy: { sortOrder: "asc" },
        include: includeTransition,
      },
    },
  });
}

export function toRules(
  transitions: {
    id: string;
    actionCode: string;
    actionLabel: string;
    formKind: TransitionRule["formKind"];
    assignOnTake: boolean;
    actorScope: TransitionRule["actorScope"];
    fromStage: { code: string };
    toStage: { code: string; isTerminal: boolean };
    roles: { roleCode: TransitionRule["roleCodes"][number] }[];
  }[],
): TransitionRule[] {
  return transitions.map((row) => ({
    id: row.id,
    actionCode: row.actionCode,
    actionLabel: row.actionLabel,
    formKind: row.formKind,
    assignOnTake: row.assignOnTake,
    actorScope: row.actorScope,
    fromCode: row.fromStage.code,
    toCode: row.toStage.code,
    toIsTerminal: row.toStage.isTerminal,
    roleCodes: row.roles.map((role) => role.roleCode),
  }));
}

export async function loadRules(type: TicketType): Promise<TransitionRule[]> {
  const workflow = await loadWorkflow(type);
  if (!workflow) return [];
  return toRules(workflow.transitions);
}

export async function stageLookup() {
  const workflows = await prisma.workflow.findMany({
    include: { stages: true },
  });
  const names = new Map<string, string>();
  const meta = new Map<string, { isTerminal: boolean; isInitial: boolean }>();
  for (const workflow of workflows) {
    for (const stage of workflow.stages) {
      const key = `${workflow.type}:${stage.code}`;
      names.set(key, stage.name);
      meta.set(key, { isTerminal: stage.isTerminal, isInitial: stage.isInitial });
    }
  }
  return { names, meta };
}

export function stageKey(type: TicketType, code: string) {
  return `${type}:${code}`;
}
