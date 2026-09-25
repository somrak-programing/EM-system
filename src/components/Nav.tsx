import { logoutAction } from "@/app/actions";
import type { SessionUser } from "@/lib/auth";
import { isOpsRole } from "@/lib/ops-access";
import { ROLE_LABEL } from "@/lib/workflow";
import Image from "next/image";
import Link from "next/link";

export function Nav({ user }: { user: SessionUser }) {
  const showQueue =
    user.role === "ADMIN" ||
    user.role === "EM_TECHNICIAN" ||
    user.role === "IT_TECHNICIAN" ||
    user.role === "EM_MANAGER" ||
    user.role === "IT_MANAGER";

  return (
    <header className="border-b border-brand-navy/10 bg-white/95 shadow-[0_1px_12px_rgba(51,52,100,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/tickets" className="flex min-w-0 items-center gap-3">
          <Image
            src="/tcpr-logo.png"
            alt="Thai Tokai Carbon Product Rojana"
            width={230}
            height={71}
            className="h-auto w-[180px] sm:w-[230px]"
            priority
            unoptimized
          />
          <span className="hidden border-l border-brand-navy/15 pl-3 text-sm font-semibold text-brand-navy lg:block">
            ระบบแจ้งซ่อม
          </span>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center justify-end gap-1.5 text-sm">
          <Link className="rounded-lg px-3 py-2 text-brand-navy transition hover:bg-brand-teal/10 hover:text-brand-teal-dark" href="/tickets">
            ใบงานของฉัน
          </Link>
          <Link className="rounded-lg px-3 py-2 text-brand-navy transition hover:bg-brand-teal/10 hover:text-brand-teal-dark" href="/tickets/new">
            แจ้งซ่อม
          </Link>
          {showQueue ? (
            <Link className="rounded-lg px-3 py-2 text-brand-navy transition hover:bg-brand-teal/10 hover:text-brand-teal-dark" href="/queue">
              คิวช่าง
            </Link>
          ) : null}
          {isOpsRole(user.role) ? (
            <Link className="rounded-lg px-3 py-2 text-brand-navy transition hover:bg-brand-teal/10 hover:text-brand-teal-dark" href="/ops">
              ภาพรวมงาน
            </Link>
          ) : null}
          {user.role === "ADMIN" ? (
            <Link className="rounded-lg px-3 py-2 text-brand-navy transition hover:bg-brand-teal/10 hover:text-brand-teal-dark" href="/admin/flows">
              เส้นทางอนุมัติ
            </Link>
          ) : null}
          <span className="ml-1 rounded-full bg-brand-navy/5 px-3 py-1.5 text-xs text-brand-navy">
            {user.displayName} · {ROLE_LABEL[user.role]}
          </span>
          <form action={logoutAction}>
            <button className="rounded-lg border border-brand-navy/20 px-3 py-1.5 text-xs text-brand-navy transition hover:border-brand-navy hover:bg-brand-navy hover:text-white">
              ออกจากระบบ
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
