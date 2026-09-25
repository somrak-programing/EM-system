import { redirect } from "next/navigation";
import Link from "next/link";
import { applyTransitionAction } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketTiming } from "@/components/TicketTiming";
import { requireSession } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { loadRules, stageKey, stageLookup } from "@/lib/flow";
import { prisma } from "@/lib/prisma";
import { allowedTransitions, TYPE_LABEL } from "@/lib/workflow";
import type { Ticket, TicketType, User } from "@prisma/client";
import type { TransitionRule } from "@/lib/workflow";

type TicketRow = Ticket & { requester: User };

export default async function QueuePage() {
  const auth = await requireSession();
  if (!auth) redirect("/login");

  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: "asc" },
    include: { requester: true },
  });
  const lookup = await stageLookup();
  const now = new Date();
  const rulesByType = new Map<TicketType, TransitionRule[]>();
  const open: { ticket: TicketRow; claim: TransitionRule }[] = [];
  const mine: TicketRow[] = [];

  for (const ticket of tickets) {
    if (!rulesByType.has(ticket.type)) {
      rulesByType.set(ticket.type, await loadRules(ticket.type));
    }
    const rules = rulesByType.get(ticket.type) ?? [];
    const ctx = {
      role: auth.user.role.code,
      isRequester: ticket.requesterId === auth.session.id,
      isAssignee: ticket.assigneeId === auth.session.id,
    };
    const claim = allowedTransitions(rules, ticket.status, ctx).find(
      (rule) => rule.assignOnTake,
    );
    if (claim) open.push({ ticket, claim });
    const meta = lookup.meta.get(stageKey(ticket.type, ticket.status));
    if (ticket.assigneeId === auth.session.id && !meta?.isTerminal) {
      mine.push(ticket);
    }
  }

  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <section>
          <h1 className="mb-3 text-xl font-semibold">คิวงานใหม่</h1>
          {open.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-500">
              ไม่มีงานในคิวที่คุณรับได้
            </p>
          ) : (
            <ul className="space-y-3">
              {open.map(({ ticket, claim }) => (
                <li
                  key={ticket.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <Link href={`/tickets/${ticket.id}`} className="font-medium text-brand-teal-dark hover:text-brand-navy">
                      {ticket.ticketNo}
                    </Link>
                    <p className="text-sm text-slate-600">
                      {TYPE_LABEL[ticket.type]} · {ticket.subject}
                    </p>
                    <p className="text-xs text-slate-500">
                      {ticket.requester.displayName} · {formatWhen(ticket.createdAt)}
                    </p>
                    <div className="mt-2">
                      <TicketTiming
                        priority={ticket.priority}
                        dueAt={ticket.dueAt}
                        closedAt={ticket.closedAt}
                        now={now}
                        compact
                      />
                    </div>
                  </div>
                  <form action={applyTransitionAction}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <input type="hidden" name="transitionId" value={claim.id} />
                    <button className="rounded-lg bg-brand-teal px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-teal-dark">
                      {claim.actionLabel}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">งานของฉัน</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีงานที่รับไว้</p>
          ) : (
            <ul className="space-y-3">
              {mine.map((ticket) => {
                const meta = lookup.meta.get(stageKey(ticket.type, ticket.status));
                return (
                  <li key={ticket.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/tickets/${ticket.id}`} className="font-medium text-brand-teal-dark hover:text-brand-navy">
                        {ticket.ticketNo}
                      </Link>
                      <StatusBadge
                        code={ticket.status}
                        label={lookup.names.get(stageKey(ticket.type, ticket.status)) ?? ticket.status}
                        isTerminal={meta?.isTerminal}
                        isInitial={meta?.isInitial}
                      />
                    </div>
                    <p className="text-sm text-slate-600">{ticket.subject}</p>
                    <div className="mt-2">
                      <TicketTiming
                        priority={ticket.priority}
                        dueAt={ticket.dueAt}
                        closedAt={ticket.closedAt}
                        now={now}
                        compact
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
