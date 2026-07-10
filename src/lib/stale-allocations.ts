// Stale-allocation sweep. An "open-ended" allocation (no end date) whose person
// has logged no time on that project in the last STALE_ALLOCATION_DAYS -- and
// which has existed at least that long, so new joiners are never caught -- is
// treated as the person having quietly moved on. The sweep stamps a REAL end
// date on it (the last day they actually logged), so from then on every page's
// existing "Ended" handling frees their utilization and shows the right status
// automatically. No cron job and no button: it runs idempotently whenever an
// admin views an allocation surface (see the callers), so the first view of the
// day does the cleanup and later views find nothing left to do.

import { prisma } from "@/lib/prisma";
import {
  isAllocationStale,
  getRecentActivityKeys,
  staleAllocationCutoff,
  todayUTC,
} from "@/lib/allocation";

async function findStale(today: Date) {
  const cutoff = staleAllocationCutoff(today);
  const [openAllocations, recentKeys] = await Promise.all([
    prisma.projectAllocation.findMany({
      where: { endDate: null },
      select: { id: true, employeeId: true, projectId: true, startDate: true },
    }),
    getRecentActivityKeys(cutoff),
  ]);

  return openAllocations.filter((a) =>
    isAllocationStale(a.startDate, null, recentKeys.has(`${a.employeeId}|${a.projectId}`), today)
  );
}

// Writes a real endDate on every currently-stale open allocation. Idempotent
// (ended rows aren't open-ended anymore, so they're never revisited). Returns
// how many were closed. Best-effort: callers should not let a failure here
// break page rendering.
export async function sweepStaleAllocations(): Promise<number> {
  const today = todayUTC();
  const stale = await findStale(today);
  if (stale.length === 0) return 0;

  // Last workDate per (employee, project) for the stale set -> the end date.
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

  await prisma.$transaction(
    stale.map((a) => {
      const lastLogged = lastLoggedByPair.get(`${a.employeeId}|${a.projectId}`) ?? null;
      // End on the last logged day; if they never logged, end on the start date
      // (a zero-length allocation -- assigned but never actually worked).
      const endDate = lastLogged && lastLogged >= a.startDate ? lastLogged : a.startDate;
      return prisma.projectAllocation.update({ where: { id: a.id }, data: { endDate } });
    })
  );

  return stale.length;
}

// Wrapper that never throws -- safe to await at the top of a page render as a
// best-effort maintenance step. A failure just leaves the numbers as-is.
export async function sweepStaleAllocationsSafe(): Promise<void> {
  try {
    await sweepStaleAllocations();
  } catch (err) {
    console.error("sweepStaleAllocations failed (non-fatal):", err);
  }
}
