"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { addDays, mondayOf, toISODate } from "@/lib/dates";

function parseLines(formData: FormData) {
  const lines: { taskId: string; workDate: string; hours: number; notes: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("hours__")) continue;
    const [, taskId, workDate] = key.split("__");
    const hours = Number(value);
    if (Number.isFinite(hours) && hours > 0) {
      const notes = String(formData.get(`notes__${taskId}__${workDate}`) ?? "").trim();
      lines.push({ taskId, workDate, hours, notes });
    }
  }
  return lines;
}

async function upsertTimesheet(
  employeeId: string,
  weekStartISO: string,
  formData: FormData,
  targetStatus: "DRAFT" | "SUBMITTED"
) {
  const weekStartDate = mondayOf(new Date(`${weekStartISO}T00:00:00.000Z`));
  const lines = parseLines(formData);

  // Validate future dates
  const todayStr = toISODate(new Date());
  for (const line of lines) {
    if (line.workDate > todayStr) {
      throw new Error(`You cannot log hours for future dates (attempted to log for ${line.workDate}).`);
    }
  }

  const existing = await prisma.timesheetHeader.findUnique({
    where: { employeeId_weekStartDate: { employeeId, weekStartDate } },
  });

  if (existing && !["DRAFT", "REJECTED"].includes(existing.status)) {
    throw new Error(
      `This timesheet is already ${existing.status.toLowerCase()} and can't be edited.`
    );
  }

  let approvedById: string | null = existing?.approvedById ?? null;

  if (targetStatus === "SUBMITTED") {
    // Check if any line with hours > 0 has empty notes/comments
    const hasEmptyNotes = lines.some((l) => !l.notes);
    if (hasEmptyNotes) {
      throw new Error("A comment/notes description is required for every day you log hours.");
    }

    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    
    // If project manager is working on their own project, approval goes to client manager.
    let clientManagerIdForPM: string | null = null;
    const taskIds = lines.map((l) => l.taskId);
    if (taskIds.length > 0) {
      const projectsWithManager = await prisma.project.findMany({
        where: {
          tasks: { some: { id: { in: taskIds } } },
        },
        include: { client: true },
      });

      for (const proj of projectsWithManager) {
        if (proj.projectManagerId === employeeId && proj.client?.clientManagerId) {
          clientManagerIdForPM = proj.client.clientManagerId;
          break;
        }
      }
    }

    approvedById = clientManagerIdForPM ?? employee.approverOverrideId ?? employee.reportingManagerId;

    if (!approvedById) {
      throw new Error("No approver is configured for this employee. Contact Timesheet Admin.");
    }
    if (approvedById === employeeId) {
      throw new Error("Resolved approver can't be yourself. Contact Timesheet Admin.");
    }
  }

  const currentWeekMonday = mondayOf(new Date());
  const diffTime = currentWeekMonday.getTime() - weekStartDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const isOverdue = diffDays > 14;

  const totalHours = lines.reduce((s, l) => s + l.hours, 0);

  await prisma.$transaction(async (tx) => {
    const header = await tx.timesheetHeader.upsert({
      where: { employeeId_weekStartDate: { employeeId, weekStartDate } },
      create: {
        employeeId,
        weekStartDate,
        status: targetStatus,
        rejectionComments: null,
        totalHours,
        isLate: targetStatus === "SUBMITTED" ? isOverdue : false,
        lateApproved: false,
        approvedById: targetStatus === "SUBMITTED" ? approvedById : null,
        submittedAt: targetStatus === "SUBMITTED" ? new Date() : null,
      },
      update: {
        status: targetStatus,
        rejectionComments: targetStatus === "SUBMITTED" ? null : undefined,
        totalHours,
        isLate: targetStatus === "SUBMITTED" ? isOverdue : undefined,
        lateApproved: targetStatus === "SUBMITTED" && isOverdue ? false : undefined,
        approvedById: targetStatus === "SUBMITTED" ? approvedById : undefined,
        submittedAt: targetStatus === "SUBMITTED" ? new Date() : undefined,
      },
    });

    await tx.timesheetLine.deleteMany({ where: { timesheetHeaderId: header.id } });
    if (lines.length > 0) {
      await tx.timesheetLine.createMany({
        data: lines.map((l) => ({
          timesheetHeaderId: header.id,
          taskId: l.taskId,
          workDate: new Date(`${l.workDate}T00:00:00.000Z`),
          hours: l.hours,
          notes: l.notes || null,
        })),
      });
    }

    if (targetStatus === "SUBMITTED") {
      await tx.approvalHistory.create({
        data: {
          timesheetHeaderId: header.id,
          actorId: employeeId,
          action: isOverdue 
            ? "SUBMITTED_LATE" 
            : (existing?.status === "REJECTED" ? "RESUBMITTED" : "SUBMITTED"),
          comments: isOverdue 
            ? "Late submission requested (Pending HR approval)" 
            : (existing?.status === "REJECTED" ? "Resubmitted timesheet" : "Submitted timesheet"),
        },
      });
    } else if (targetStatus === "DRAFT") {
      await tx.approvalHistory.create({
        data: {
          timesheetHeaderId: header.id,
          actorId: employeeId,
          action: "SAVED_DRAFT",
          comments: "Draft saved",
        },
      });
    }
  });

  revalidatePath("/employee");
  revalidatePath("/manager");
}

export async function saveDraft(weekStartISO: string, formData: FormData) {
  const user = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");
  await upsertTimesheet(user.id, weekStartISO, formData, "DRAFT");
}

export async function submitTimesheet(weekStartISO: string, formData: FormData) {
  const user = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");
  await upsertTimesheet(user.id, weekStartISO, formData, "SUBMITTED");
}

export async function withdrawTimesheet(weekStartISO: string) {
  const user = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");
  const weekStartDate = mondayOf(new Date(`${weekStartISO}T00:00:00.000Z`));

  const existing = await prisma.timesheetHeader.findUnique({
    where: { employeeId_weekStartDate: { employeeId: user.id, weekStartDate } },
  });

  if (!existing || existing.status !== "SUBMITTED") {
    throw new Error("Only submitted timesheets can be withdrawn.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.timesheetHeader.update({
      where: { id: existing.id },
      data: { status: "DRAFT" },
    });

    await tx.approvalHistory.create({
      data: {
        timesheetHeaderId: existing.id,
        actorId: user.id,
        action: "WITHDRAWN",
        comments: "Withdrawn by employee",
      },
    });
  });

  revalidatePath("/employee");
}



