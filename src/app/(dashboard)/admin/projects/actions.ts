"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import type { BillingModel, ProjectStatus, CommentsCriteria } from "@prisma/client";

const DEFAULT_TASK_TEMPLATE = ["Project work", "Project work - WFH", "Project work - Client", "Training"];

const PROJECT_STATUS_VALUES = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"];
const BILLING_MODEL_VALUES = ["TIME_AND_MATERIAL", "FIXED_FEE", "RETAINER", "NON_BILLABLE"];
const COMMENTS_CRITERIA_VALUES = ["NOT_REQUIRED", "COMPULSORY", "LESS_THAN_8_HOURS", "MORE_THAN_8_HOURS"];

function str(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function parseDate(formData: FormData, key: string): Date | null {
  const v = str(formData, key);
  return v ? new Date(`${v}T00:00:00.000Z`) : null;
}

function parseDecimal(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function createProject(formData: FormData) {
  await requireRole("TS_ADMIN");

  const clientId = str(formData, "clientId");
  const name = str(formData, "name");
  const code = str(formData, "code");

  if (!clientId) throw new Error("Client is required");
  if (!name) throw new Error("Project name is required");
  if (code) {
    const existing = await prisma.project.findUnique({ where: { code } });
    if (existing) throw new Error(`Project code ${code} is already in use`);
  }

  const statusRaw = str(formData, "status") ?? "IN_PROGRESS";
  const status = (PROJECT_STATUS_VALUES.includes(statusRaw) ? statusRaw : "IN_PROGRESS") as ProjectStatus;

  const billingRaw = str(formData, "billingModel") ?? "TIME_AND_MATERIAL";
  const billingModel = (BILLING_MODEL_VALUES.includes(billingRaw) ? billingRaw : "TIME_AND_MATERIAL") as BillingModel;

  const commentsCriteriaRaw = str(formData, "commentsCriteria") ?? "COMPULSORY";
  const commentsCriteria = (COMMENTS_CRITERIA_VALUES.includes(commentsCriteriaRaw) ? commentsCriteriaRaw : "COMPULSORY") as CommentsCriteria;

  const startDate = parseDate(formData, "startDate");
  const endDate = parseDate(formData, "endDate");
  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date can't be before start date");
  }

  await prisma.project.create({
    data: {
      clientId,
      name,
      code,
      status,
      projectManagerId: str(formData, "projectManagerId"),
      description: str(formData, "description"),
      startDate,
      endDate,
      costBudget: parseDecimal(formData, "costBudget"),
      hoursBudget: parseDecimal(formData, "hoursBudget"),
      billingModel,
      commentsCriteria,
      linkExpenses: formData.get("linkExpenses") === "on",
      tasks: {
        create: DEFAULT_TASK_TEMPLATE.map((taskName) => ({
          name: taskName,
          isDefaultTemplate: true,
          startDate,
          endDate,
        })),
      },
    },
  });

  revalidatePath("/admin/projects");
}

export async function toggleProjectActive(id: string, isActive: boolean) {
  await requireRole("TS_ADMIN");
  await prisma.project.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/projects");
}

export async function updateProject(id: string, formData: FormData) {
  const admin = await requireRole("TS_ADMIN");

  const name = str(formData, "name");
  if (!name) throw new Error("Project name is required");

  const statusRaw = str(formData, "status") ?? "IN_PROGRESS";
  const status = (PROJECT_STATUS_VALUES.includes(statusRaw) ? statusRaw : "IN_PROGRESS") as ProjectStatus;

  const billingRaw = str(formData, "billingModel") ?? "TIME_AND_MATERIAL";
  const billingModel = (BILLING_MODEL_VALUES.includes(billingRaw) ? billingRaw : "TIME_AND_MATERIAL") as BillingModel;

  const commentsCriteriaRaw = str(formData, "commentsCriteria") ?? "COMPULSORY";
  const commentsCriteria = (COMMENTS_CRITERIA_VALUES.includes(commentsCriteriaRaw) ? commentsCriteriaRaw : "COMPULSORY") as CommentsCriteria;

  const startDate = parseDate(formData, "startDate");
  const endDate = parseDate(formData, "endDate");
  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date can't be before start date");
  }

  const existingProject = await prisma.project.findUniqueOrThrow({ where: { id } });

  let descriptionAppend = "";
  if (endDate) {
    const oldEndStr = existingProject.endDate ? existingProject.endDate.toISOString().slice(0, 10) : "Open";
    const newEndStr = endDate.toISOString().slice(0, 10);
    if (oldEndStr !== newEndStr) {
      const timestamp = new Date().toLocaleString("en-US");
      descriptionAppend = `\n[Log: End date extended from ${oldEndStr} to ${newEndStr} by ${admin.name} on ${timestamp}]`;

      // Extend default allocations matching old end date
      await prisma.projectAllocation.updateMany({
        where: {
          projectId: id,
          endDate: existingProject.endDate,
        },
        data: {
          endDate: endDate,
        },
      });

      // Extend default tasks
      await prisma.task.updateMany({
        where: {
          projectId: id,
          isDefaultTemplate: true,
        },
        data: {
          endDate: endDate,
        },
      });
    }
  }

  const currentDesc = str(formData, "description") ?? "";
  const finalDesc = currentDesc + descriptionAppend;

  await prisma.project.update({
    where: { id },
    data: {
      name,
      status,
      projectManagerId: str(formData, "projectManagerId"),
      description: finalDesc || null,
      startDate,
      endDate,
      costBudget: parseDecimal(formData, "costBudget"),
      hoursBudget: parseDecimal(formData, "hoursBudget"),
      billingModel,
      commentsCriteria,
      linkExpenses: formData.get("linkExpenses") === "on",
    },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
}
