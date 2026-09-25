import { notFound, redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketScheduleForm } from "@/components/TicketScheduleForm";
import { TicketTiming } from "@/components/TicketTiming";
import { TicketPhotos } from "@/components/TicketPhotos";
import { TransitionForms } from "@/components/TransitionForms";
import { requireSession } from "@/lib/auth";
import { formatImpact, formatWhen } from "@/lib/format";
import { loadRules, loadWorkflow, stageKey, stageLookup } from "@/lib/flow";
import { canManageTicketSchedule } from "@/lib/ops-access";
import { prisma } from "@/lib/prisma";
import { allowedTransitions, TYPE_LABEL } from "@/lib/workflow";

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requireSession();
  if (!auth) redirect("/login");
  const { id } = await params;
  const { error } = await searchParams;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      requester: true,
      assignee: true,
      attachments: { orderBy: { createdAt: "asc" } },
      events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) notFound();

  const [rules, lookup, workflow] = await Promise.all([
    loadRules(ticket.type),
    stageLookup(),
    loadWorkflow(ticket.type),
  ]);
  const actions = allowedTransitions(rules, ticket.status, {
    role: auth.user.role.code,
    isRequester: ticket.requesterId === auth.session.id,
    isAssignee: ticket.assigneeId === auth.session.id,
  });
  const currentMeta = lookup.meta.get(stageKey(ticket.type, ticket.status));
  const currentLabel =
    lookup.names.get(stageKey(ticket.type, ticket.status)) ?? ticket.status;
  const canEditSchedule =
    ticket.status !== "ACCEPTED" &&
    canManageTicketSchedule(
      { role: auth.user.role.code, sectionId: auth.user.sectionId },
      ticket,
    );
  const now = new Date();

  const errorText: Record<string, string> = {
    forbidden: "คุณไม่มีสิทธิ์ทำรายการนี้",
    complete: "กรุณากรอกสาเหตุและการแก้ไข",
    reject: "กรุณาระบุเหตุผลที่ปฏิเสธ",
    schedule_forbidden: "คุณไม่มีสิทธิ์แก้กำหนดงานนี้",
    schedule_locked: "ใบงานที่ยอมรับแล้วแก้กำหนดไม่ได้",
    schedule_invalid: "กรุณาตรวจสอบความเร่งด่วนและกำหนดเสร็จ",
  };

  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{ticket.ticketNo}</p>
                <h1 className="text-xl font-semibold">{ticket.subject}</h1>
                <p className="text-sm text-slate-600">{TYPE_LABEL[ticket.type]}</p>
              </div>
              <StatusBadge
                code={ticket.status}
                label={currentLabel}
                isTerminal={currentMeta?.isTerminal}
                isInitial={currentMeta?.isInitial}
              />
            </div>
            {error ? (
              <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
                {errorText[error] ?? "ทำรายการไม่สำเร็จ"}
              </p>
            ) : null}
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">ผู้ร้องขอ</dt>
                <dd>{ticket.requester.displayName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">ช่างผู้รับงาน</dt>
                <dd>{ticket.assignee?.displayName ?? "ยังไม่มี"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">เครื่องจักร</dt>
                <dd>
                  {ticket.assetTag
                    ? `${ticket.assetTag} · ${ticket.assetName} · Line ${ticket.assetLine}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">พบปัญหาเมื่อ</dt>
                <dd>{formatWhen(ticket.discoveredAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">ความเร่งด่วน / SLA</dt>
                <dd>
                  <TicketTiming
                    priority={ticket.priority}
                    dueAt={ticket.dueAt}
                    closedAt={ticket.closedAt}
                    now={now}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">ผลกระทบ</dt>
                <dd>{formatImpact(ticket)}</dd>
              </div>
            </dl>
            <p className="mt-4 whitespace-pre-wrap text-sm">{ticket.detail}</p>
            <TicketPhotos photos={ticket.attachments} />
            {ticket.cause ? (
              <div className="mt-4 rounded bg-slate-50 p-3 text-sm">
                <p>
                  <span className="font-medium">สาเหตุ:</span> {ticket.cause}
                </p>
                <p className="mt-1">
                  <span className="font-medium">การแก้ไข:</span> {ticket.resolution}
                </p>
              </div>
            ) : null}
          </div>
          <TransitionForms ticketId={ticket.id} transitions={actions} />
          {canEditSchedule ? (
            <TicketScheduleForm ticketId={ticket.id} priority={ticket.priority} dueAt={ticket.dueAt} />
          ) : null}
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-medium">ไทม์ไลน์</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {ticket.events.map((event) => (
              <li key={event.id} className="border-l-2 border-brand-teal/35 pl-3">
                <p className="font-medium">
                  {lookup.names.get(stageKey(ticket.type, event.toStatus)) ?? event.toStatus}
                </p>
                <p className="text-slate-600">
                  {event.actor.displayName} · {formatWhen(event.createdAt)}
                </p>
                {event.note ? <p className="text-slate-500">{event.note}</p> : null}
              </li>
            ))}
          </ol>
          {workflow ? (
            <p className="mt-4 text-xs text-slate-400">
              เส้นทาง: {workflow.name} (แอดมินปรับได้ที่หน้าเส้นทางอนุมัติ)
            </p>
          ) : null}
        </aside>
      </main>
    </>
  );
}
