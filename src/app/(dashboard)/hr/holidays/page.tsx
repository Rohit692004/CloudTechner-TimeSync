import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { toISODate } from "@/lib/dates";
import { HolidaysClient } from "./holidays-client";

export default async function HolidaysPage() {
  await requireRole("TS_ADMIN", "HR_ADMIN");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // 1. Ensure Default plan exists
  let defaultPlan = await prisma.holidayPlan.findFirst({
    where: { isDefault: true },
  });
  if (!defaultPlan) {
    defaultPlan = await prisma.holidayPlan.create({
      data: { name: "Default", isDefault: true },
    });
  }

  // 2. Fetch active clients and ensure a HolidayPlan exists for each client
  const clients = await prisma.client.findMany({
    where: { isActive: true },
  });

  for (const client of clients) {
    const planName = client.name;
    const plan = await prisma.holidayPlan.findUnique({
      where: { name: planName },
    });
    if (!plan) {
      await prisma.holidayPlan.create({
        data: { name: planName },
      });
    }
  }

  // 3. Fetch all holiday plans
  const plans = await prisma.holidayPlan.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      holidays: {
        orderBy: { date: "asc" },
      },
      employees: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // 4. Fetch all active employees with roles and active project allocations
  const employeesRaw = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      holidayPlanId: true,
      allocations: {
        where: {
          startDate: { lte: today },
          OR: [
            { endDate: null },
            { endDate: { gte: today } },
          ],
        },
        select: {
          id: true,
          project: {
            select: {
              name: true,
              client: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Format employees
  const employees = employeesRaw.map(e => ({
    id: e.id,
    name: e.name,
    email: e.email,
    role: e.role,
    holidayPlanId: e.holidayPlanId,
    activeAllocations: e.allocations.map(alloc => ({
      id: alloc.id,
      projectName: alloc.project.name,
      clientName: alloc.project.client.name,
    })),
  }));

  // Format plans to match what client expects
  const plansFormatted = plans.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.isDefault,
    holidays: p.holidays.map((h) => ({
      id: h.id,
      name: h.name,
      date: toISODate(h.date),
      isFloaterLeave: h.isFloaterLeave,
      specialHoliday: h.specialHoliday,
    })),
    employees: p.employees,
  }));

  return (
    <HolidaysClient 
      initialPlans={plansFormatted} 
      allEmployees={employees} 
    />
  );
}
