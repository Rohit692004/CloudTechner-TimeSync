"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";

export async function approveLateSubmission(timesheetHeaderId: string) {
  const user = await requireRole("HR_ADMIN");

  await prisma.$transaction(async (tx) => {
    // 1. Update lateApproved to true
    const timesheet = await tx.timesheetHeader.update({
      where: { id: timesheetHeaderId },
      data: {
        lateApproved: true,
      },
    });

    // 2. Add history log
    await tx.approvalHistory.create({
      data: {
        timesheetHeaderId: timesheet.id,
        actorId: user.id,
        action: "LATE_APPROVED",
        comments: `Late submission approved by HR Admin (${user.name})`,
      },
    });
  });

  revalidatePath("/hr");
  revalidatePath("/employee");
}

export async function rejectLateSubmission(timesheetHeaderId: string, comments: string) {
  const user = await requireRole("HR_ADMIN");

  await prisma.$transaction(async (tx) => {
    // 1. Update status to REJECTED and rejection comments
    const timesheet = await tx.timesheetHeader.update({
      where: { id: timesheetHeaderId },
      data: {
        status: "REJECTED",
        rejectionComments: comments || "Late submission rejected by HR Admin.",
      },
    });

    // 2. Add history log
    await tx.approvalHistory.create({
      data: {
        timesheetHeaderId: timesheet.id,
        actorId: user.id,
        action: "LATE_REJECTED",
        comments: comments || "Late submission rejected by HR Admin.",
      },
    });
  });

  revalidatePath("/hr");
  revalidatePath("/employee");
}

export async function sendTimesheetReminder(employeeId: string, weekStartISO: string) {
  const user = await requireRole("HR_ADMIN");

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: { name: true, reportingManagerId: true },
  });

  // 1. Notify employee
  await prisma.notification.create({
    data: {
      employeeId,
      message: "Hr asked to fill the timesheet",
    },
  });

  // 2. Notify reporting manager
  if (employee.reportingManagerId) {
    await prisma.notification.create({
      data: {
        employeeId: employee.reportingManagerId,
        message: `${employee.name} did not fill the timesheet of previous week.`,
      },
    });
  }

  revalidatePath("/hr");
  revalidatePath("/employee");
}
