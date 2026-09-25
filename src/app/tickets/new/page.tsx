import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { TicketForm } from "@/components/TicketForm";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requireSession();
  if (!auth) redirect("/login");
  const { error } = await searchParams;
  const assets = await prisma.asset.findMany({
    where: { active: true },
    orderBy: { tag: "asc" },
  });

  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold">แจ้งซ่อม / ขอทำงาน</h1>
        <p className="mb-4 text-sm text-slate-600">
          เลือกประเภทงานได้ในหน้าเดียว แนบรูปได้ถ้ามี (สูงสุด 4 รูป)
        </p>
        <TicketForm assets={assets} error={error} />
      </main>
    </>
  );
}
