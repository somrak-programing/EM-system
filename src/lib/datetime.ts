export type DateTimeShift = { hours?: number; days?: number };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateTimeLocalValue(date: Date) {
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export function shiftDateTime(base: Date, { hours = 0, days = 0 }: DateTimeShift) {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  next.setHours(next.getHours() + hours);
  return next;
}
