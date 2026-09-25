import type { JSX } from "react";

type OpsBarRow = { label: string; value: number | null; displayValue: string };

export function OpsBars({
  title,
  caption,
  rows,
}: {
  title: string;
  caption: string;
  rows: OpsBarRow[];
}): JSX.Element {
  const max = Math.max(0, ...rows.map((row) => row.value ?? 0));

  return (
    <section aria-label={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-brand-navy">{title}</h2>
      <p className="mt-0.5 text-xs text-slate-500">{caption}</p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const width = max > 0 && row.value !== null && row.value > 0 ? (row.value / max) * 100 : 0;
          return (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-slate-700">{row.label}</span>
                <span className="font-semibold tabular-nums text-brand-navy">{row.displayValue}</span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-full rounded-full bg-brand-teal" style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
