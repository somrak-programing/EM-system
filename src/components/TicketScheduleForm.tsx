"use client";

import type { TicketPriority } from "@prisma/client";
import { updateTicketScheduleAction } from "@/app/actions";
import { DateTimeField } from "@/components/DateTimeField";
import { PRIORITY_LABEL } from "@/components/PriorityBadge";
import { toDateTimeLocalValue } from "@/lib/datetime";

export function TicketScheduleForm({
  ticketId,
  priority,
  dueAt,
}: {
  ticketId: string;
  priority: TicketPriority;
  dueAt: Date | null;
}) {
  return (
    <form action={updateTicketScheduleAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="ticketId" value={ticketId} />

      <label className="block text-sm font-medium text-slate-700">
        ความเร่งด่วน
        <select
          name="priority"
          required
          defaultValue={priority}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        >
          <option value="NORMAL">{PRIORITY_LABEL.NORMAL}</option>
          <option value="URGENT">{PRIORITY_LABEL.URGENT}</option>
        </select>
      </label>

      <DateTimeField
        name="dueAt"
        label="กำหนดเสร็จ"
        required
        initialValue={dueAt ? toDateTimeLocalValue(dueAt) : ""}
        quickPicks={[
          { label: "พรุ่งนี้", shift: { days: 1 } },
          { label: "อีก 3 วัน", shift: { days: 3 } },
        ]}
      />

      <button type="submit" className="rounded-lg bg-brand-navy px-4 py-2 font-medium text-white shadow-sm transition hover:bg-brand-navy-dark">
        บันทึกกำหนดงาน
      </button>
    </form>
  );
}
