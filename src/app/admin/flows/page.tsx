import Link from "next/link";
import { Nav } from "@/components/Nav";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TYPE_LABEL } from "@/lib/workflow";

export default async function AdminFlowsPage() {
  const auth = await requireAdmin();
  const workflows = await prisma.workflow.findMany({
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
      transitions: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-xl font-semibold">เส้นทางอนุมัติ</h1>
        <p className="mt-2 text-sm text-slate-600">
          แอดมินเพิ่มขั้นและเส้นทาง (จาก → ถึง, ใครกดได้) จากหน้านี้ได้เลย ไม่ต้องแก้โค้ด
          ใบงานใหม่จะใช้ขั้นเริ่มต้นของแต่ละประเภท
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {workflows.map((flow) => (
            <li key={flow.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-medium">{TYPE_LABEL[flow.type]}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {flow.stages.length} ขั้น · {flow.transitions.length} เส้นทาง
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {flow.stages.map((stage) => stage.name).join(" → ")}
              </p>
              <Link
                href={`/admin/flows/${flow.type}`}
                className="mt-3 inline-block text-sm font-medium text-brand-teal-dark hover:text-brand-navy hover:underline"
              >
                แก้ไขเส้นทาง
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
