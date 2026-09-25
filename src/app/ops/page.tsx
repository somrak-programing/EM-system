import type { Prisma } from "@prisma/client";
import { Nav } from "@/components/Nav";
import { OpsBars } from "@/components/OpsBars";
import { OpsFilters } from "@/components/OpsFilters";
import { OpsKanban } from "@/components/OpsKanban";
import { requireOpsSession } from "@/lib/auth";
import { opsSectionWhere } from "@/lib/ops-access";
import {
  BOARD_STATUSES,
  buildOpsMetrics,
  parseOpsFilters,
  type OpsTicket,
} from "@/lib/ops-metrics";
import { prisma } from "@/lib/prisma";
import { TYPE_LABEL } from "@/lib/workflow";

const DAY_MS = 24 * 60 * 60 * 1000;

const ticketInclude = {
  requester: { select: { displayName: true } },
  assignee: { select: { displayName: true } },
} satisfies Prisma.TicketInclude;

type TicketWithPeople = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

function toOpsTicket(ticket: TicketWithPeople): OpsTicket {
  return {
    id: ticket.id,
    ticketNo: ticket.ticketNo,
    type: ticket.type,
    status: ticket.status,
    priority: ticket.priority,
    subject: ticket.subject,
    dueAt: ticket.dueAt,
    startedAt: ticket.startedAt,
    closedAt: ticket.closedAt,
    requesterName: ticket.requester.displayName,
    assigneeName: ticket.assignee?.displayName ?? null,
  };
}

function formatHours(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} ชม.`;
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireOpsSession();
  const filters = parseOpsFilters(await searchParams);
  const now = new Date();

  const scope: Prisma.TicketWhereInput = {
    ...opsSectionWhere(auth.session),
    ...(filters.type !== "ALL" ? { type: filters.type } : {}),
    ...(filters.priority !== "ALL" ? { priority: filters.priority } : {}),
  };

  const [openTickets, closedTickets] = await Promise.all([
    prisma.ticket.findMany({
      where: { ...scope, status: { in: BOARD_STATUSES } },
      include: ticketInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.ticket.findMany({
      where: {
        ...scope,
        closedAt: { gte: new Date(now.getTime() - filters.days * DAY_MS), lte: now },
      },
      include: ticketInclude,
      orderBy: { closedAt: "desc" },
    }),
  ]);

  const merged = new Map<string, OpsTicket>();
  for (const ticket of [...openTickets, ...closedTickets]) {
    if (!merged.has(ticket.id)) merged.set(ticket.id, toOpsTicket(ticket));
  }
  const metrics = buildOpsMetrics([...merged.values()], filters, now);

  const scopeCaption = auth.session.role === "SECTION_MANAGER" ? "เฉพาะแผนกของคุณ" : "ทั้งโรงงาน";
  const kpis = [
    { label: "คิวรอรับ", value: String(metrics.kpis.queued) },
    { label: "กำลังซ่อม", value: String(metrics.kpis.inProgress) },
    { label: "เลยกำหนด", value: String(metrics.kpis.overdue) },
    { label: "MTTR", value: formatHours(metrics.kpis.mttrHours) },
    { label: "ปิดทันกำหนด", value: formatPercent(metrics.kpis.onTimePercent) },
  ];
  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold text-brand-navy">ภาพรวมงานซ่อม</h1>
          <p className="mt-0.5 text-sm text-slate-500">{scopeCaption}</p>
        </div>

        <OpsFilters filters={filters} />

        <section aria-label="ตัวชี้วัดหลัก" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-slate-200 border-t-4 border-t-brand-teal bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-navy">{kpi.value}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <OpsBars
            title="งานค้างตามประเภท"
            caption="ใบงานที่ยังเปิดอยู่ในปัจจุบัน"
            rows={metrics.backlogByType.map((row) => ({
              label: TYPE_LABEL[row.type],
              value: row.value,
              displayValue: String(row.value),
            }))}
          />
          <OpsBars
            title="MTTR ตามประเภท"
            caption={`ใบงานที่ปิดใน ${filters.days} วันล่าสุด`}
            rows={metrics.mttrByType.map((row) => ({
              label: TYPE_LABEL[row.type],
              value: row.value,
              displayValue: formatHours(row.value),
            }))}
          />
        </div>

        <OpsKanban board={metrics.board} now={now} />
      </main>
    </>
  );
}
