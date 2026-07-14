// Corrects ProjectAllocation date ranges so they match what people actually
// logged. The bulk import set each allocation's startDate to the earliest date
// in whichever import FILE first mentioned that project -- not the true earliest
// date the person logged it -- so many allocations start far too late. This
// recomputes start/end from the real timesheet history.
//
// Rules, per (employee, project) the employee has actually logged:
//   * start later than first logged -> pull start back to first logged
//   * end   earlier than last logged -> push end forward to last logged
//   * no allocation at all           -> create one spanning first..last logged
// Timesheet data is never touched. Pairs with >1 allocation are left for manual
// review (reported, never auto-changed).

import { prisma } from "@/lib/prisma";

type LoggedRow = { employeeId: string; projectId: string; firstLogged: Date; lastLogged: Date; entries: bigint };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

export type StartFix = { id: string; emp: string; proj: string; from: string; to: string };
export type EndFix = { id: string; emp: string; proj: string; from: string; to: string };
export type CreateFix = { employeeId: string; projectId: string; emp: string; proj: string; start: string; end: string };
export type MultiPair = { emp: string; proj: string; n: number };

export type AllocationDateFixes = {
  startFixes: StartFix[];
  endFixes: EndFix[];
  creates: CreateFix[];
  multi: MultiPair[];
};

export async function computeAllocationDateFixes(): Promise<AllocationDateFixes> {
  const logged = await prisma.$queryRaw<LoggedRow[]>`
    SELECT h."employeeId" AS "employeeId", t."projectId" AS "projectId",
           MIN(l."workDate") AS "firstLogged", MAX(l."workDate") AS "lastLogged", COUNT(*)::bigint AS entries
    FROM "TimesheetLine" l
    JOIN "TimesheetHeader" h ON h.id = l."timesheetHeaderId"
    JOIN "Task" t ON t.id = l."taskId"
    GROUP BY h."employeeId", t."projectId"`;

  const allocs = await prisma.projectAllocation.findMany({
    select: { id: true, employeeId: true, projectId: true, startDate: true, endDate: true },
  });
  const byPair = new Map<string, typeof allocs>();
  for (const a of allocs) {
    const k = `${a.employeeId}|${a.projectId}`;
    const arr = byPair.get(k);
    if (arr) arr.push(a);
    else byPair.set(k, [a]);
  }

  const empName = new Map((await prisma.employee.findMany({ select: { id: true, name: true } })).map((e) => [e.id, e.name]));
  const projName = new Map((await prisma.project.findMany({ select: { id: true, name: true } })).map((p) => [p.id, p.name]));

  const fixes: AllocationDateFixes = { startFixes: [], endFixes: [], creates: [], multi: [] };

  for (const lg of logged) {
    const pairAllocs = byPair.get(`${lg.employeeId}|${lg.projectId}`) ?? [];
    const emp = empName.get(lg.employeeId) ?? lg.employeeId;
    const proj = projName.get(lg.projectId) ?? lg.projectId;

    if (pairAllocs.length === 0) {
      fixes.creates.push({ employeeId: lg.employeeId, projectId: lg.projectId, emp, proj, start: iso(lg.firstLogged), end: iso(lg.lastLogged) });
    } else if (pairAllocs.length === 1) {
      const a = pairAllocs[0];
      if (a.startDate > lg.firstLogged) fixes.startFixes.push({ id: a.id, emp, proj, from: iso(a.startDate), to: iso(lg.firstLogged) });
      if (a.endDate && a.endDate < lg.lastLogged) fixes.endFixes.push({ id: a.id, emp, proj, from: iso(a.endDate), to: iso(lg.lastLogged) });
    } else {
      fixes.multi.push({ emp, proj, n: pairAllocs.length });
    }
  }
  return fixes;
}

export async function applyAllocationDateFixes(): Promise<{ starts: number; ends: number; created: number }> {
  const { startFixes, endFixes, creates } = await computeAllocationDateFixes();
  if (startFixes.length + endFixes.length + creates.length === 0) return { starts: 0, ends: 0, created: 0 };

  await prisma.$transaction([
    ...startFixes.map((f) => prisma.projectAllocation.update({ where: { id: f.id }, data: { startDate: utc(f.to) } })),
    ...endFixes.map((f) => prisma.projectAllocation.update({ where: { id: f.id }, data: { endDate: utc(f.to) } })),
    ...creates.map((c) => prisma.projectAllocation.create({
      data: { employeeId: c.employeeId, projectId: c.projectId, allocationPercentage: 100, startDate: utc(c.start), endDate: utc(c.end), createdById: null },
    })),
  ]);
  return { starts: startFixes.length, ends: endFixes.length, created: creates.length };
}
