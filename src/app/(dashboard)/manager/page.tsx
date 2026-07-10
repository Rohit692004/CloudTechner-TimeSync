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

export default async function ManagerDashboard() {
  const user = await requireRole("EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN");

  const [pending, recentDecisions] = await Promise.all([
    prisma.timesheetHeader.findMany({
      where: {
        approvedById: user.id,
        status: "SUBMITTED",
        OR: [
          { isLate: false },
          { isLate: true, lateApproved: true }
        ]
      },
      include: {
        employee: true,
        lines: {
          include: {
            task: { include: { project: { include: { client: true } } } },
          },
        },
        approvalHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { submittedAt: "asc" },
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
        <CardHeader>
          <CardTitle className="text-base">Pending review ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
