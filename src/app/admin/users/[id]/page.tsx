import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { UserForm } from "@/components/UserForm";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const [user, sections] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { role: true } }),
    prisma.section.findMany({ orderBy: { code: "asc" } }),
  ]);
  if (!user) notFound();

  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto max-w-xl px-4 py-6">
        <p className="text-sm text-slate-500">
          <Link href="/admin/users" className="hover:underline">
            จัดการผู้ใช้
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">แก้ไขผู้ใช้</h1>
        <div className="mt-6">
          <UserForm
            mode="edit"
            userId={user.id}
            sections={sections}
            error={error}
            values={{
              username: user.username,
              displayName: user.displayName,
              email: user.email,
              phone: user.phone,
              roleCode: user.role.code,
              sectionId: user.sectionId,
              active: user.active,
            }}
          />
        </div>
      </main>
    </>
  );
}
