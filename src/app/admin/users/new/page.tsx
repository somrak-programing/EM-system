import Link from "next/link";
import { Nav } from "@/components/Nav";
import { UserForm } from "@/components/UserForm";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requireAdmin();
  const { error } = await searchParams;
  const sections = await prisma.section.findMany({ orderBy: { code: "asc" } });

  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto max-w-xl px-4 py-6">
        <p className="text-sm text-slate-500">
          <Link href="/admin/users" className="hover:underline">
            จัดการผู้ใช้
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">เพิ่มผู้ใช้</h1>
        <div className="mt-6">
          <UserForm mode="create" sections={sections} error={error} />
        </div>
      </main>
    </>
  );
}
