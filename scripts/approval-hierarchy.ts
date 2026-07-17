// Prints the timesheet approval hierarchy: for every active employee, who
// approves their timesheet, following the exact resolution the app uses at
// submit time:
//   1. If the submitter is the Project Manager of a project they log on,
//      that project's Client Manager approves (their OWN-project hours).
//   2. Otherwise: Approver Override if set, else Reporting Manager.
//   3. Blocked if it resolves to the submitter themselves, or if none exists.
//
// Read-only. Run:  npx tsx scripts/approval-hierarchy.ts

import { prisma } from "@/lib/prisma";

async function main() {
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: { reportingManager: { select: { id: true, name: true } }, approverOverride: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  const projects = await prisma.project.findMany({
    where: { isActive: true, projectManagerId: { not: null } },
    include: { client: { select: { name: true, clientManager: { select: { id: true, name: true } } } } },
    orderBy: { name: "asc" },
  });
  const pmProjects = new Map<string, typeof projects>();
  for (const p of projects) {
    const arr = pmProjects.get(p.projectManagerId!);
    if (arr) arr.push(p); else pmProjects.set(p.projectManagerId!, [p]);
  }

  const noApprover: string[] = [];
  const deadEnds: string[] = [];

  console.log("=== TIMESHEET APPROVAL HIERARCHY ===\n");
  console.log("default approver = Approver Override if set, else Reporting Manager.");
  console.log("A Project Manager's OWN-project hours route to that project's Client Manager instead.\n");
  console.log("-".repeat(70));

  for (const e of employees) {
    const defaultApprover = e.approverOverride ?? e.reportingManager;
    const defaultLabel = e.approverOverride
      ? `${e.approverOverride.name} (override)`
      : e.reportingManager
      ? `${e.reportingManager.name} (reporting manager)`
      : "NONE";

    console.log(`\n${e.name}  [${e.role}]`);
    console.log(`  default approver: ${defaultLabel}`);
    if (!defaultApprover) noApprover.push(e.name);
    else if (defaultApprover.id === e.id) console.log(`    ⚠️  resolves to self -> would be BLOCKED`);

    const managed = pmProjects.get(e.id) ?? [];
    for (const p of managed) {
      const cm = p.client.clientManager;
      if (!cm) {
        console.log(`  PM of "${p.name}" (client ${p.client.name}) -> no client manager -> falls back to default`);
      } else if (cm.id === e.id) {
        console.log(`  PM of "${p.name}" -> Client Manager is THEMSELVES -> ⚠️ self-approval DEAD-END (can't submit those hours)`);
        deadEnds.push(`${e.name} — "${p.name}"`);
      } else {
        console.log(`  PM of "${p.name}" -> own-project hours approved by Client Manager: ${cm.name}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("POTENTIAL ISSUES");
  console.log("=".repeat(70));
  if (noApprover.length === 0 && deadEnds.length === 0) {
    console.log("None — every active employee has a valid approver.");
  } else {
    if (noApprover.length) {
      console.log(`\nNo approver configured (cannot submit): ${noApprover.length}`);
      noApprover.forEach((n) => console.log(`  - ${n}`));
    }
    if (deadEnds.length) {
      console.log(`\nPM = Client Manager self-approval dead-ends: ${deadEnds.length}`);
      deadEnds.forEach((n) => console.log(`  - ${n}`));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
