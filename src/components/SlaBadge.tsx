import { SLA_LABEL, type SlaState } from "@/lib/sla";
import type { JSX } from "react";

const SLA_TONE: Record<SlaState, string> = {
  none: "bg-slate-100 text-slate-700",
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-700",
  on_time: "bg-teal-100 text-teal-700",
  late: "bg-red-100 text-red-700",
};

export function SlaBadge({ state }: { state: SlaState }): JSX.Element {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SLA_TONE[state]}`}>
      {SLA_LABEL[state]}
    </span>
  );
}
