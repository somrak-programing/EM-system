import type { TicketPriority, TicketType } from "@prisma/client";
import Link from "next/link";
import type { JSX } from "react";
import type { OpsFilters as OpsFilterValues } from "@/lib/ops-metrics";
import { SLA_LABEL, type SlaState } from "@/lib/sla";
import { TYPE_LABEL } from "@/lib/workflow";
import { PRIORITY_LABEL } from "@/components/PriorityBadge";

const TYPES: TicketType[] = ["MACHINE", "ELECTRIC", "STAFF", "IT"];
const PRIORITIES: TicketPriority[] = ["NORMAL", "URGENT"];
const SLA_STATES: SlaState[] = ["none", "on_track", "at_risk", "overdue", "on_time", "late"];

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-brand-navy focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-slate-600";

export function OpsFilters({ filters }: { filters: OpsFilterValues }): JSX.Element {
  return (
    <form
      method="get"
      action="/ops"
      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
    >
      <label className={labelClass}>
        ประเภทงาน
        <select name="type" defaultValue={filters.type} className={selectClass}>
          <option value="ALL">ทั้งหมด</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        ความเร่งด่วน
        <select name="priority" defaultValue={filters.priority} className={selectClass}>
          <option value="ALL">ทั้งหมด</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABEL[priority]}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        สถานะ SLA
        <select name="sla" defaultValue={filters.sla} className={selectClass}>
          <option value="ALL">ทั้งหมด</option>
          {SLA_STATES.map((state) => (
            <option key={state} value={state}>
              {SLA_LABEL[state]}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        ช่วงเวลางานที่ปิด
        <select name="days" defaultValue={String(filters.days)} className={selectClass}>
          <option value="7">7 วันล่าสุด</option>
          <option value="30">30 วันล่าสุด</option>
        </select>
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <button type="submit" className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-teal-dark">
          กรองข้อมูล
        </button>
        <Link
          href="/ops"
          className="rounded-lg border border-brand-navy/20 px-4 py-2 text-sm text-brand-navy transition hover:border-brand-navy hover:bg-brand-navy hover:text-white"
        >
          ล้างตัวกรอง
        </Link>
      </div>
    </form>
  );
}
