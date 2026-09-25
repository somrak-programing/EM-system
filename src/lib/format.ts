export function formatWhen(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export const MAX_IMPACT_OTHER = 120;

export function parseImpactOther(raw: string) {
  const text = raw.trim().slice(0, MAX_IMPACT_OTHER);
  return text || null;
}

export function formatImpact(ticket: {
  quality: boolean;
  environment: boolean;
  safety: boolean;
  impactOther?: string | null;
}) {
  const parts = [
    ticket.quality ? "Quality" : null,
    ticket.environment ? "Environment" : null,
    ticket.safety ? "Safety" : null,
    parseImpactOther(ticket.impactOther ?? ""),
  ].filter(Boolean);
  return parts.join(", ") || "—";
}
