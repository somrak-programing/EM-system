import Link from "next/link";
import type { JSX } from "react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { SlaBadge } from "@/components/SlaBadge";
import { formatWhen } from "@/lib/format";
import type { OpsTicket } from "@/lib/ops-metrics";
import { getSlaState } from "@/lib/sla";

type BoardStatus = "QUEUED" | "IN_PROGRESS" | "PENDING_ACCEPTANCE";

const COLUMNS: Array<{ status: BoardStatus; title: string }> = [
  { status: "QUEUED", title: "รอช่าง" },
  { status: "IN_PROGRESS", title: "กำลังซ่อม" },
  { status: "PENDING_ACCEPTANCE", title: "รอตรวจรับ" },
];

export function OpsKanban({
  board,
  now,
}: {
  board: Record<BoardStatus, OpsTicket[]>;
  now: Date;
}): JSX.Element {
  return (
    <section aria-label="กระดานใบงาน" className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((column) => {
        const tickets = board[column.status];
        return (
          <div key={column.status} className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-brand-navy">
              {column.title}
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                {tickets.length}
              </span>
            </h2>
            {tickets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                ไม่มีใบงาน
              </p>
            ) : (
              <ul className="space-y-2">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-teal hover:shadow"
                    >
                      <p className="text-sm font-medium text-brand-teal-dark">{ticket.ticketNo}</p>
                      <p className="mt-0.5 text-sm text-slate-700">{ticket.subject}</p>
                      <dl className="mt-2 space-y-0.5 text-xs text-slate-500">
                        <div>
                          <dt className="inline">ผู้แจ้ง: </dt>
                          <dd className="inline">{ticket.requesterName}</dd>
                        </div>
                        <div>
                          <dt className="inline">ผู้รับงาน: </dt>
                          <dd className="inline">{ticket.assigneeName ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="inline">กำหนดเสร็จ: </dt>
                          <dd className="inline">{formatWhen(ticket.dueAt)}</dd>
                        </div>
                      </dl>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <PriorityBadge priority={ticket.priority} />
                        <SlaBadge state={getSlaState(ticket, now)} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
