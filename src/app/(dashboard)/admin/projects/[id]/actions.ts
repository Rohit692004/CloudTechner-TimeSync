"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";

export async function createTask(projectId: string, formData: FormData) {
  await requireRole("TS_ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Task name is required");

  const startDateStr = formData.get("startDate") ? String(formData.get("startDate")) : null;
  const endDateStr = formData.get("endDate") ? String(formData.get("endDate")) : null;

  const startDate = startDateStr ? new Date(`${startDateStr}T00:00:00.000Z`) : null;
  const endDate = endDateStr ? new Date(`${endDateStr}T00:00:00.000Z`) : null;

  await prisma.task.create({
    data: {
      projectId,
      name,
      startDate,
      endDate,
    },
  });
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function updateTask(id: string, formData: FormData) {
  await requireRole("TS_ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Task name is required");

  const startDateStr = formData.get("startDate") ? String(formData.get("startDate")) : null;
  const endDateStr = formData.get("endDate") ? String(formData.get("endDate")) : null;

  const startDate = startDateStr ? new Date(`${startDateStr}T00:00:00.000Z`) : null;
  const endDate = endDateStr ? new Date(`${endDateStr}T00:00:00.000Z`) : null;

  const task = await prisma.task.update({
    where: { id },
    data: {
      name,
      startDate,
      endDate,
    },
  });
  revalidatePath(`/admin/projects/${task.projectId}`);
}

export async function toggleTaskActive(id: string, isActive: boolean) {
  await requireRole("TS_ADMIN");
  const task = await prisma.task.update({ where: { id }, data: { isActive } });
  revalidatePath(`/admin/projects/${task.projectId}`);
}
