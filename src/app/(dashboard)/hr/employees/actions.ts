"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import bcrypt from "bcryptjs";
import { EmployeeRole } from "@prisma/client";

function str(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
}

const MIN_PASSWORD_LENGTH = 8;

function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("Password must contain at least one letter and one number.");
  }
}

export async function createEmployee(formData: FormData) {
  await requireRole("HR_ADMIN");

  const id = str(formData, "id");
  if (!id) throw new Error("Employee ID is required");

  // Check if ID is already in use
  const existingId = await prisma.employee.findUnique({ where: { id } });
  if (existingId) throw new Error(`Employee ID ${id} is already in use`);

  const name = str(formData, "name");
  if (!name) throw new Error("Employee name is required");

  const email = str(formData, "email");
  if (!email) throw new Error("Employee email is required");

  // Check if email is already in use
  const existingEmail = await prisma.employee.findUnique({ where: { email } });
  if (existingEmail) throw new Error(`Email ${email} is already in use`);

  const roleStr = str(formData, "role") || "EMPLOYEE";
  const role = roleStr as EmployeeRole;

  const phone = str(formData, "phone");
  const title = str(formData, "title");
  const reportingManagerId = str(formData, "reportingManagerId");
  if (!reportingManagerId || reportingManagerId === "none") {
    throw new Error("Reporting Manager is required");
  }
  const approverOverrideRaw = str(formData, "approverOverrideId");
  const approverOverrideId = approverOverrideRaw === "none" ? null : approverOverrideRaw;
  const password = str(formData, "password");
  if (!password) throw new Error("Login password is required.");
  validatePassword(password);

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.employee.create({
    data: {
      id,
      name,
      email,
      phone,
      title,
      role,
      reportingManagerId,
      approverOverrideId,
      passwordHash,
      isActive: true,
    },
  });

  revalidatePath("/hr/employees");
}

export async function toggleEmployeeActive(id: string, isActive: boolean) {
  await requireRole("HR_ADMIN");

  // Prevent HR admin from deactivating themselves
  const sessionUser = await requireRole("HR_ADMIN");
  if (sessionUser.id === id && !isActive) {
    throw new Error("You cannot deactivate your own profile.");
  }

  await prisma.employee.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/hr/employees");
}

export type ProjectHistoryEntry = {
  id: string;
  projectName: string;
  clientName: string;
  allocationPercentage: number;
  startDate: string;
  endDate: string | null;
  status: "Upcoming" | "Active" | "Ended" | "Project Inactive";
};

export async function getEmployeeProjectHistory(employeeId: string): Promise<ProjectHistoryEntry[]> {
  await requireRole("HR_ADMIN");

  const allocations = await prisma.projectAllocation.findMany({
    where: { employeeId },
    include: { project: { include: { client: true } } },
    orderBy: { startDate: "desc" },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return allocations.map((a) => {
    let status: ProjectHistoryEntry["status"];
    if (a.endDate && a.endDate <= today) status = "Ended";
    else if (!a.project.isActive) status = "Project Inactive";
    else if (a.startDate > today) status = "Upcoming";
    else status = "Active";

    return {
      id: a.id,
      projectName: a.project.name,
      clientName: a.project.client.name,
      allocationPercentage: a.allocationPercentage,
      startDate: a.startDate.toISOString().slice(0, 10),
      endDate: a.endDate ? a.endDate.toISOString().slice(0, 10) : null,
      status,
    };
  });
}

export async function updateEmployee(id: string, formData: FormData) {
  await requireRole("HR_ADMIN");

  const name = str(formData, "name");
  if (!name) throw new Error("Employee name is required");

  const roleStr = str(formData, "role") || "EMPLOYEE";
  const role = roleStr as EmployeeRole;

  const phone = str(formData, "phone");
  const title = str(formData, "title");

  const reportingManagerId = str(formData, "reportingManagerId");
  if (!reportingManagerId || reportingManagerId === "none") {
    throw new Error("Reporting Manager is required");
  }

  const approverOverrideId = str(formData, "approverOverrideId");
  const password = str(formData, "password");

  const updateData: any = {
    name,
    role,
    phone,
    title,
    reportingManagerId,
    approverOverrideId: approverOverrideId === "none" ? null : approverOverrideId,
  };

  if (password && password.trim() !== "") {
    validatePassword(password.trim());
    updateData.passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  await prisma.employee.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/hr/employees");
}
