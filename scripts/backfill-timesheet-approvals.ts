// One-time backfill for the per-project approval rollout. Any timesheet that was
// already SUBMITTED (pending) under the old single-approver flow has no
// TimesheetApproval rows, so it would be invisible in the new per-project
// Approvals page. This creates the missing per-project approval slices for those
// pending timesheets so nothing is orphaned.
//
// SAFE / ADDITIVE: it only reads timesheets and CREATES new TimesheetApproval
// rows. It never modifies or deletes any TimesheetHeader, TimesheetLine, or other
// existing data. APPROVED / REJECTED / DRAFT timesheets are left untouched, and a
// header that already has approval rows is skipped (idempotent).
//
//   Preview:  npx tsx scripts/backfill-timesheet-approvals.ts
//   Apply:    npx tsx scripts/backfill-timesheet-approvals.ts --apply

import { prisma } from "@/lib/prisma";
import { resolveProjectApprover } from "@/lib/approval";

async function main() {
  const apply = process.argv.includes("--apply");

  const pending = await prisma.timesheetHeader.findMany({
    where: { status: "SUBMITTED", projectApprovals: { none: {} } },
    include: {
      employee: { select: { id: true, name: true, approverOverrideId: true, reportingManagerId: true } },
      lines: { include: { task: { select: { projectId: true, project: { select: { name: true, projectManagerId: true, client: { select: { clientManagerId: true } } } } } } } },
    },
  });

  if (pending.length === 0) {
    console.log("No pending (SUBMITTED) timesheets without approval rows. Nothing to backfill.");
    return;
  }

  type Row = { headerId: string; employee: string; projectId: string; projectName: string; approverId: string | null };
  const toCreate: Row[] = [];
  const unresolved: Row[] = [];

  for (const h of pending) {
    const seen = new Set<string>();
    for (const line of h.lines) {
      const proj = line.task.project;
      const projectId = line.task.projectId;
      if (seen.has(projectId)) continue;
      seen.add(projectId);
      const approverId = resolveProjectApprover({
        employeeId: h.employee.id,
        approverOverrideId: h.employee.approverOverrideId,
        reportingManagerId: h.employee.reportingManagerId,
        projectManagerId: proj.projectManagerId,
        clientManagerId: proj.client?.clientManagerId ?? null,
      });
      const row: Row = { headerId: h.id, employee: h.employee.name, projectId, projectName: proj.name, approverId };
      if (approverId) toCreate.push(row);
      else unresolved.push(row);
    }
  }

  console.log(`${pending.length} pending timesheet(s) without approval rows.`);
  console.log(`${toCreate.length} project slice(s) will be created:\n`);
  for (const r of toCreate) console.log(`  ${r.employee.slice(0, 20).padEnd(22)} ${r.projectName.slice(0, 28).padEnd(30)} -> approver ${r.approverId}`);
  if (unresolved.length > 0) {
    console.log(`\n${unresolved.length} slice(s) have NO resolvable approver (left pending, needs manual fix):`);
    for (const r of unresolved) console.log(`  ${r.employee} — ${r.projectName}`);
  }

  if (!apply) {
    console.log("\nThis was a PREVIEW -- nothing was written. Re-run with --apply.");
    return;
  }

  await prisma.timesheetApproval.createMany({
    data: toCreate.map((r) => ({ timesheetHeaderId: r.headerId, projectId: r.projectId, approverId: r.approverId!, status: "PENDING" as const })),
    skipDuplicates: true,
  });
  console.log(`\nDone. Created ${toCreate.length} approval slice(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
