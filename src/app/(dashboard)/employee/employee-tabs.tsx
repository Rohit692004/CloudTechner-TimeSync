"use client";

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
import { TimesheetGrid } from "./timesheet-grid";
import { Calendar, Clock, Award, LineChart } from "lucide-react";
import Link from "next/link";

type Holiday = {
  id: string;
  name: string;
  date: string;
  isFloaterLeave: boolean;
  specialHoliday: boolean;
};

export function EmployeeTabs({
  // Timesheet View Props
  weekStartISO,
  dates,
  tasks,
  initialHours,
  initialNotes,
  editable,
  loggedThisWeek,
  pendingApprovalCount,
  approvedMTD,
  utilization,
  allocDetails,
  totalAllocatedPercentage,
  unallocatedPercentage,
  unallocatedHours,
  recentTimesheets,
  headerBadge,
  withdrawForm,
  weekDatePicker,
  prevWeekBtn,
  nextWeekBtn,
  feedbackAlert,
  holidaysList,
  holidayDates,
  approverName,
}: {
  weekStartISO: string;
  dates: string[];
  tasks: any[];
  initialHours: Record<string, number>;
  initialNotes: Record<string, string>;
  editable: boolean;
  loggedThisWeek: number;
  pendingApprovalCount: number;
  approvedMTD: number;
  utilization: number;
  allocDetails: any[];
  totalAllocatedPercentage: number;
  unallocatedPercentage: number;
  unallocatedHours: number;
  recentTimesheets: any[];
  headerBadge: React.ReactNode;
  withdrawForm: React.ReactNode;
  weekDatePicker: React.ReactNode;
  prevWeekBtn: React.ReactNode;
  nextWeekBtn: React.ReactNode;
  feedbackAlert: React.ReactNode;
  holidaysList: Holiday[];
  holidayDates: Record<string, string>;
  approverName: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header action bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-150 pb-4 gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Timesheet Approver</span>
          <span className="text-sm font-bold text-gray-800">{approverName}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerBadge}
          {withdrawForm}
          {weekDatePicker}
          <div className="flex gap-1.5 ml-1">
            {prevWeekBtn}
            {nextWeekBtn}
          </div>
        </div>
      </div>

      {feedbackAlert}

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-gray-100 shadow-sm bg-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Logged this week</div>
                <div className="text-2xl font-extrabold mt-1 text-emerald-800">{loggedThisWeek} h</div>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-[11px] text-gray-500 mt-2">Target: 40 h capacity</div>
          </CardContent>
        </Card>
        <Card className="border-gray-100 shadow-sm bg-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Awaiting approval</div>
                <div className="text-2xl font-extrabold mt-1 text-amber-700">{pendingApprovalCount}</div>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg text-amber-700">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <div className="text-[11px] text-gray-500 mt-2">Submitted timesheets</div>
          </CardContent>
        </Card>
        <Card className="border-gray-100 shadow-sm bg-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved (MTD)</div>
                <div className="text-2xl font-extrabold mt-1 text-emerald-800">{approvedMTD} h</div>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <div className="text-[11px] text-gray-500 mt-2">Current month total</div>
          </CardContent>
        </Card>
        <Card className="border-gray-100 shadow-sm bg-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg. Utilization</div>
                <div className={`text-2xl font-extrabold mt-1 ${utilization >= 80 ? 'text-emerald-800' : 'text-amber-700'}`}>
                  {utilization}%
                </div>
              </div>
              <div className="p-2 bg-sky-50 rounded-lg text-sky-700">
                <LineChart className="h-4 w-4" />
              </div>
            </div>
            <div className="text-[11px] text-gray-500 mt-2">Target: 80% billable</div>
          </CardContent>
        </Card>
      </div>

      {/* Allocation Progress Bar */}
      <Card className="border-gray-100 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-gray-800">
            Allocation this week
            <span className="font-normal text-xs text-gray-400 block mt-0.5">Percentage of 40 h capacity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalAllocatedPercentage > 100 && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-850 font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>
                Attention: You are overallocated this week at {totalAllocatedPercentage}% ({Math.round((totalAllocatedPercentage / 100) * 40)} h total allocation). Please contact your project managers.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 text-xs font-semibold text-gray-600">
            {allocDetails.map((a, idx) => {
              const bgColors = ["bg-emerald-600", "bg-teal-600", "bg-sky-600", "bg-cyan-600"];
              const bg = bgColors[idx % bgColors.length];
              return (
                <div key={a.projectName} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${bg}`} />
                  <span>{a.projectName} · {a.hours} h ({a.percentage}%)</span>
                </div>
              );
            })}
            {unallocatedPercentage > 0 && (
              <div className="flex items-center gap-1.5 text-gray-400">
                <span className="w-3 h-3 rounded-sm bg-gray-200" />
                <span>Unallocated · {unallocatedHours} h</span>
              </div>
            )}
          </div>

          <div className="flex h-7 w-full overflow-hidden rounded-lg bg-gray-100 text-[10px] font-bold text-white shadow-inner select-none">
            {allocDetails.map((a, idx) => {
              const bgColors = ["bg-emerald-600", "bg-teal-600", "bg-sky-600", "bg-cyan-600"];
              const bg = bgColors[idx % bgColors.length];
              if (a.percentage <= 0) return null;

              const scale = totalAllocatedPercentage > 100 ? (100 / totalAllocatedPercentage) : 1;
              const widthPct = a.percentage * scale;

              return (
                <div
                  key={a.projectName}
                  className={`flex items-center justify-center transition-all ${bg} border-r border-white/10 last:border-0`}
                  style={{ width: `${widthPct}%` }}
                >
                  <span className="truncate px-1">{a.projectName} ({a.percentage}%)</span>
                </div>
              );
            })}
            {unallocatedPercentage > 0 && (
              <div
                className="flex items-center justify-center bg-gray-200 text-gray-450 transition-all"
                style={{ width: `${unallocatedPercentage}%` }}
              >
                <span className="truncate px-1">{unallocatedPercentage}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Timesheet Grid */}
      <Card className="border-gray-100 shadow-sm bg-white">
        <CardContent className="pt-6">
          <TimesheetGrid
            weekStartISO={weekStartISO}
            dates={dates}
            tasks={tasks}
            initialHours={initialHours}
            initialNotes={initialNotes}
            editable={editable}
            holidayDates={holidayDates}
          />
        </CardContent>
      </Card>

      {/* Bottom Section: Recent Timesheets & Holiday Calendar (Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Timesheets Card */}
        <Card className="border border-gray-150 shadow-sm bg-white">
          <CardHeader className="border-b border-gray-50 pb-4">
            <CardTitle className="text-base font-bold text-gray-800">Recent timesheets</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="font-semibold text-gray-700 text-xs">Week</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-xs">Total Hours</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-right text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTimesheets.map((t) => (
                  <TableRow key={t.id} className="hover:bg-gray-50/50">
                    <TableCell>
                      <Link
                        href={`/employee?week=${t.weekStartDate}`}
                        className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline text-xs"
                      >
                        {t.weekStartDate}
                      </Link>
                    </TableCell>
                    <TableCell className="font-bold text-gray-700 text-xs">{t.totalHours} h</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          t.status === "DRAFT"
                            ? "secondary"
                            : t.status === "SUBMITTED"
                            ? "default"
                            : t.status === "APPROVED"
                            ? "default"
                            : "destructive"
                        }
                        className="font-bold px-2 py-0.5 text-[10px]"
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {recentTimesheets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8 text-xs">
                      No timesheets yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Holiday Calendar Card */}
        <Card className="border border-gray-150 shadow-sm bg-white">
          <CardHeader className="border-b border-gray-50 pb-4">
            <CardTitle className="text-base font-bold text-gray-800">🎉 Holiday Calendar (2026)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {holidaysList.map((hol) => {
                const isPassed = new Date(hol.date) < new Date();
                return (
                  <div
                    key={hol.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                      isPassed
                        ? "bg-gray-50/70 border-gray-100 opacity-60"
                        : hol.isFloaterLeave
                        ? "bg-sky-50/50 border-sky-100/60"
                        : "bg-amber-50/40 border-amber-100/60"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-bold ${isPassed ? "text-gray-500" : "text-gray-800"}`}>
                        {hol.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium font-mono">
                        {hol.date}
                      </span>
                    </div>
                    <div>
                      {hol.isFloaterLeave ? (
                        <Badge className="bg-sky-50 text-sky-800 hover:bg-sky-50 border border-sky-200/50 font-bold text-[9px] py-0.5">
                          Floater Leave
                        </Badge>
                      ) : hol.specialHoliday ? (
                        <Badge className="bg-purple-50 text-purple-800 hover:bg-purple-50 border border-purple-200/50 font-bold text-[9px] py-0.5">
                          Special Holiday
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-800 hover:bg-amber-50 border border-amber-200/50 font-bold text-[9px] py-0.5">
                          Public Holiday
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              {holidaysList.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-xs">
                  No holidays defined.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
