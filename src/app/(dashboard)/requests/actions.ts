"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";

export async function submitAllocationRequest(
  message: string
) {
  const user = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");

  // Create allocation request
  await prisma.allocationRequest.create({
    data: {
      employeeId: user.id,
      projectId: null,
      allocationPercentage: 100,
      message: message.trim() || null,
      status: "PENDING",
    },
  });

  revalidatePath("/requests");
}

export async function approveAllocationRequest(
  requestId: string,
  projectId: string,
  startDateStr: string,
  endDateStr: string | null,
  allocationPercentage: number
) {
  const user = await requireRole("TS_ADMIN", "HR_ADMIN");

  const request = await prisma.allocationRequest.findUnique({
    where: { id: requestId },
    include: {
      employee: { select: { name: true } },
    },
  });

  if (!request) {
    throw new Error("Request not found.");
  }
  if (request.status !== "PENDING") {
    throw new Error("Request has already been processed.");
  }

  const approvedProject = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!approvedProject) {
    throw new Error("Selected project not found.");
  }

  const startDate = new Date(startDateStr);
  const endDate = endDateStr ? new Date(endDateStr) : null;

  // Run in transaction to guarantee consistency
  await prisma.$transaction([
    // Update request status, and link the project/percentage determined by admin
    prisma.allocationRequest.update({
      where: { id: requestId },
      data: { 
        status: "APPROVED",
        projectId,
        allocationPercentage,
      },
    }),
    // Create project allocation
    prisma.projectAllocation.create({
      data: {
        projectId,
        employeeId: request.employeeId,
        allocationPercentage,
        startDate,
        endDate,
        createdById: user.id,
      },
    }),
    // Create notification for employee
    prisma.notification.create({
      data: {
        employeeId: request.employeeId,
        message: `Allocation Approved: You have been allocated to the project "${approvedProject.name}" (${allocationPercentage}%) starting ${startDateStr}${endDateStr ? ` until ${endDateStr}` : ""}.`,
      },
    }),
  ]);

  revalidatePath("/requests");
  revalidatePath("/employee");
}

export async function rejectAllocationRequest(requestId: string, comment?: string) {
  const user = await requireRole("TS_ADMIN", "HR_ADMIN");

  const request = await prisma.allocationRequest.findUnique({
    where: { id: requestId },
    include: {
      project: { select: { name: true } },
    },
  });

  if (!request) {
    throw new Error("Request not found.");
  }
  if (request.status !== "PENDING") {
    throw new Error("Request has already been processed.");
  }

  const projectName = request.project?.name ?? "allocation";

  await prisma.$transaction([
    prisma.allocationRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    }),
    prisma.notification.create({
      data: {
        employeeId: request.employeeId,
        message: `Allocation Rejected: Your request for "${projectName}" was declined.${comment ? ` Reason: ${comment}` : ""}`,
      },
    }),
  ]);

  revalidatePath("/requests");
}

export async function dismissNotification(notificationId: string) {
  const user = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");

  await prisma.notification.updateMany({
    where: { id: notificationId, employeeId: user.id },
    data: { isRead: true },
  });

  revalidatePath("/employee");
  revalidatePath("/requests");
}

export async function dismissAllNotifications() {
  const user = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");

  await prisma.notification.updateMany({
    where: { employeeId: user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/employee");
  revalidatePath("/requests");
}
