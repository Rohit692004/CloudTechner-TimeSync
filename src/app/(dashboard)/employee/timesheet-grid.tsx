"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { saveDraft, submitTimesheet } from "./actions";

type Task = { id: string; name: string; projectName: string };

export function TimesheetGrid({
  weekStartISO,
  dates,
  tasks,
  initialHours,
  initialNotes,
  editable,
  leaveDates = {},
  holidayDates = {},
}: {
  weekStartISO: string;
  dates: string[];
  tasks: Task[];
  initialHours: Record<string, number>;
  initialNotes: Record<string, string>;
  editable: boolean;
  leaveDates?: Record<string, string>;
  holidayDates?: Record<string, string>;
}) {
  const router = useRouter();
  const [hours, setHours] = useState<Record<string, number>>(initialHours);
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [workedHolidays, setWorkedHolidays] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const key of Object.keys(initialHours)) {
      if (initialHours[key] > 0) {
        const [, date] = key.split("__");
        if (holidayDates[date]) {
          initial[date] = true;
        }
      }
    }
    return initial;
  });
  const [workedWeekends, setWorkedWeekends] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const key of Object.keys(initialHours)) {
      if (initialHours[key] > 0) {
        const [, date] = key.split("__");
        const dObj = new Date(`${date}T00:00:00.000Z`);
        const dayIndex = dObj.getUTCDay();
        if (dayIndex === 0 || dayIndex === 6) {
          initial[date] = true;
        }
      }
    }
    return initial;
  });

  const [commentingCell, setCommentingCell] = useState<{
    taskId: string;
    taskName: string;
    projectName: string;
    date: string;
  } | null>(null);

  const isOverdue = useMemo(() => {
    try {
      const parts = weekStartISO.split("-");
      const weekStart = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      
      // Calculate current week Monday
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const currentMonday = new Date(today.getFullYear(), today.getMonth(), diff);
      currentMonday.setHours(0, 0, 0, 0);

      const diffTime = currentMonday.getTime() - weekStart.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays > 14;
    } catch {
      return false;
    }
  }, [weekStartISO]);

  const dailyTotals = useMemo(() => {
    return dates.map((date) =>
      tasks.reduce((sum, task) => sum + (hours[`${task.id}__${date}`] ?? 0), 0)
    );
  }, [dates, tasks, hours]);

  const weeklyTotal = dailyTotals.reduce((a, b) => a + b, 0);

  function buildFormData() {
    const fd = new FormData();
    for (const [key, value] of Object.entries(hours)) {
      if (value > 0) {
        fd.set(`hours__${key}`, String(value));
        const note = notes[key] ?? "";
        if (note.trim()) {
          fd.set(`notes__${key}`, note.trim());
        }
      }
    }
    return fd;
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveDraft(weekStartISO, buildFormData());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save draft");
      }
    });
  }

  function handleSubmit() {
    setError(null);
    
    // Check if any cell with hours > 0 has empty notes/comments
    const missingNotes: string[] = [];
    for (const [key, val] of Object.entries(hours)) {
      if (val > 0) {
        const note = notes[key] ?? "";
        if (!note.trim()) {
          const [, date] = key.split("__");
          missingNotes.push(date);
        }
      }
    }

    if (missingNotes.length > 0) {
      setError("Please add a comment description for all days you log hours. Missing comments for dates: " + [...new Set(missingNotes)].join(", "));
      return;
    }

    startTransition(async () => {
      try {
        await submitTimesheet(weekStartISO, buildFormData());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {isOverdue && editable && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 font-semibold flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-bold">
            <span>⚠️ Overdue Timesheet</span>
          </div>
          <p className="font-normal text-red-700">
            This timesheet is more than 2 weeks overdue. Normal submission is locked. You can save your draft, or click "Request Late Submission" to submit it to the HR Admin for approval.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-48">Project / Task</TableHead>
              {dates.map((date, i) => (
                <TableHead key={date} className="text-center">
                  {WEEKDAY_LABELS[i]}
                  <div className="text-xs font-normal text-muted-foreground">
                    {date.slice(5)}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const rowTotal = dates.reduce(
                (s, date) => s + (hours[`${task.id}__${date}`] ?? 0),
                0
              );
              return (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="font-medium">{task.name}</div>
                    <div className="text-xs text-muted-foreground">{task.projectName}</div>
                  </TableCell>
                  {dates.map((date) => {
                    const key = `${task.id}__${date}`;
                    const val = hours[key] ?? 0;
                    const noteText = notes[key] ?? "";
                    const hasNote = noteText.trim().length > 0;

                    const leaveType = leaveDates[date];
                    const originalHolidayName = holidayDates[date];
                    
                    const dObj = new Date(`${date}T00:00:00.000Z`);
                    const dayIndex = dObj.getUTCDay();
                    const isWeekendDay = dayIndex === 0 || dayIndex === 6;
                    
                    const isHoliday = !!originalHolidayName && !workedHolidays[date];
                    const holidayName = isHoliday ? originalHolidayName : null;
                    
                    const isWeeklyOff = isWeekendDay && !originalHolidayName && !workedWeekends[date];
                    
                    const todayStr = new Date().toLocaleDateString('sv-SE');
                    const isFutureDay = date > todayStr;
                    
                    const isDisabled = !editable || !!leaveType || !!holidayName || isWeeklyOff || isFutureDay;

                    return (
                      <TableCell 
                        key={date} 
                        className={`p-1 text-center border-r border-gray-100 last:border-0 relative ${
                          leaveType 
                            ? "bg-emerald-50/50" 
                            : holidayName 
                            ? "bg-amber-50/50" 
                            : isWeeklyOff
                            ? "bg-slate-100/50"
                            : ""
                        }`}
                      >
                        <div className="flex flex-col gap-1 items-center min-h-[50px] justify-center">
                          {leaveType ? (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded shadow-sm select-none">
                              🌴 {leaveType} Leave
                            </span>
                          ) : holidayName ? (
                            <div className="flex flex-col gap-1 items-center">
                              <span 
                                className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded shadow-sm select-none max-w-[70px] truncate"
                                title={holidayName}
                              >
                                🎉 {holidayName}
                              </span>
                              {editable && !isFutureDay && (
                                <button
                                  type="button"
                                  onClick={() => setWorkedHolidays((prev) => ({ ...prev, [date]: true }))}
                                  className="text-[9px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 px-1 py-0.5 rounded transition-all font-semibold"
                                >
                                  I worked
                                </button>
                              )}
                            </div>
                          ) : isWeeklyOff ? (
                            <div className="flex flex-col gap-1 items-center">
                              <span className="text-[10px] font-bold text-slate-700 bg-slate-200/80 px-1.5 py-0.5 rounded shadow-sm select-none">
                                💤 Weekly Off
                              </span>
                              {editable && !isFutureDay && (
                                <button
                                  type="button"
                                  onClick={() => setWorkedWeekends((prev) => ({ ...prev, [date]: true }))}
                                  className="text-[9px] text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 px-1 py-0.5 rounded transition-all font-semibold"
                                >
                                  I worked
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              <Input
                                type="number"
                                min={0}
                                max={24}
                                step={0.5}
                                disabled={isDisabled}
                                value={hours[key] ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value === "" ? 0 : Number(e.target.value);
                                  setHours((prev) => ({
                                    ...prev,
                                    [key]: v,
                                  }));
                                }}
                                className="w-16 text-center mx-auto bg-white"
                              />
                              {val > 0 && (hasNote || editable) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentingCell({
                                      taskId: task.id,
                                      taskName: task.name,
                                      projectName: task.projectName,
                                      date,
                                    })
                                  }
                                  className={`flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] gap-1 font-medium transition-all ${
                                    hasNote
                                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"
                                      : "text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 animate-pulse"
                                  }`}
                                >
                                  <span>{hasNote ? "📝 Note" : "➕ Comment"}</span>
                                </button>
                              )}
                              {originalHolidayName && editable && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHours((prev) => {
                                      const next = { ...prev };
                                      for (const t of tasks) {
                                        delete next[`${t.id}__${date}`];
                                      }
                                      return next;
                                    });
                                    setWorkedHolidays((prev) => ({ ...prev, [date]: false }));
                                  }}
                                  className="text-[9px] text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-1 py-0.5 rounded transition-all"
                                >
                                  Mark Holiday
                                </button>
                              )}
                              {isWeekendDay && !originalHolidayName && editable && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHours((prev) => {
                                      const next = { ...prev };
                                      for (const t of tasks) {
                                        delete next[`${t.id}__${date}`];
                                      }
                                      return next;
                                    });
                                    setWorkedWeekends((prev) => ({ ...prev, [date]: false }));
                                  }}
                                  className="text-[9px] text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-1 py-0.5 rounded transition-all"
                                >
                                  Mark Weekly Off
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-medium">{rowTotal}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/40 font-medium">
              <TableCell>Total Daily Hours</TableCell>
              {dailyTotals.map((total, i) => (
                <TableCell
                  key={dates[i]}
                  className={`text-center ${
                    i < 5 && total < 8 ? "text-destructive" : ""
                  }`}
                >
                  {total}
                </TableCell>
              ))}
              <TableCell className="text-center">{weeklyTotal}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {tasks.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active project allocations for this week — contact Timesheet Admin.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {editable && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save Draft"}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} variant={isOverdue ? "destructive" : "default"}>
            {isPending ? "Submitting…" : isOverdue ? "Request Late Submission" : "Submit Weekly Timesheet"}
          </Button>
        </div>
      )}

      {/* Cell Comment Dialog */}
      <Dialog open={commentingCell !== null} onOpenChange={(open) => !open && setCommentingCell(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 font-bold">Add Comment / Notes</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="text-xs text-muted-foreground flex flex-col gap-0.5 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              <div>
                <span className="font-semibold text-gray-700">Project:</span> {commentingCell?.projectName}
              </div>
              <div>
                <span className="font-semibold text-gray-700">Task:</span> {commentingCell?.taskName}
              </div>
              <div className="mt-1 font-semibold text-emerald-800">
                Date: {commentingCell?.date}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cell-note" className="text-xs font-semibold text-gray-600">Daily Work Description (Mandatory)</Label>
              <Textarea
                id="cell-note"
                rows={4}
                disabled={!editable}
                placeholder="Describe what you worked on today (e.g. Implemented auth middleware, fixed CSS layout bugs)..."
                value={commentingCell ? (notes[`${commentingCell.taskId}__${commentingCell.date}`] ?? "") : ""}
                onChange={(e) => {
                  if (commentingCell) {
                    const key = `${commentingCell.taskId}__${commentingCell.date}`;
                    setNotes((prev) => ({ ...prev, [key]: e.target.value }));
                  }
                }}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCommentingCell(null)}>Save & Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
