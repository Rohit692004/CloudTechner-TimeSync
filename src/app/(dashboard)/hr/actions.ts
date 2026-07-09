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
