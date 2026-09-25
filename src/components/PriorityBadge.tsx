import type { TicketPriority } from "@prisma/client";
import type { JSX } from "react";

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  NORMAL: "ปกติ",
  URGENT: "เร่งด่วน",
};

const PRIORITY_TONE: Record<TicketPriority, string> = {
  NORMAL: "bg-slate-100 text-slate-700",
  URGENT: "bg-red-100 text-red-700",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }): JSX.Element {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_TONE[priority]}`}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
