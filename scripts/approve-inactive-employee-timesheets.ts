// One-time cleanup: approve the still-pending (SUBMITTED) timesheets of employees
// who have been relieved / deactivated (isActive = false). They've left, so their
// requests can't be actioned by a manager and just sit in the queue -- this marks
// them APPROVED as of now.
//
// Safe by default: with no flag it only PREVIEWS and writes nothing. Add --apply
// to commit. Only touches TimesheetHeader rows that are SUBMITTED AND belong to an
// inactive employee: it flips status -> APPROVED, sets approvedAt = now(), and adds
// an ApprovalHistory audit row (where an approver is on record). Nothing is
// deleted; active employees and any non-SUBMITTED rows are never touched.
//
//   Preview:  npx tsx scripts/approve-inactive-employee-timesheets.ts
//   Apply:    npx tsx scripts/approve-inactive-employee-timesheets.ts --apply

import { prisma } from "@/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");

  const pending = await prisma.timesheetHeader.findMany({
    where: { status: "SUBMITTED", employee: { isActive: false } },
    include: { employee: { select: { name: true, id: true } }, approvedBy: { select: { name: true } } },
    orderBy: [{ employee: { name: "asc" } }, { weekStartDate: "asc" }],
  });

  if (pending.length === 0) {
    console.log("No pending timesheets from inactive employees. Nothing to do.");
    return;
  }

  console.log(`Found ${pending.length} SUBMITTED timesheet(s) belonging to relieved/inactive employees:\n`);
  console.log(
    "Employee".padEnd(24) + "Emp ID".padEnd(10) + "Week start".padEnd(14) + "Hours".padEnd(8) + "Approver on record"
  );
  console.log("-".repeat(90));
  for (const h of pending) {
    console.log(
      h.employee.name.slice(0, 22).padEnd(24) +
        h.employee.id.padEnd(10) +
        h.weekStartDate.toISOString().slice(0, 10).padEnd(14) +
        `${h.totalHours ?? 0}`.padEnd(8) +
        (h.approvedBy?.name ?? "(none)")
    );
  }

  const employees = new Set(pending.map((h) => h.employee.name)).size;
  console.log(`\nSummary: ${pending.length} timesheet(s) across ${employees} inactive employee(s) would be marked APPROVED.`);

  if (!apply) {
    console.log("\nThis was a PREVIEW -- nothing was changed. Re-run with --apply to approve these.");
    return;
  }

  console.log("\nApplying...");
  const now = new Date();
  const ids = pending.map((h) => h.id);
  await prisma.$transaction([
    prisma.timesheetHeader.updateMany({
      // Guard on status again so we never touch a row that changed since preview.
      where: { id: { in: ids }, status: "SUBMITTED" },
      data: { status: "APPROVED", approvedAt: now },
    }),
    // Audit trail, only for rows that have an approver on record (actorId is required).
    ...pending
      .filter((h) => h.approvedById)
      .map((h) =>
        prisma.approvalHistory.create({
          data: {
            timesheetHeaderId: h.id,
            actorId: h.approvedById as string,
            action: "APPROVED",
            comments: "Auto-approved: employee relieved/deactivated.",
          },
        })
      ),
  ]);
  console.log(`Done. Approved ${pending.length} timesheet(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
