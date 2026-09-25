export type SlaState =
  | "none"
  | "on_track"
  | "at_risk"
  | "overdue"
  | "on_time"
  | "late";

export const SLA_LABEL: Record<SlaState, string> = {
  none: "ไม่มีกำหนด",
  on_track: "ตามแผน",
  at_risk: "ใกล้ครบ",
  overdue: "เลยกำหนด",
  on_time: "ทัน",
  late: "ช้า",
};

const AT_RISK_MS = 4 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

function parseDueDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const localMatch = LOCAL_DATE_TIME.exec(trimmed);
  if (localMatch) {
    const [, year, month, day, hour, minute, second, fractional] = localMatch;
    const yearNum = Number(year);
    const monthNum = Number(month);
    const dayNum = Number(day);
    const hourNum = Number(hour);
    const minuteNum = Number(minute);
    const secondNum = second ? Number(second) : 0;
    const msNum = fractional ? Number(fractional.padEnd(3, "0")) : 0;

    const date = new Date(yearNum, monthNum - 1, dayNum, hourNum, minuteNum, secondNum, msNum);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const roundTrips =
      date.getFullYear() === yearNum &&
      date.getMonth() === monthNum - 1 &&
      date.getDate() === dayNum &&
      date.getHours() === hourNum &&
      date.getMinutes() === minuteNum &&
      date.getSeconds() === secondNum &&
      date.getMilliseconds() === msNum;

    return roundTrips ? date : null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDateTime(
  raw: string,
): { ok: true; value: Date } | { ok: false; error: "due_required" | "due_invalid" } {
  if (!raw.trim()) {
    return { ok: false, error: "due_required" };
  }

  const parsed = parseDueDate(raw);
  if (!parsed) {
    return { ok: false, error: "due_invalid" };
  }

  return { ok: true, value: parsed };
}

export function getSlaState(
  input: { dueAt: Date | null; closedAt: Date | null },
  now = new Date(),
): SlaState {
  if (!input.dueAt) {
    return "none";
  }

  if (input.closedAt) {
    return input.closedAt.getTime() <= input.dueAt.getTime() ? "on_time" : "late";
  }

  const remaining = input.dueAt.getTime() - now.getTime();
  if (remaining < 0) {
    return "overdue";
  }

  return remaining <= AT_RISK_MS ? "at_risk" : "on_track";
}

export function validateFutureDueAt(
  raw: string,
  now = new Date(),
):
  | { ok: true; value: Date }
  | {
      ok: false;
      error: "due_required" | "due_invalid" | "due_past";
    } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "due_required" };
  }

  const parsed = parseDueDate(raw);
  if (!parsed) {
    return { ok: false, error: "due_invalid" };
  }

  if (parsed.getTime() <= now.getTime()) {
    return { ok: false, error: "due_past" };
  }

  return { ok: true, value: parsed };
}

export function calculateMttrHours(
  rows: Array<{ startedAt: Date | null; closedAt: Date | null }>,
): number | null {
  const durations: number[] = [];

  for (const row of rows) {
    if (!row.startedAt || !row.closedAt) {
      continue;
    }

    const durationMs = row.closedAt.getTime() - row.startedAt.getTime();
    if (durationMs < 0) {
      continue;
    }

    durations.push(durationMs / MS_PER_HOUR);
  }

  if (durations.length === 0) {
    return null;
  }

  const total = durations.reduce((sum, hours) => sum + hours, 0);
  return total / durations.length;
}

export function calculateOnTimePercent(
  rows: Array<{ dueAt: Date | null; closedAt: Date | null }>,
): number | null {
  const eligible = rows.filter((row) => row.dueAt && row.closedAt) as Array<{
    dueAt: Date;
    closedAt: Date;
  }>;

  if (eligible.length === 0) {
    return null;
  }

  const onTimeCount = eligible.filter(
    (row) => row.closedAt.getTime() <= row.dueAt.getTime(),
  ).length;

  return (onTimeCount / eligible.length) * 100;
}
