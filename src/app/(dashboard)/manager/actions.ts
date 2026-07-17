"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import type { Prisma } from "@prisma/client";

// Recompute the parent week's status from its per-project approval slices:
// REJECTED if any slice is rejected; APPROVED once every slice is approved;
// otherwise still SUBMITTED (partially approved).
async function rollupHeaderStatus(tx: Prisma.TransactionClient, timesheetHeaderId: string) {
  const slices = await tx.timesheetApproval.findMany({
    where: { timesheetHeaderId },
    select: { status: true, comments: true },
  });
  let status: "SUBMITTED" | "APPROVED" | "REJECTED" = "SUBMITTED";
  if (slices.some((s) => s.status === "REJECTED")) status = "REJECTED";
  else if (slices.length > 0 && slices.every((s) => s.status === "APPROVED")) status = "APPROVED";

  await tx.timesheetHeader.update({
    where: { id: timesheetHeaderId },
    data: {
      status,
      approvedAt: status === "APPROVED" ? new Date() : null,
      rejectionComments: status === "REJECTED" ? slices.find((s) => s.status === "REJECTED")?.comments ?? null : null,
    },
  });
}

// Approve one project's slice of a submitted week.
export async function approveProjectApproval(approvalId: string) {
  const manager = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");

  const approval = await prisma.timesheetApproval.findUniqueOrThrow({
    where: { id: approvalId },
    include: { timesheetHeader: { select: { id: true, employeeId: true } } },
  });
  if (approval.approverId !== manager.id) throw new Error("You are not the assigned approver for this project.");
  if (approval.timesheetHeader.employeeId === manager.id) throw new Error("You can't approve your own timesheet.");
  if (approval.status !== "PENDING") throw new Error(`This project slice is already ${approval.status.toLowerCase()}.`);

  await prisma.$transaction(async (tx) => {
    await tx.timesheetApproval.update({
      where: { id: approvalId },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    await tx.approvalHistory.create({
      data: { timesheetHeaderId: approval.timesheetHeader.id, actorId: manager.id, action: "APPROVED", comments: "Project slice approved" },
    });
    await rollupHeaderStatus(tx, approval.timesheetHeader.id);
  });

  revalidatePath("/manager");
  revalidatePath("/employee");
  revalidatePath("/hr");
}

// Reject one project's slice (rejects the whole week back to the employee).
export async function rejectProjectApproval(approvalId: string, comments: string) {
  const manager = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");
  if (!comments.trim()) throw new Error("Rejection comments are required.");

  const approval = await prisma.timesheetApproval.findUniqueOrThrow({
    where: { id: approvalId },
    include: { timesheetHeader: { select: { id: true, employeeId: true } } },
  });
  if (approval.approverId !== manager.id) throw new Error("You are not the assigned approver for this project.");
  if (approval.status !== "PENDING") throw new Error(`This project slice is already ${approval.status.toLowerCase()}.`);

  await prisma.$transaction(async (tx) => {
    await tx.timesheetApproval.update({
      where: { id: approvalId },
      data: { status: "REJECTED", comments },
    });
    await tx.approvalHistory.create({
      data: { timesheetHeaderId: approval.timesheetHeader.id, actorId: manager.id, action: "REJECTED", comments },
    });
    await rollupHeaderStatus(tx, approval.timesheetHeader.id);
  });

  revalidatePath("/manager");
  revalidatePath("/employee");
  revalidatePath("/hr");
}

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
