import { badgeTone } from "@/lib/workflow";

export function StatusBadge({
  label,
  code,
  isTerminal = false,
  isInitial = false,
}: {
  label: string;
  code: string;
  isTerminal?: boolean;
  isInitial?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeTone(code, isTerminal, isInitial)}`}
    >
      {label}
    </span>
  );
}
