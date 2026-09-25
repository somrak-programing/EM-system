export function formatWhen(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
