"use server";

import { redirect } from "next/navigation";
import type { ActorScope, FormKind, TicketType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ALL_ROLES, slugCode } from "@/lib/workflow";

function back(type: TicketType, error?: string): never {
  redirect(`/admin/flows/${type}${error ? `?error=${error}` : ""}`);
}

export async function addStageAction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type")) as TicketType;
  const workflow = await prisma.workflow.findUnique({
    where: { type },
    include: { stages: true },
  });
  if (!workflow) back(type, "missing");
  const flow = workflow!;
  const code = slugCode(String(formData.get("code") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) back(type, "stage");
  const isInitial = formData.get("isInitial") === "on";
  const isTerminal = formData.get("isTerminal") === "on";
  if (flow.stages.some((stage) => stage.code === code)) back(type, "dup");

  await prisma.$transaction(async (tx) => {
    if (isInitial) {
      await tx.workflowStage.updateMany({
        where: { workflowId: flow.id },
        data: { isInitial: false },
      });
    }
    await tx.workflowStage.create({
      data: {
        workflowId: flow.id,
        code,
        name,
        isInitial,
        isTerminal,
        sortOrder: flow.stages.length + 1,
      },
    });
  });
  back(type);
}

export async function updateStageAction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type")) as TicketType;
  const id = String(formData.get("stageId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back(type, "stage");
  const isInitial = formData.get("isInitial") === "on";
  const isTerminal = formData.get("isTerminal") === "on";
  const stage = await prisma.workflowStage.findUnique({ where: { id } });
  if (!stage) back(type, "missing");
  const current = stage!;

  await prisma.$transaction(async (tx) => {
    if (isInitial) {
      await tx.workflowStage.updateMany({
        where: { workflowId: current.workflowId, NOT: { id } },
        data: { isInitial: false },
      });
    }
    await tx.workflowStage.update({
      where: { id },
      data: { name, isInitial, isTerminal },
    });
  });
  back(type);
}

export async function deleteStageAction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type")) as TicketType;
  const id = String(formData.get("stageId") ?? "");
  const stage = await prisma.workflowStage.findUnique({ where: { id } });
  if (!stage) back(type, "missing");
  const current = stage!;
  const used = await prisma.ticket.count({
    where: { type, status: current.code },
  });
  if (used > 0) back(type, "inuse");
  const linked = await prisma.workflowTransition.count({
    where: { OR: [{ fromStageId: id }, { toStageId: id }] },
  });
  if (linked > 0) back(type, "linked");
  await prisma.workflowStage.delete({ where: { id } });
  back(type);
}

export async function addTransitionAction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type")) as TicketType;
  const workflow = await prisma.workflow.findUnique({ where: { type } });
  if (!workflow) back(type, "missing");
  const flow = workflow!;
  const fromStageId = String(formData.get("fromStageId") ?? "");
  const toStageId = String(formData.get("toStageId") ?? "");
  const actionCode = slugCode(String(formData.get("actionCode") ?? ""));
  const actionLabel = String(formData.get("actionLabel") ?? "").trim();
  if (!fromStageId || !toStageId || !actionCode || !actionLabel) back(type, "edge");
  const formKind = String(formData.get("formKind") ?? "NONE") as FormKind;
  const actorScope = String(formData.get("actorScope") ?? "ANY") as ActorScope;
  const roles = ALL_ROLES.filter((role) => formData.get(`role_${role}`) === "on");
  if (roles.length === 0) back(type, "roles");

  const count = await prisma.workflowTransition.count({
    where: { workflowId: flow.id },
  });
  await prisma.workflowTransition.create({
    data: {
      workflowId: flow.id,
      fromStageId,
      toStageId,
      actionCode,
      actionLabel,
      formKind,
      actorScope,
      assignOnTake: formData.get("assignOnTake") === "on",
      sortOrder: count + 1,
      roles: { create: roles.map((roleCode) => ({ roleCode })) },
    },
  });
  back(type);
}

export async function deleteTransitionAction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type")) as TicketType;
  const id = String(formData.get("transitionId") ?? "");
  await prisma.workflowTransition.delete({ where: { id } });
  back(type);
}
