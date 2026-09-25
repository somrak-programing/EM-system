import type { TicketPriority, TicketType } from "@prisma/client";
import {
  calculateMttrHours,
  calculateOnTimePercent,
  getSlaState,
  type SlaState,
} from "./sla";

export type OpsFilters = {
  type: TicketType | "ALL";
  priority: TicketPriority | "ALL";
  sla: SlaState | "ALL";
  days: 7 | 30;
};

export type OpsTicket = {
  id: string;
  ticketNo: string;
  type: TicketType;
  status: string;
  priority: TicketPriority;
  subject: string;
  dueAt: Date | null;
  startedAt: Date | null;
  closedAt: Date | null;
  requesterName: string;
  assigneeName: string | null;
};

export type BoardStatus = "QUEUED" | "IN_PROGRESS" | "PENDING_ACCEPTANCE";

const TICKET_TYPES: TicketType[] = ["MACHINE", "ELECTRIC", "STAFF", "IT"];
const TICKET_PRIORITIES: TicketPriority[] = ["NORMAL", "URGENT"];
const SLA_STATES: SlaState[] = ["none", "on_track", "at_risk", "overdue", "on_time", "late"];
export const BOARD_STATUSES: BoardStatus[] = ["QUEUED", "IN_PROGRESS", "PENDING_ACCEPTANCE"];
const DAY_MS = 24 * 60 * 60 * 1000;

type RowWithSla = {
  row: OpsTicket;
  sla: SlaState;
};

export function parseOpsFilters(
  params: Record<string, string | string[] | undefined>,
): OpsFilters {
  const type = firstValue(params.type);
  const priority = firstValue(params.priority);
  const sla = firstValue(params.sla);

  return {
    type: isTicketType(type) ? type : "ALL",
    priority: isTicketPriority(priority) ? priority : "ALL",
    sla: isSlaState(sla) ? sla : "ALL",
    days: firstValue(params.days) === "30" ? 30 : 7,
  };
}

export function buildOpsMetrics(
  rows: OpsTicket[],
  filters: OpsFilters,
  now = new Date(),
): {
  kpis: {
    queued: number;
    inProgress: number;
    overdue: number;
    mttrHours: number | null;
    onTimePercent: number | null;
  };
  backlogByType: Array<{ type: TicketType; value: number }>;
  mttrByType: Array<{ type: TicketType; value: number | null }>;
  board: {
    QUEUED: OpsTicket[];
    IN_PROGRESS: OpsTicket[];
    PENDING_ACCEPTANCE: OpsTicket[];
  };
} {
  const rowsWithSla = rows.map((row) => ({
    row,
    sla: getSlaState(row, now),
  }));
  const filtered = rowsWithSla.filter((item) => matchesFilters(item, filters));
  const openRows = filtered.filter((item) => isBoardStatus(item.row.status));
  const windowedClosedRows = filtered
    .map((item) => item.row)
    .filter((row) => isClosedInWindow(row, filters.days, now));

  return {
    kpis: {
      queued: openRows.filter((item) => item.row.status === "QUEUED").length,
      inProgress: openRows.filter((item) => item.row.status === "IN_PROGRESS").length,
      overdue: openRows.filter((item) => item.sla === "overdue").length,
      mttrHours: calculateMttrHours(windowedClosedRows),
      onTimePercent: calculateOnTimePercent(windowedClosedRows),
    },
    backlogByType: TICKET_TYPES.map((type) => ({
      type,
      value: openRows.filter((item) => item.row.type === type).length,
    })),
    mttrByType: TICKET_TYPES.map((type) => ({
      type,
      value: calculateMttrHours(windowedClosedRows.filter((row) => row.type === type)),
    })),
    board: {
      QUEUED: boardRows(openRows, "QUEUED"),
      IN_PROGRESS: boardRows(openRows, "IN_PROGRESS"),
      PENDING_ACCEPTANCE: boardRows(openRows, "PENDING_ACCEPTANCE"),
    },
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isTicketType(value: string | undefined): value is TicketType {
  return TICKET_TYPES.includes(value as TicketType);
}

function isTicketPriority(value: string | undefined): value is TicketPriority {
  return TICKET_PRIORITIES.includes(value as TicketPriority);
}

function isSlaState(value: string | undefined): value is SlaState {
  return SLA_STATES.includes(value as SlaState);
}

function isBoardStatus(status: string): status is BoardStatus {
  return BOARD_STATUSES.includes(status as BoardStatus);
}

function matchesFilters(item: RowWithSla, filters: OpsFilters): boolean {
  if (filters.type !== "ALL" && item.row.type !== filters.type) {
    return false;
  }
  if (filters.priority !== "ALL" && item.row.priority !== filters.priority) {
    return false;
  }
  if (filters.sla !== "ALL" && item.sla !== filters.sla) {
    return false;
  }
  return true;
}

function isClosedInWindow(row: OpsTicket, days: 7 | 30, now: Date): boolean {
  if (!row.closedAt) {
    return false;
  }

  const closedAt = row.closedAt.getTime();
  const windowStart = now.getTime() - days * DAY_MS;
  return closedAt >= windowStart && closedAt <= now.getTime();
}

function boardRows(rows: RowWithSla[], status: BoardStatus): OpsTicket[] {
  return rows.filter((item) => item.row.status === status).map((item) => item.row);
}
