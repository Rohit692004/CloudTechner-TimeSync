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

  // Fetch active project allocations for the employee in the relevant timeframe.
  // project.isActive is enforced here too (not just when building the grid in
  // employee/page.tsx) so a deactivated project's tasks are rejected server-side,
  // not just hidden from the UI.
  const allocations = await prisma.projectAllocation.findMany({
    where: {
      employeeId,
      startDate: { lte: addDays(weekStartDate, 6) },
      OR: [{ endDate: null }, { endDate: { gte: weekStartDate } }],
      project: { isActive: true },
    },
    include: {
      project: {
        include: {
          tasks: true,
        },
      },
    },
  });

  // Validate future dates & project allocations
  const todayStr = toISODate(new Date());
  for (const line of lines) {
    if (line.workDate > todayStr) {
      throw new Error(`You cannot log hours for future dates (attempted to log for ${line.workDate}).`);
    }

    const alloc = allocations.find((a) =>
      a.project.tasks.some((t) => t.id === line.taskId)
    );
    if (!alloc) {
      throw new Error(`No active project allocation found for the task.`);
    }

    const startISO = toISODate(alloc.startDate);
    const endISO = alloc.endDate ? toISODate(alloc.endDate) : null;
    if (line.workDate < startISO || (endISO && line.workDate > endISO)) {
      throw new Error(`You cannot log hours for this task outside your project allocation period (${startISO} to ${endISO || "open-ended"}).`);
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
    // Fetch comments criteria for the tasks being submitted
    const taskIdsForValidation = lines.map((l) => l.taskId);
    const tasksWithCriteria = await prisma.task.findMany({
      where: { id: { in: taskIdsForValidation } },
      include: {
        project: {
          select: { commentsCriteria: true },
        },
      },
    });

    const criteriaMap = new Map(
      tasksWithCriteria.map((t) => [t.id, t.project.commentsCriteria])
    );

    // Validate notes against the criteria
    for (const line of lines) {
      const criteria = criteriaMap.get(line.taskId) ?? "COMPULSORY";

      // Under the combined option (less/greater than 8 hours), if hours is exactly 8, comments are not allowed/required.
      if ((criteria === "LESS_THAN_8_HOURS" || criteria === "MORE_THAN_8_HOURS") && line.hours === 8) {
        line.notes = "";
      }

      let requiresComment = false;
      if (criteria === "COMPULSORY") {
        requiresComment = true;
      } else if (criteria === "LESS_THAN_8_HOURS" || criteria === "MORE_THAN_8_HOURS") {
        requiresComment = line.hours !== 8;
      }

      if (requiresComment && !line.notes) {
        throw new Error(`A comment/notes description is required for the day you logged ${line.hours} hours based on the project's criteria.`);
      }
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



