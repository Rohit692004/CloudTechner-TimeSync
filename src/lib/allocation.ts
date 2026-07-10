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
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (endDate && endDate <= today) return "Ended";
  if (!employeeIsActive) return "Employee Inactive";
  if (!projectIsActive) return "Project Inactive";
  if (startDate > today) return "Upcoming";
  return "Active";
}
