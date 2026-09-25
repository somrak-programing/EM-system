import Link from "next/link";
import { Nav } from "@/components/Nav";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL } from "@/lib/workflow";

export default async function AdminUsersPage() {
  const auth = await requireAdmin();
  const users = await prisma.user.findMany({
    include: { role: true, section: true },
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
  });

  return (
    <>
      <Nav user={auth.session} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">จัดการผู้ใช้</h1>
            <p className="mt-2 text-sm text-slate-600">
              เพิ่มบัญชี เปลี่ยนบทบาท/แผนก หรือปิดการใช้งาน — ไม่ลบผู้ใช้เพราะยังผูกกับใบงาน
            </p>
          </div>
          <Link
            href="/admin/users/new"
            className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-navy-dark"
          >
            เพิ่มผู้ใช้
          </Link>
        </div>
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">ชื่อผู้ใช้</th>
                <th className="px-4 py-2 font-medium">ชื่อที่แสดง</th>
                <th className="px-4 py-2 font-medium">บทบาท</th>
                <th className="px-4 py-2 font-medium">แผนก</th>
                <th className="px-4 py-2 font-medium">สถานะ</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{user.username}</td>
                  <td className="px-4 py-2">{user.displayName}</td>
                  <td className="px-4 py-2">{ROLE_LABEL[user.role.code]}</td>
                  <td className="px-4 py-2 text-slate-600">{user.section?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {user.active ? (
                      <span className="text-emerald-700">ใช้งาน</span>
                    ) : (
                      <span className="text-slate-400">ปิด</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-medium text-brand-teal-dark hover:underline"
                    >
                      แก้ไข
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
