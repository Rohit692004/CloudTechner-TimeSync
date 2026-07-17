"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReviewDialog, type ReviewLine } from "./review-dialog";

export function ReviewButton({
  approvalId,
  employeeName,
  projectName,
  dates,
  lines,
  submitComments,
}: {
  approvalId: string;
  employeeName: string;
  projectName: string;
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
        approvalId={approvalId}
        employeeName={employeeName}
        projectName={projectName}
        dates={dates}
        lines={lines}
        submitComments={submitComments}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
