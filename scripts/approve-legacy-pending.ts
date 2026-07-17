// One-time cleanup: close out the historical timesheets that were IMPORTED in a
// SUBMITTED (pending) state, so they don't sit forever in the project managers'
// new per-project Approvals queue. It marks each such week APPROVED and marks its
// per-project approval slices APPROVED.
//
// SAFE / TARGETED: by default it only touches weeks BEFORE the current week
// (weekStartDate < this Monday), so genuine new submissions for the current week
// are never auto-approved. Preview-first: writes nothing without --apply. Only
// TimesheetHeader.status/approvedAt and TimesheetApproval.status/approvedAt are
// changed (plus an audit row); no lines or other data are touched.
//
//   Preview:  npx tsx scripts/approve-legacy-pending.ts
//   Apply:    npx tsx scripts/approve-legacy-pending.ts --apply

import { prisma } from "@/lib/prisma";
import { mondayOf, toISODate } from "@/lib/dates";

async function main() {
  const apply = process.argv.includes("--apply");
  const currentWeekMonday = mondayOf(new Date());

  const pending = await prisma.timesheetHeader.findMany({
    where: { status: "SUBMITTED", weekStartDate: { lt: currentWeekMonday } },
    include: { employee: { select: { name: true } }, projectApprovals: { select: { id: true, status: true } } },
    orderBy: [{ employee: { name: "asc" } }, { weekStartDate: "asc" }],
  });

  if (pending.length === 0) {
    console.log("No historical pending timesheets (SUBMITTED, before this week). Nothing to do.");
    return;
  }

  console.log(`${pending.length} historical pending week(s) will be marked APPROVED (weeks before ${toISODate(currentWeekMonday)}):\n`);
  console.log("Employee".padEnd(24) + "Week".padEnd(14) + "Slices");
  console.log("-".repeat(60));
  for (const h of pending) {
    console.log(h.employee.name.slice(0, 22).padEnd(24) + toISODate(h.weekStartDate).padEnd(14) + `${h.projectApprovals.length}`);
  }
  const totalSlices = pending.reduce((s, h) => s + h.projectApprovals.length, 0);
  console.log(`\nSummary: ${pending.length} week(s) / ${totalSlices} project slice(s) would be APPROVED.`);

  if (!apply) {
    console.log("\nThis was a PREVIEW -- nothing was changed. Re-run with --apply.");
    return;
  }

  const now = new Date();
  const ids = pending.map((h) => h.id);
  await prisma.$transaction([
    prisma.timesheetApproval.updateMany({ where: { timesheetHeaderId: { in: ids }, status: "PENDING" }, data: { status: "APPROVED", approvedAt: now } }),
    prisma.timesheetHeader.updateMany({ where: { id: { in: ids }, status: "SUBMITTED" }, data: { status: "APPROVED", approvedAt: now } }),
    ...pending.map((h) => prisma.approvalHistory.create({ data: { timesheetHeaderId: h.id, actorId: h.employeeId, action: "APPROVED", comments: "Auto-approved: historical imported timesheet." } })),
  ]);
  console.log(`\nDone. Approved ${pending.length} historical week(s) / ${totalSlices} slice(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
