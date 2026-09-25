"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import type { TicketPriority, TicketType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { collectRequestPhotos, saveTicketPhotos } from "@/lib/attachments";
import { clearSession, createSession, requireSession } from "@/lib/auth";
import { loadRules, loadWorkflow } from "@/lib/flow";
import { formatWhen, parseImpactOther } from "@/lib/format";
import { canManageTicketSchedule } from "@/lib/ops-access";
import { parseDateTime, validateFutureDueAt } from "@/lib/sla";
import { isTransitionAllowed, nextClosedAt } from "@/lib/workflow";
import { PRIORITY_LABEL } from "@/components/PriorityBadge";

function typePrefix(type: TicketType) {
  return { MACHINE: "M", ELECTRIC: "E", STAFF: "S", IT: "I" }[type];
}

async function nextTicketNo(type: TicketType) {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `${typePrefix(type)}-${day}-`;
  const last = await prisma.ticket.findFirst({
    where: { ticketNo: { startsWith: prefix } },
    orderBy: { ticketNo: "desc" },
  });
  const seq = last ? Number(last.ticketNo.slice(-4)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true },
  });
  if (!user || !user.active) {
    redirect("/login?error=1");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) redirect("/login?error=1");
  await createSession({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role.code,
    sectionId: user.sectionId,
  });
  if (user.role.code === "ADMIN") redirect("/admin/flows");
  if (user.role.code === "EM_TECHNICIAN" || user.role.code === "IT_TECHNICIAN") {
    redirect("/queue");
  }
  redirect("/tickets");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function createTicketAction(formData: FormData) {
  const auth = await requireSession();
  if (!auth) redirect("/login");
  const { session, user } = auth;
  const type = String(formData.get("type")) as TicketType;
  if (!["MACHINE", "ELECTRIC", "STAFF", "IT"].includes(type)) {
    redirect("/tickets/new?error=type");
  }
  const detail = String(formData.get("detail") ?? "").trim();
  if (!detail) redirect("/tickets/new?error=detail");
  const priority = String(formData.get("priority") ?? "") as TicketPriority;
  if (!["NORMAL", "URGENT"].includes(priority)) {
    redirect("/tickets/new?error=priority");
  }
  const dueResult = validateFutureDueAt(String(formData.get("dueAt") ?? ""));
  if (!dueResult.ok) {
    redirect(`/tickets/new?error=${dueResult.error}`);
  }

  const photos = collectRequestPhotos(formData);
  if (!photos.ok) redirect(`/tickets/new?error=${photos.error}`);

  const workflow = await loadWorkflow(type);
  const initial = workflow?.stages.find((stage) => stage.isInitial);
  if (!initial) redirect("/tickets/new?error=flow");

  let assetId: string | undefined;
  let assetTag: string | undefined;
  let assetName: string | undefined;
  let assetLine: string | undefined;
  const assetIdRaw = String(formData.get("assetId") ?? "");
  if (type === "MACHINE" || type === "ELECTRIC") {
    if (!assetIdRaw) redirect("/tickets/new?error=asset");
    const asset = await prisma.asset.findUnique({ where: { id: assetIdRaw } });
    if (!asset) redirect("/tickets/new?error=asset");
    assetId = asset.id;
    assetTag = asset.tag;
    assetName = asset.name;
    assetLine = asset.line;
  }

  const subjectRaw = String(formData.get("subject") ?? "").trim();
  const subject =
    subjectRaw ||
    (assetName ? `${assetName} (${assetTag})` : TYPE_SUBJECT[type]);

  const discoveredRaw = String(formData.get("discoveredAt") ?? "");
  const discoveredAt = discoveredRaw ? new Date(discoveredRaw) : new Date();

  const ticketNo = await nextTicketNo(type);
  const ticket = await prisma.ticket.create({
    data: {
      ticketNo,
      type,
      status: initial.code,
      priority,
      subject,
      detail,
      quality: formData.get("quality") === "on",
      environment: formData.get("environment") === "on",
      safety: formData.get("safety") === "on",
      impactOther: parseImpactOther(String(formData.get("impactOther") ?? "")),
      assetId,
      assetTag,
      assetName,
      assetLine,
      requesterId: session.id,
      sectionId: user.sectionId,
      discoveredAt,
      dueAt: dueResult.value,
      events: {
        create: {
          actorId: session.id,
          toStatus: initial.code,
          action: "CREATE",
          note: "สร้างใบงาน",
        },
      },
    },
  });

  if (photos.photos.length > 0) {
    const saved = await saveTicketPhotos(ticket.id, photos.photos, "REQUEST");
    await prisma.ticketAttachment.createMany({ data: saved });
  }

  redirect(`/tickets/${ticket.id}`);
}

const TYPE_SUBJECT: Record<TicketType, string> = {
  MACHINE: "แจ้งซ่อมเครื่องจักร",
  ELECTRIC: "แจ้งซ่อมไฟฟ้า",
  STAFF: "งานพนักงาน EM",
  IT: "งาน IT",
};

export async function applyTransitionAction(formData: FormData) {
  const auth = await requireSession();
  if (!auth) redirect("/login");
  const id = String(formData.get("ticketId") ?? "");
  const transitionId = String(formData.get("transitionId") ?? "");
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) redirect("/tickets");

  const rules = await loadRules(ticket.type);
  const rule = rules.find((item) => item.id === transitionId);
  const ctx = {
    role: auth.user.role.code,
    isRequester: ticket.requesterId === auth.session.id,
    isAssignee: ticket.assigneeId === auth.session.id,
  };
  if (!rule || rule.fromCode !== ticket.status || !isTransitionAllowed(rule, ctx)) {
    redirect(`/tickets/${id}?error=forbidden`);
  }

  const cause = String(formData.get("cause") ?? "").trim();
  const resolution = String(formData.get("resolution") ?? "").trim();
  const rejectReason = String(formData.get("rejectReason") ?? "").trim();

  if (rule.formKind === "COMPLETE" && (!cause || !resolution)) {
    redirect(`/tickets/${id}?error=complete`);
  }
  if (rule.formKind === "REJECT" && !rejectReason) {
    redirect(`/tickets/${id}?error=reject`);
  }

  const now = new Date();
  await prisma.ticket.update({
    where: { id },
    data: {
      status: rule.toCode,
      assigneeId: rule.assignOnTake ? auth.session.id : ticket.assigneeId,
      startedAt: rule.assignOnTake ? now : ticket.startedAt,
      closedAt: nextClosedAt(rule.formKind, ticket.closedAt, now),
      acceptedAt: rule.toIsTerminal ? now : ticket.acceptedAt,
      cause: rule.formKind === "COMPLETE" ? cause : ticket.cause,
      resolution: rule.formKind === "COMPLETE" ? resolution : ticket.resolution,
      rejectReason: rule.formKind === "REJECT" ? rejectReason : ticket.rejectReason,
      events: {
        create: {
          actorId: auth.session.id,
          fromStatus: ticket.status,
          toStatus: rule.toCode,
          action: rule.actionCode,
          note:
            rule.formKind === "COMPLETE"
              ? `สาเหตุ: ${cause}`
              : rule.formKind === "REJECT"
                ? rejectReason
                : rule.actionLabel,
        },
      },
    },
  });
  redirect(`/tickets/${id}`);
}

export async function updateTicketScheduleAction(formData: FormData) {
  const auth = await requireSession();
  if (!auth) redirect("/login");

  const id = String(formData.get("ticketId") ?? "");
  if (!id) redirect("/tickets");

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) redirect("/tickets");

  if (
    !canManageTicketSchedule(
      { role: auth.user.role.code, sectionId: auth.user.sectionId },
      ticket,
    )
  ) {
    redirect(`/tickets/${id}?error=schedule_forbidden`);
  }

  if (ticket.status === "ACCEPTED") {
    redirect(`/tickets/${id}?error=schedule_locked`);
  }

  const priority = String(formData.get("priority") ?? "") as TicketPriority;
  const dueResult = parseDateTime(String(formData.get("dueAt") ?? ""));
  if (!["NORMAL", "URGENT"].includes(priority) || !dueResult.ok) {
    redirect(`/tickets/${id}?error=schedule_invalid`);
  }

  const events: Array<{
    actorId: string;
    fromStatus: string;
    toStatus: string;
    action: string;
    note: string;
  }> = [];
  const priorityChanged = ticket.priority !== priority;
  if (priorityChanged) {
    events.push({
      actorId: auth.session.id,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      action: "PRIORITY_CHANGE",
      note: `ความเร่งด่วน: ${PRIORITY_LABEL[ticket.priority]} → ${PRIORITY_LABEL[priority]}`,
    });
  }

  const dueChanged = !ticket.dueAt || ticket.dueAt.getTime() !== dueResult.value.getTime();
  if (dueChanged) {
    events.push({
      actorId: auth.session.id,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      action: "DUE_CHANGE",
      note: `กำหนดเสร็จ: ${formatWhen(ticket.dueAt)} → ${formatWhen(dueResult.value)}`,
    });
  }

  if (events.length > 0) {
    const data: {
      priority?: TicketPriority;
      dueAt?: Date;
      events: { create: typeof events };
    } = {
      events: {
        create: events,
      },
    };
    if (priorityChanged) {
      data.priority = priority;
    }
    if (dueChanged) {
      data.dueAt = dueResult.value;
    }

    await prisma.ticket.update({
      where: { id },
      data,
    });
  }

  redirect(`/tickets/${id}`);
}
