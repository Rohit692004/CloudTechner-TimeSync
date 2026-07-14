// Computes an employee's project history from their ACTUAL timesheet entries,
// not from ProjectAllocation rows. The allocation rows were never a reliable
// historical log (the bulk import set their start dates from whichever file
// first mentioned a project), so the history derived from them showed wrong
// dates and gaps. Timesheet lines are the real record of what was worked and
// when, so we derive the history from them directly.
//
// Each project is split into "stints" -- contiguous runs of logging, where a
// gap of more than STINT_GAP_DAYS between consecutive logged dates starts a new
// stint (a classic gaps-and-islands computation). So Bench correctly shows as
// several separate periods filling the gaps between real project stints, rather
// than one long block. This is READ-ONLY: it never writes to the database.

import { prisma } from "@/lib/prisma";
import { todayUTC } from "@/lib/allocation";

const STINT_GAP_DAYS = 31;      // gap longer than this = a separate stint
const ONGOING_WINDOW_DAYS = 31; // a stint whose last entry is within this many days of today is treated as ongoing

export type ProjectHistoryStint = {
  id: string;
  projectName: string;
  clientName: string;
  allocationPercentage: number;
  startDate: string;
  endDate: string | null;
  status: "Active" | "Ended" | "Project Inactive";
  days: number;
};

type StintRow = {
  projectId: string;
  projectName: string;
  clientName: string;
  projectActive: boolean;
  stintStart: Date;
  stintEnd: Date;
  days: bigint;
};

export async function computeProjectHistory(employeeId: string): Promise<ProjectHistoryStint[]> {
  const rows = await prisma.$queryRaw<StintRow[]>`
    WITH dates AS (
      SELECT DISTINCT t."projectId" AS "projectId", l."workDate" AS "workDate"
      FROM "TimesheetLine" l
      JOIN "TimesheetHeader" h ON h.id = l."timesheetHeaderId"
      JOIN "Task" t ON t.id = l."taskId"
      WHERE h."employeeId" = ${employeeId}
    ),
    marked AS (
      SELECT "projectId", "workDate",
             CASE WHEN "workDate" - LAG("workDate") OVER (PARTITION BY "projectId" ORDER BY "workDate") > ${STINT_GAP_DAYS}
                  THEN 1 ELSE 0 END AS new_stint
      FROM dates
    ),
    grouped AS (
      SELECT "projectId", "workDate",
             SUM(new_stint) OVER (PARTITION BY "projectId" ORDER BY "workDate") AS stint
      FROM marked
    )
    SELECT g."projectId" AS "projectId", p.name AS "projectName", c.name AS "clientName",
           p."isActive" AS "projectActive",
           MIN(g."workDate") AS "stintStart", MAX(g."workDate") AS "stintEnd", COUNT(*)::bigint AS days
    FROM grouped g
    JOIN "Project" p ON p.id = g."projectId"
    JOIN "Client" c ON c.id = p."clientId"
    GROUP BY g."projectId", p.name, c.name, p."isActive", g.stint
    ORDER BY MIN(g."workDate") DESC
  `;

  // Allocation % is metadata (not derivable from timesheets); show it best-effort
  // from any allocation for that project, defaulting to 100.
  const allocs = await prisma.projectAllocation.findMany({
    where: { employeeId },
    select: { projectId: true, allocationPercentage: true },
  });
  const pctByProject = new Map<string, number>();
  for (const a of allocs) if (!pctByProject.has(a.projectId)) pctByProject.set(a.projectId, a.allocationPercentage);

  const today = todayUTC();
  const ongoingCutoff = new Date(today.getTime() - ONGOING_WINDOW_DAYS * 86400000);

  return rows.map((r) => {
    const ongoing = r.stintEnd >= ongoingCutoff;
    const status: ProjectHistoryStint["status"] = !r.projectActive ? "Project Inactive" : ongoing ? "Active" : "Ended";
    return {
      id: `${r.projectId}-${r.stintStart.toISOString().slice(0, 10)}`,
      projectName: r.projectName,
      clientName: r.clientName,
      allocationPercentage: pctByProject.get(r.projectId) ?? 100,
      startDate: r.stintStart.toISOString().slice(0, 10),
      endDate: ongoing ? null : r.stintEnd.toISOString().slice(0, 10),
      status,
      days: Number(r.days),
    };
  });
}
