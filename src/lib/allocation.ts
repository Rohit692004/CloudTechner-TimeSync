import { prisma } from "@/lib/prisma";

const FAR_FUTURE = new Date("9999-12-31");
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Max concurrent allocation percentage (across all of an employee's *other*
 * allocations) at any point within [rangeStart, rangeEnd]. Used to check
 * whether adding a new allocation would push any single day over 100%.
 */
export async function getMaxOverlapPercentage(
  employeeId: string,
  rangeStart: Date,
  rangeEnd: Date | null,
  excludeAllocationId?: string
) {
  const rangeEndOrFar = rangeEnd ?? FAR_FUTURE;

  const existing = await prisma.projectAllocation.findMany({
    where: {
      employeeId,
      ...(excludeAllocationId ? { id: { not: excludeAllocationId } } : {}),
      startDate: { lte: rangeEndOrFar },
      OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
    },
  });

  const events: { date: number; delta: number }[] = [];
  for (const a of existing) {
    const start = Math.max(a.startDate.getTime(), rangeStart.getTime());
    const end = Math.min((a.endDate ?? FAR_FUTURE).getTime(), rangeEndOrFar.getTime());
    events.push({ date: start, delta: a.allocationPercentage });
    events.push({ date: end + DAY_MS, delta: -a.allocationPercentage });
  }
  events.sort((a, b) => a.date - b.date);

  let running = 0;
  let max = 0;
  for (const ev of events) {
    running += ev.delta;
    max = Math.max(max, running);
  }
  return max;
}

export function isValidAllocationPercentage(value: number) {
  return Number.isInteger(value) && value >= 5 && value <= 100 && value % 5 === 0;
}

export type AllocationStatusLabel = "Employee Inactive" | "Ended" | "Project Inactive" | "Upcoming" | "Active";

// How many days without a timesheet entry before an open-ended allocation is
// considered stale and eligible to be swept closed (see endStaleAllocations).
export const STALE_ALLOCATION_DAYS = 30;

export function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function staleAllocationCutoff(today: Date = todayUTC()): Date {
  return new Date(today.getTime() - STALE_ALLOCATION_DAYS * DAY_MS);
}

// An open-ended allocation is "stale" when it has been in effect for at least
// STALE_ALLOCATION_DAYS *and* the employee has logged no time on that project
// in the last STALE_ALLOCATION_DAYS -- a strong signal they quietly moved on
// and the allocation was never formally ended.
//
// The "in effect for at least STALE_ALLOCATION_DAYS" guard (startDate <= cutoff)
// is what protects a new joiner: someone whose allocation only just started
// hasn't had a full window to log anything yet, so they're never stale.
// An allocation with an explicit end date is never "stale" -- it's just Ended.
export function isAllocationStale(
  startDate: Date,
  endDate: Date | null,
  hasRecentActivity: boolean,
  today: Date = todayUTC()
): boolean {
  if (endDate) return false;
  const cutoff = staleAllocationCutoff(today);
  if (startDate > cutoff) return false; // too new to judge (new-joiner guard)
  return !hasRecentActivity;
}

// (employeeId|projectId) pairs that have at least one timesheet entry on or
// after `sinceDate`. Used to decide staleness without an N+1 query per row.
export async function getRecentActivityKeys(sinceDate: Date): Promise<Set<string>> {
  const lines = await prisma.timesheetLine.findMany({
    where: { workDate: { gte: sinceDate } },
    select: {
      timesheetHeader: { select: { employeeId: true } },
      task: { select: { projectId: true } },
    },
  });
  const keys = new Set<string>();
  for (const l of lines) keys.add(`${l.timesheetHeader.employeeId}|${l.task.projectId}`);
  return keys;
}

// Shared status precedence for anywhere an allocation is displayed --
// an explicit end date wins first (someone deliberately closed it out),
// then whether the employee has since left the company, then whether the
// project itself was deactivated, then the plain date-range check.
export function allocationStatusFor(
  startDate: Date,
  endDate: Date | null,
  employeeIsActive: boolean,
  projectIsActive: boolean
): AllocationStatusLabel {
  const today = todayUTC();
  if (endDate && endDate <= today) return "Ended";
  if (!employeeIsActive) return "Employee Inactive";
  if (!projectIsActive) return "Project Inactive";
  if (startDate > today) return "Upcoming";
  return "Active";
}
