import { applyTransitionAction } from "@/app/actions";
import type { TransitionRule } from "@/lib/workflow";

export function TransitionForms({
  ticketId,
  transitions,
}: {
  ticketId: string;
  transitions: TransitionRule[];
}) {
  if (transitions.length === 0) return null;
  return (
    <div className="space-y-3">
      {transitions.map((rule) => (
        <form
          key={rule.id}
          action={applyTransitionAction}
          className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
        >
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="transitionId" value={rule.id} />
          {rule.formKind === "COMPLETE" ? (
            <>
              <h2 className="font-medium">{rule.actionLabel}</h2>
              <label className="block text-sm">
                สาเหตุ
                <textarea name="cause" required rows={2} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm">
                การแก้ไข
                <textarea name="resolution" required rows={2} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
              </label>
            </>
          ) : null}
          {rule.formKind === "REJECT" ? (
            <textarea
              name="rejectReason"
              required
              rows={2}
              placeholder="เหตุผล"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          ) : null}
          <button className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-navy-dark">
            {rule.actionLabel}
          </button>
        </form>
      ))}
    </div>
  );
}
