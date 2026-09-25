import { notFound } from "next/navigation";
import type { TicketType } from "@prisma/client";
import {
  addStageAction,
  addTransitionAction,
  deleteStageAction,
  deleteTransitionAction,
  updateStageAction,
} from "@/app/admin/actions";
import { Nav } from "@/components/Nav";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, ROLE_LABEL, TYPE_LABEL } from "@/lib/workflow";

const TYPES: TicketType[] = ["MACHINE", "ELECTRIC", "STAFF", "IT"];

export default async function AdminFlowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requireAdmin();
  const { type: raw } = await params;
  const { error } = await searchParams;
  if (!TYPES.includes(raw as TicketType)) notFound();
  const type = raw as TicketType;
  const workflow = await prisma.workflow.findUnique({
    where: { type },
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
      transitions: {
        orderBy: { sortOrder: "asc" },
        include: { fromStage: true, toStage: true, roles: true },
      },
    },
  });
  if (!workflow) notFound();

  const errorText: Record<string, string> = {
    stage: "กรอกรหัสและชื่อขั้น",
    dup: "รหัสขั้นนี้มีอยู่แล้ว",
    inuse: "มีใบงานอยู่ในขั้นนี้ ลบไม่ได้",
    linked: "ยังมีเส้นทางเชื่อมขั้นนี้อยู่ ลบเส้นทางก่อน",
    edge: "กรอกจาก/ถึง/รหัสปุ่ม/ชื่อปุ่มให้ครบ",
    roles: "เลือกอย่างน้อยหนึ่งบทบาท",
    missing: "ไม่พบข้อมูล",
  };

  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <div>
          <p className="text-sm text-slate-500">เส้นทางอนุมัติ</p>
          <h1 className="text-xl font-semibold">{TYPE_LABEL[type]}</h1>
        </div>
        {error ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {errorText[error] ?? "บันทึกไม่สำเร็จ"}
          </p>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-medium">ขั้นสถานะ</h2>
          <ul className="mt-3 space-y-3">
            {workflow.stages.map((stage) => (
              <li key={stage.id} className="rounded border border-slate-100 p-3">
                <form action={updateStageAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="type" value={type} />
                  <input type="hidden" name="stageId" value={stage.id} />
                  <p className="w-32 font-mono text-xs text-slate-500">{stage.code}</p>
                  <label className="text-sm">
                    ชื่อที่แสดง
                    <input
                      name="name"
                      defaultValue={stage.name}
                      className="mt-1 block rounded border border-slate-300 px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="isInitial" defaultChecked={stage.isInitial} /> ขั้นเริ่ม
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="isTerminal" defaultChecked={stage.isTerminal} /> ขั้นจบ
                  </label>
                  <button className="rounded border border-slate-300 px-2 py-1 text-sm">บันทึก</button>
                </form>
                <form action={deleteStageAction} className="mt-2">
                  <input type="hidden" name="type" value={type} />
                  <input type="hidden" name="stageId" value={stage.id} />
                  <button className="text-xs text-red-700">ลบขั้น</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addStageAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="type" value={type} />
            <label className="text-sm">
              รหัส (อังกฤษ)
              <input name="code" placeholder="WAIT_MANAGER" className="mt-1 block rounded border border-slate-300 px-2 py-1" />
            </label>
            <label className="text-sm">
              ชื่อที่แสดง
              <input name="name" placeholder="รอหัวหน้าแผนก" className="mt-1 block rounded border border-slate-300 px-2 py-1" />
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="isInitial" /> ขั้นเริ่ม
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="isTerminal" /> ขั้นจบ
            </label>
            <button className="rounded-lg bg-brand-navy px-3 py-1.5 text-sm text-white transition hover:bg-brand-navy-dark">เพิ่มขั้น</button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-medium">เส้นทาง (จาก → ถึง)</h2>
          <ul className="mt-3 space-y-3">
            {workflow.transitions.map((edge) => (
              <li key={edge.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 p-3 text-sm">
                <div>
                  <p className="font-medium">{edge.actionLabel}</p>
                  <p className="text-slate-600">
                    {edge.fromStage.name} → {edge.toStage.name} · รหัสปุ่ม {edge.actionCode}
                  </p>
                  <p className="text-xs text-slate-500">
                    บทบาท: {edge.roles.map((role) => ROLE_LABEL[role.roleCode]).join(", ")}
                    {edge.assignOnTake ? " · มอบหมายผู้กดเป็นเจ้าของงาน" : ""}
                    {edge.actorScope === "REQUESTER" ? " · ต้องเป็นผู้ร้องขอ" : ""}
                    {edge.actorScope === "ASSIGNEE" ? " · ต้องเป็นผู้รับงาน" : ""}
                  </p>
                </div>
                <form action={deleteTransitionAction}>
                  <input type="hidden" name="type" value={type} />
                  <input type="hidden" name="transitionId" value={edge.id} />
                  <button className="text-xs text-red-700">ลบเส้นทาง</button>
                </form>
              </li>
            ))}
          </ul>

          <form action={addTransitionAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="type" value={type} />
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                จาก
                <select name="fromStageId" className="mt-1 block rounded border border-slate-300 px-2 py-1">
                  {workflow.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                ถึง
                <select name="toStageId" className="mt-1 block rounded border border-slate-300 px-2 py-1">
                  {workflow.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                รหัสปุ่ม
                <input name="actionCode" placeholder="APPROVE" className="mt-1 block rounded border border-slate-300 px-2 py-1" />
              </label>
              <label className="text-sm">
                ชื่อปุ่ม
                <input name="actionLabel" placeholder="อนุมัติ" className="mt-1 block rounded border border-slate-300 px-2 py-1" />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <label>
                ฟอร์มเพิ่ม
                <select name="formKind" className="ml-2 rounded border border-slate-300 px-2 py-1">
                  <option value="NONE">ไม่มี</option>
                  <option value="COMPLETE">สาเหตุ/การแก้ไข</option>
                  <option value="REJECT">เหตุผลปฏิเสธ</option>
                </select>
              </label>
              <label>
                เงื่อนไขคนกด
                <select name="actorScope" className="ml-2 rounded border border-slate-300 px-2 py-1">
                  <option value="ANY">ตามบทบาทอย่างเดียว</option>
                  <option value="REQUESTER">ต้องเป็นผู้ร้องขอของใบนี้</option>
                  <option value="ASSIGNEE">ต้องเป็นผู้รับงานของใบนี้</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" name="assignOnTake" /> มอบหมายผู้กดเป็นเจ้าของงาน
              </label>
            </div>
            <fieldset className="flex flex-wrap gap-3 text-sm">
              <legend className="w-full font-medium">บทบาทที่กดได้ (Admin กดได้เสมอ)</legend>
              {ALL_ROLES.filter((role) => role !== "ADMIN").map((role) => (
                <label key={role} className="flex items-center gap-1">
                  <input type="checkbox" name={`role_${role}`} />
                  {ROLE_LABEL[role]}
                </label>
              ))}
            </fieldset>
            <button className="rounded-lg bg-brand-teal px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-teal-dark">เพิ่มเส้นทาง</button>
          </form>
        </section>
      </main>
    </>
  );
}
