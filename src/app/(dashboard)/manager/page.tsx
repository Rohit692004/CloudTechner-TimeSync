import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { toISODate, weekDates } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReviewButton } from "./review-button";
import type { ReviewLine } from "./review-dialog";
import { ApprovalFilters } from "./approval-filters";
import { SortHeader } from "./sort-header";

export default async function ManagerDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const user = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");
  const { sort, startDate, endDate } = await searchParams;

  const whereClause: any = {
    approvedById: user.id,
    status: "SUBMITTED",
    employee: { isActive: true },
    OR: [
      { isLate: false },
      { isLate: true, lateApproved: true }
    ]
  };

  if (startDate || endDate) {
    whereClause.weekStartDate = {};
    if (startDate) {
      whereClause.weekStartDate.gte = new Date(`${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      whereClause.weekStartDate.lte = new Date(`${endDate}T00:00:00.000Z`);
    }
  }

  let orderByClause: any = { submittedAt: "desc" }; // default to latest submitted
  if (sort === "asc") {
    orderByClause = { submittedAt: "asc" };
  } else if (sort === "week_desc") {
    orderByClause = { weekStartDate: "desc" };
  } else if (sort === "week_asc") {
    orderByClause = { weekStartDate: "asc" };
  }

  const [pending, recentDecisions] = await Promise.all([
    prisma.timesheetHeader.findMany({
      where: whereClause,
      include: {
        employee: true,
        lines: {
          include: {
            task: { include: { project: { include: { client: true } } } },
          },
        },
        approvalHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: orderByClause,
    }),
    prisma.timesheetHeader.findMany({
      where: { approvedById: user.id, status: { in: ["APPROVED", "REJECTED"] } },
      include: { employee: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    })
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Team Approvals</h1>
        <p className="text-muted-foreground">Welcome, {user.name}.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3">
          <CardTitle className="text-base font-bold text-gray-800">Pending review ({pending.length})</CardTitle>
          <ApprovalFilters />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold text-gray-500">Employee</TableHead>
                <TableHead className="font-semibold text-gray-500"><SortHeader /></TableHead>
                <TableHead className="font-semibold text-gray-500">Total Hours</TableHead>
                <TableHead className="text-right font-semibold text-gray-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((t) => {
                const dates = weekDates(t.weekStartDate).map(toISODate);
                const byTask = new Map<string, ReviewLine>();
                for (const line of t.lines) {
                  const key = line.taskId;
                  if (!byTask.has(key)) {
                    byTask.set(key, {
                      taskId: line.taskId,
                      taskName: line.task.name,
                      projectName: line.task.project.name,
                      clientName: line.task.project.client.name,
                      hoursByDate: {},
                      notesByDate: {},
                    });
                  }
                  byTask.get(key)!.hoursByDate[toISODate(line.workDate)] = Number(line.hours);
                  byTask.get(key)!.notesByDate[toISODate(line.workDate)] = line.notes ?? "";
                }
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.employee.name}</TableCell>
                    <TableCell>{toISODate(t.weekStartDate)}</TableCell>
                    <TableCell>{t.totalHours?.toString() ?? "0"}</TableCell>
                    <TableCell className="text-right">
                      <ReviewButton
                        timesheetHeaderId={t.id}
                        employeeName={t.employee.name}
                        dates={dates}
                        lines={Array.from(byTask.values()).sort(
                          (a, b) =>
                            a.clientName.localeCompare(b.clientName) ||
                            a.projectName.localeCompare(b.projectName) ||
                            a.taskName.localeCompare(b.taskName)
                        )}
                        submitComments={t.approvalHistory[0]?.comments ?? ""}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nothing pending review.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent decisions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDecisions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.employee.name}</TableCell>
                  <TableCell>{toISODate(t.weekStartDate)}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "APPROVED" ? "default" : "destructive"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {recentDecisions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No decisions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
