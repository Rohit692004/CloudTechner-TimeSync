"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { approveTimesheet, rejectTimesheet } from "./actions";

export type ReviewLine = {
  taskName: string;
  hoursByDate: Record<string, number>;
  notesByDate: Record<string, string>;
};

export function ReviewDialog({
  timesheetHeaderId,
  employeeName,
  dates,
  lines,
  submitComments,
  open,
  onOpenChange,
}: {
  timesheetHeaderId: string;
  employeeName: string;
  dates: string[];
  lines: ReviewLine[];
  submitComments: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectComments, setRejectComments] = useState("");

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveTimesheet(timesheetHeaderId);
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to approve");
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      try {
        await rejectTimesheet(timesheetHeaderId, rejectComments);
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to reject");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review: {employeeName}</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                {dates.map((date, i) => (
                  <TableHead key={date} className="text-center">
                    {WEEKDAY_LABELS[i]}
                  </TableHead>
                ))}
                <TableHead className="text-center">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const total = dates.reduce((s, d) => s + (line.hoursByDate[d] ?? 0), 0);
                return (
                  <TableRow key={line.taskName}>
                    <TableCell className="font-medium">{line.taskName}</TableCell>
                    {dates.map((date) => (
                      <TableCell key={date} className="text-center">
                        {line.hoursByDate[date] ?? 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-medium">{total}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Render daily notes */}
        <div className="flex flex-col gap-1.5 border-t pt-3">
          <h3 className="font-semibold text-sm text-gray-700">Daily Comments</h3>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-2 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
            {lines.map((line) => {
              const entries = Object.entries(line.notesByDate).filter(([, note]) => !!note);
              if (entries.length === 0) return null;
              return (
                <div key={line.taskName} className="text-xs">
                  <div className="font-semibold text-gray-600">{line.taskName}:</div>
                  <ul className="list-disc pl-4 mt-0.5 text-gray-500 space-y-0.5">
                    {entries.map(([date, note]) => (
                      <li key={date}>
                        <span className="font-medium text-emerald-800">{date}:</span> {note}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {lines.every((line) => Object.values(line.notesByDate).filter(Boolean).length === 0) && (
              <span className="text-xs text-muted-foreground italic">No daily comments entered.</span>
            )}
          </div>
        </div>

        {submitComments && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Employee note: </span>
            {submitComments}
          </p>
        )}

        {showRejectForm && (
          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Explain what needs to change…"
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          {!showRejectForm ? (
            <>
              <Button variant="outline" onClick={() => setShowRejectForm(true)} disabled={isPending}>
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={isPending}>
                {isPending ? "Approving…" : "Approve"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowRejectForm(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isPending || !rejectComments.trim()}
              >
                {isPending ? "Rejecting…" : "Confirm Reject"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
