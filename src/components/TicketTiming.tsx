import type { TicketPriority } from "@prisma/client";
import type { JSX } from "react";
import { formatWhen } from "@/lib/format";
import { getSlaState } from "@/lib/sla";
import { PriorityBadge } from "@/components/PriorityBadge";
import { SlaBadge } from "@/components/SlaBadge";

export function TicketTiming({
  priority,
  dueAt,
  closedAt,
  now = new Date(),
  compact = false,
}: {
  priority: TicketPriority;
  dueAt: Date | null;
  closedAt: Date | null;
  now?: Date;
  compact?: boolean;
}): JSX.Element {
  const state = getSlaState({ dueAt, closedAt }, now);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <PriorityBadge priority={priority} />
        <SlaBadge state={state} />
        <span>กำหนด: {formatWhen(dueAt)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={priority} />
        <SlaBadge state={state} />
      </div>
      <p className="text-sm text-slate-600">กำหนด: {formatWhen(dueAt)}</p>
    </div>
  );
}
