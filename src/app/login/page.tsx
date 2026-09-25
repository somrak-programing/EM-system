import { loginAction } from "@/app/actions";
import Image from "next/image";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="overflow-hidden rounded-3xl border border-brand-navy/10 bg-white shadow-[0_24px_70px_rgba(51,52,100,0.14)]">
        <div className="h-1.5 bg-gradient-to-r from-brand-navy via-brand-navy to-brand-teal" />
        <div className="p-7 sm:p-9">
          <Image
            src="/tcpr-logo.png"
            alt="Thai Tokai Carbon Product Rojana"
            width={420}
            height={129}
            className="mx-auto h-auto w-full max-w-[340px]"
            priority
            unoptimized
          />
          <div className="mt-7 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-brand-teal-dark">TCPR MAINTENANCE</p>
            <h1 className="mt-2 text-2xl font-semibold text-brand-navy">เข้าสู่ระบบแจ้งซ่อม</h1>
          </div>
          <p className="mt-2 text-center text-sm text-slate-600">
            ใช้บัญชีทดลองด้านล่าง — รหัสผ่านถูก hash ไม่ส่งใน URL
          </p>
          {error ? (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง
            </p>
          ) : null}
          <form action={loginAction} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              ชื่อผู้ใช้
              <input
                name="username"
                autoComplete="username"
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              รหัสผ่าน
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <button className="w-full rounded-xl bg-brand-navy py-2.5 font-medium text-white shadow-sm transition hover:bg-brand-navy-dark focus:ring-4 focus:ring-brand-teal/20">
              เข้าสู่ระบบ
            </button>
          </form>
          <ul className="mt-6 space-y-1 text-xs text-slate-500">
            <li>ผู้ร้องขอ: requester / requester123</li>
            <li>ช่าง EM: tech / tech123</li>
            <li>Admin: admin / admin123 (จัดการผู้ใช้และเส้นทางอนุมัติได้)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
