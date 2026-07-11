// One-time stale-allocation cleanup, used by scripts/cleanup-stale-allocations.ts.
//
// The bulk Keka import created an open-ended ProjectAllocation for every
// (employee, project) pair that ever appeared in the timesheets -- so people
// who long ago moved off a project still carry an "active" open allocation to
// it. This module identifies those and can close them out with a real end date
// (the last day they actually logged on that project), so utilization and the
// employee's own grid stop showing projects they've left.
//
// This is intended as a one-time migration cleanup. Going forward, allocations
// are managed by hand (End / Edit-dates on /admin/allocations) as people move.

import { prisma } from "@/lib/prisma";
import {
  isAllocationStale,
  getRecentActivityKeys,
  staleAllocationCutoff,
  todayUTC,
} from "@/lib/allocation";

export type StaleAllocation = {
  id: string;
  employeeName: string;
  projectName: string;
  allocationPercentage: number;
  startDate: string;
  lastLogged: string | null;
  proposedEndDate: string;
};

// Every currently-stale open allocation (optionally scoped to one employee),
// with the end date that would be written. Stale = open-ended, in effect at
// least STALE_ALLOCATION_DAYS (so new joiners are excluded), and no timesheet
// entry on that project in the last STALE_ALLOCATION_DAYS.
export async function getStaleAllocationsPreview(employeeId?: string): Promise<StaleAllocation[]> {
  const today = todayUTC();
  const cutoff = staleAllocationCutoff(today);

  const [openAllocations, recentKeys] = await Promise.all([
    prisma.projectAllocation.findMany({
      where: { endDate: null, ...(employeeId ? { employeeId } : {}) },
      include: { employee: { select: { name: true } }, project: { select: { name: true } } },
    }),
    getRecentActivityKeys(cutoff, employeeId),
  ]);

  const stale = openAllocations.filter((a) =>
    isAllocationStale(a.startDate, a.endDate, recentKeys.has(`${a.employeeId}|${a.projectId}`), today)
  );
  if (stale.length === 0) return [];

  const employeeIds = [...new Set(stale.map((a) => a.employeeId))];
  const projectIds = [...new Set(stale.map((a) => a.projectId))];
  const lines = await prisma.timesheetLine.findMany({
    where: {
      timesheetHeader: { employeeId: { in: employeeIds } },
      task: { projectId: { in: projectIds } },
    },
    select: {
      workDate: true,
      timesheetHeader: { select: { employeeId: true } },
      task: { select: { projectId: true } },
    },
    orderBy: { workDate: "desc" },
  });
  const lastLoggedByPair = new Map<string, Date>();
  for (const l of lines) {
    const key = `${l.timesheetHeader.employeeId}|${l.task.projectId}`;
    if (!lastLoggedByPair.has(key)) lastLoggedByPair.set(key, l.workDate);
  }

  return stale
    .map((a) => {
      const lastLogged = lastLoggedByPair.get(`${a.employeeId}|${a.projectId}`) ?? null;
      // End on the last logged day; if they never logged, end on the start date
      // (a zero-length allocation -- assigned but never actually worked).
      const proposedEnd = lastLogged && lastLogged >= a.startDate ? lastLogged : a.startDate;
      return {
        id: a.id,
        employeeName: a.employee.name,
        projectName: a.project.name,
        allocationPercentage: a.allocationPercentage,
        startDate: a.startDate.toISOString().slice(0, 10),
        lastLogged: lastLogged ? lastLogged.toISOString().slice(0, 10) : null,
        proposedEndDate: proposedEnd.toISOString().slice(0, 10),
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.projectName.localeCompare(b.projectName));
}

// Applies the cleanup: writes the proposed end date on every stale allocation.
// Idempotent (ended rows are no longer open-ended, so a re-run finds nothing).
export async function applyStaleAllocationCleanup(employeeId?: string): Promise<number> {
  const stale = await getStaleAllocationsPreview(employeeId);
  if (stale.length === 0) return 0;

  await prisma.$transaction(
    stale.map((s) =>
      prisma.projectAllocation.update({
        where: { id: s.id },
        data: { endDate: new Date(`${s.proposedEndDate}T00:00:00.000Z`) },
      })
    )
  );
  return stale.length;
}
