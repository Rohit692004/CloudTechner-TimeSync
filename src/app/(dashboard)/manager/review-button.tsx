"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReviewDialog, type ReviewLine } from "./review-dialog";

export function ReviewButton({
  timesheetHeaderId,
  employeeName,
  dates,
  lines,
  submitComments,
}: {
  timesheetHeaderId: string;
  employeeName: string;
  dates: string[];
  lines: ReviewLine[];
  submitComments: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Review
      </Button>
      <ReviewDialog
        timesheetHeaderId={timesheetHeaderId}
        employeeName={employeeName}
        dates={dates}
        lines={lines}
        submitComments={submitComments}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
