import type { PrismaClient, RoleCode, TicketType } from "@prisma/client";

const DEFAULT_STAGES = [
  { code: "QUEUED", name: "รอช่าง", sortOrder: 1, isInitial: true, isTerminal: false },
  { code: "IN_PROGRESS", name: "กำลังซ่อม", sortOrder: 2, isInitial: false, isTerminal: false },
  { code: "PENDING_ACCEPTANCE", name: "รอตรวจรับ", sortOrder: 3, isInitial: false, isTerminal: false },
  { code: "ACCEPTED", name: "ยอมรับแล้ว", sortOrder: 4, isInitial: false, isTerminal: true },
];

const FLOWS: { type: TicketType; name: string; claimRoles: RoleCode[] }[] = [
  { type: "MACHINE", name: "ซ่อมเครื่องจักร", claimRoles: ["EM_TECHNICIAN"] },
  { type: "ELECTRIC", name: "ซ่อมไฟฟ้า", claimRoles: ["EM_TECHNICIAN"] },
  { type: "STAFF", name: "งานพนักงาน EM", claimRoles: ["EM_TECHNICIAN"] },
  { type: "IT", name: "งาน IT", claimRoles: ["IT_TECHNICIAN"] },
];

export async function seedDefaultWorkflows(prisma: PrismaClient) {
  await prisma.workflowTransitionRole.deleteMany();
  await prisma.workflowTransition.deleteMany();
  await prisma.workflowStage.deleteMany();
  await prisma.workflow.deleteMany();

  for (const flow of FLOWS) {
    const workflow = await prisma.workflow.create({
      data: {
        type: flow.type,
        name: flow.name,
        stages: { create: DEFAULT_STAGES },
      },
      include: { stages: true },
    });
    const byCode = Object.fromEntries(workflow.stages.map((stage) => [stage.code, stage]));

    const claim = await prisma.workflowTransition.create({
      data: {
        workflowId: workflow.id,
        fromStageId: byCode.QUEUED.id,
        toStageId: byCode.IN_PROGRESS.id,
        actionCode: "CLAIM",
        actionLabel: "รับงาน",
        formKind: "NONE",
        assignOnTake: true,
        actorScope: "ANY",
        sortOrder: 1,
      },
    });
    const complete = await prisma.workflowTransition.create({
      data: {
        workflowId: workflow.id,
        fromStageId: byCode.IN_PROGRESS.id,
        toStageId: byCode.PENDING_ACCEPTANCE.id,
        actionCode: "COMPLETE",
        actionLabel: "ส่งผลงานให้ตรวจรับ",
        formKind: "COMPLETE",
        assignOnTake: false,
        actorScope: "ASSIGNEE",
        sortOrder: 2,
      },
    });
    const accept = await prisma.workflowTransition.create({
      data: {
        workflowId: workflow.id,
        fromStageId: byCode.PENDING_ACCEPTANCE.id,
        toStageId: byCode.ACCEPTED.id,
        actionCode: "ACCEPT",
        actionLabel: "ยอมรับ",
        formKind: "NONE",
        assignOnTake: false,
        actorScope: "REQUESTER",
        sortOrder: 3,
      },
    });
    const reject = await prisma.workflowTransition.create({
      data: {
        workflowId: workflow.id,
        fromStageId: byCode.PENDING_ACCEPTANCE.id,
        toStageId: byCode.IN_PROGRESS.id,
        actionCode: "REJECT",
        actionLabel: "ปฏิเสธ — ส่งกลับช่าง",
        formKind: "REJECT",
        assignOnTake: false,
        actorScope: "REQUESTER",
        sortOrder: 4,
      },
    });

    await prisma.workflowTransitionRole.createMany({
      data: [
        ...flow.claimRoles.map((roleCode) => ({ transitionId: claim.id, roleCode })),
        ...flow.claimRoles.map((roleCode) => ({ transitionId: complete.id, roleCode })),
        { transitionId: accept.id, roleCode: "REQUESTER" },
        { transitionId: reject.id, roleCode: "REQUESTER" },
      ],
    });
  }
}
