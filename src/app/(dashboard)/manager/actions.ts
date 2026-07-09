"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";

export async function approveTimesheet(timesheetHeaderId: string) {
  const manager = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");

  const header = await prisma.timesheetHeader.findUniqueOrThrow({
    where: { id: timesheetHeaderId },
  });

  if (header.approvedById !== manager.id) {
    throw new Error("You are not the assigned approver for this timesheet.");
  }
  if (header.employeeId === manager.id) {
    throw new Error("You can't approve your own timesheet.");
  }
  if (header.status !== "SUBMITTED") {
    throw new Error(`Timesheet is ${header.status.toLowerCase()}, not pending.`);
  }

  await prisma.$transaction([
    prisma.timesheetHeader.update({
      where: { id: timesheetHeaderId },
      data: { status: "APPROVED", approvedAt: new Date() },
    }),
    prisma.approvalHistory.create({
      data: { timesheetHeaderId, actorId: manager.id, action: "APPROVED" },
    }),
  ]);

  revalidatePath("/manager");
  revalidatePath("/hr");
}

export async function rejectTimesheet(timesheetHeaderId: string, comments: string) {
  const manager = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");

  if (!comments.trim()) throw new Error("Rejection comments are required.");

  const header = await prisma.timesheetHeader.findUniqueOrThrow({
    where: { id: timesheetHeaderId },
  });

  if (header.approvedById !== manager.id) {
    throw new Error("You are not the assigned approver for this timesheet.");
  }
  if (header.status !== "SUBMITTED") {
    throw new Error(`Timesheet is ${header.status.toLowerCase()}, not pending.`);
  }

  await prisma.$transaction([
    prisma.timesheetHeader.update({
      where: { id: timesheetHeaderId },
      data: { status: "REJECTED", rejectionComments: comments },
    }),
    prisma.approvalHistory.create({
      data: { timesheetHeaderId, actorId: manager.id, action: "REJECTED", comments },
    }),
  ]);

  revalidatePath("/manager");
  revalidatePath("/hr");
}
