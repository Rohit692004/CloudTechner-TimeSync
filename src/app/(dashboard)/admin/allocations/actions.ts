"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getMaxOverlapPercentage, isValidAllocationPercentage } from "@/lib/allocation";

function parseDate(value: FormDataEntryValue | null): Date | null {
  const str = String(value ?? "").trim();
  if (!str) return null;
  return new Date(`${str}T00:00:00.000Z`);
}

export async function createAllocation(formData: FormData) {
  const admin = await requireRole("TS_ADMIN");

  const employeeId = String(formData.get("employeeId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const percentage = Number(formData.get("percentage"));
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));

  if (!employeeId) throw new Error("Employee is required");
  if (!projectId) throw new Error("Project is required");
  if (!startDate) throw new Error("Start date is required");
  if (endDate && endDate < startDate) throw new Error("End date can't be before start date");
  if (!isValidAllocationPercentage(percentage)) {
    throw new Error("Allocation must be between 5% and 100%, in 5% steps");
  }

  // Allow overallocation:
  // const maxExisting = await getMaxOverlapPercentage(employeeId, startDate, endDate);
  // if (maxExisting + percentage > 100) {
  //   throw new Error(
  //     `This would push ${maxExisting + percentage}% allocation on overlapping dates (max is 100%). ` +
  //       `This employee is already allocated ${maxExisting}% during part of this range.`
  //   );
  // }

  await prisma.projectAllocation.create({
    data: {
      employeeId,
      projectId,
      allocationPercentage: percentage,
      startDate,
      endDate,
      createdById: admin.id,
    },
  });

  revalidatePath("/admin/allocations");
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function endAllocationToday(id: string) {
  await requireRole("TS_ADMIN");
  const allocation = await prisma.projectAllocation.findUnique({
    where: { id },
  });
  if (!allocation) throw new Error("Allocation not found");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  // Set to yesterday if yesterday >= startDate, otherwise set to startDate.
  const newEndDate = yesterday >= allocation.startDate ? yesterday : allocation.startDate;

  await prisma.projectAllocation.update({
    where: { id },
    data: { endDate: newEndDate },
  });
  revalidatePath("/admin/allocations");
  revalidatePath(`/admin/projects/${allocation.projectId}`);
}

export async function updateAllocationDates(id: string, startDateStr: string, endDateStr: string | null) {
  await requireRole("TS_ADMIN");

  if (!startDateStr) throw new Error("Start date is required");
  const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
  const endDate = endDateStr ? new Date(`${endDateStr}T00:00:00.000Z`) : null;
  if (endDate && endDate < startDate) throw new Error("End date can't be before start date");

  let updated;
  try {
    updated = await prisma.projectAllocation.update({
      where: { id },
      data: { startDate, endDate },
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      throw new Error("This employee already has an allocation to this project starting on that date.");
    }
    throw e;
  }

  revalidatePath("/admin/allocations");
  revalidatePath(`/admin/projects/${updated.projectId}`);
}

export async function deleteAllocation(id: string) {
  await requireRole("TS_ADMIN");
  const allocation = await prisma.projectAllocation.delete({ where: { id } });
  revalidatePath("/admin/allocations");
  revalidatePath(`/admin/projects/${allocation.projectId}`);
}

export async function createBulkAllocations(
  projectId: string,
  startDateStr: string,
  endDateStr: string,
  allocations: { employeeId: string; percentage: number }[]
) {
  const admin = await requireRole("TS_ADMIN");

  if (!projectId) throw new Error("Project is required");
  if (!startDateStr) throw new Error("Start date is required");

  const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
  const endDate = endDateStr ? new Date(`${endDateStr}T00:00:00.000Z`) : null;

  if (endDate && endDate < startDate) throw new Error("End date can't be before start date");

  await prisma.$transaction(
    allocations.map((a) => {
      if (!isValidAllocationPercentage(a.percentage)) {
        throw new Error(`Allocation percentage must be between 5% and 100% (in 5% steps).`);
      }
      return prisma.projectAllocation.create({
        data: {
          employeeId: a.employeeId,
          projectId,
          allocationPercentage: a.percentage,
          startDate,
          endDate,
          createdById: admin.id,
        },
      });
    })
  );

  revalidatePath("/admin/allocations");
  revalidatePath(`/admin/projects/${projectId}`);
}
