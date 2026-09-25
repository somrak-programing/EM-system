import { redirect } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketTiming } from "@/components/TicketTiming";
import { requireSession } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { TYPE_LABEL } from "@/lib/workflow";
import { prisma } from "@/lib/prisma";
import { stageKey, stageLookup } from "@/lib/flow";

export default async function TicketsPage() {
  const auth = await requireSession();
  if (!auth) redirect("/login");
  const isStaffView =
    auth.session.role === "ADMIN" ||
    auth.session.role === "EM_MANAGER" ||
    auth.session.role === "IT_MANAGER";

  const lookup = await stageLookup();
  const tickets = await prisma.ticket.findMany({
    where: isStaffView ? undefined : { requesterId: auth.session.id },
    orderBy: { createdAt: "desc" },
    include: { requester: true, assignee: true },
  });
  const now = new Date();

  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            {isStaffView ? "ใบงานทั้งหมด" : "ใบงานของฉัน"}
          </h1>
          <Link
            href="/tickets/new"
            className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-navy-dark"
          >
            แจ้งซ่อม
          </Link>
        </div>
        {tickets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            ยังไม่มีใบงาน
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">เลขที่</th>
                  <th className="px-3 py-2">ประเภท</th>
                  <th className="px-3 py-2">เรื่อง</th>
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="px-3 py-2">ความเร่งด่วน / SLA / กำหนดเสร็จ</th>
                  <th className="px-3 py-2">ช่าง</th>
                  <th className="px-3 py-2">สร้างเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <Link className="font-medium text-brand-teal-dark hover:text-brand-navy hover:underline" href={`/tickets/${ticket.id}`}>
                        {ticket.ticketNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{TYPE_LABEL[ticket.type]}</td>
                    <td className="px-3 py-2">{ticket.subject}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        code={ticket.status}
                        label={lookup.names.get(stageKey(ticket.type, ticket.status)) ?? ticket.status}
                        isTerminal={lookup.meta.get(stageKey(ticket.type, ticket.status))?.isTerminal}
                        isInitial={lookup.meta.get(stageKey(ticket.type, ticket.status))?.isInitial}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <TicketTiming
                        priority={ticket.priority}
                        dueAt={ticket.dueAt}
                        closedAt={ticket.closedAt}
                        now={now}
                        compact
                      />
                    </td>
                    <td className="px-3 py-2">{ticket.assignee?.displayName ?? "—"}</td>
                    <td className="px-3 py-2">{formatWhen(ticket.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
