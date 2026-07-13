"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_STATUSES, BILLING_MODELS } from "@/lib/constants";
import { updateProject } from "../actions";

type ProjectInput = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  projectManagerId: string | null;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  costBudget: number | null;
  hoursBudget: number | null;
  billingModel: string;
  linkExpenses: boolean;
  commentsCriteria: string;
};

export function EditProjectDialog({
  project,
  employees,
}: {
  project: ProjectInput;
  employees: { id: string; name: string }[];
}) {
  const COMMENTS_CRITERIA = [
    { value: "NOT_REQUIRED", label: "No comments required" },
    { value: "COMPULSORY", label: "Compulsory for all hours" },
    { value: "LESS_THAN_8_HOURS", label: "Required if less than or greater than 8 hours logged" },
  ];

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState(project.status);
  const [managerId, setManagerId] = useState(project.projectManagerId ?? "none");
  const [billingModel, setBillingModel] = useState(project.billingModel);
  const [commentsCriteria, setCommentsCriteria] = useState(project.commentsCriteria);

  const defaultStartStr = project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "";
  const defaultEndStr = project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : "";

  function reset() {
    setStatus(project.status);
    setManagerId(project.projectManagerId ?? "none");
    setBillingModel(project.billingModel);
    setCommentsCriteria(project.commentsCriteria);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("status", status);
    formData.set("projectManagerId", managerId === "none" ? "" : managerId);
    formData.set("billingModel", billingModel);
    formData.set("commentsCriteria", commentsCriteria);
    
    startTransition(async () => {
      try {
        await updateProject(project.id, formData);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update project");
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        variant="outline"
        size="sm"
        className="bg-[#0B3B45] hover:bg-[#123B2A] text-white border-none"
      >
        Edit Project
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) reset();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Project: {project.name}</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="flex flex-col gap-4 mt-2">
            <p className="text-sm font-medium">Basic details</p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input id="name" name="name" defaultValue={project.name} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Project Code</Label>
                <Input id="code" value={project.code ?? "—"} readOnly className="bg-gray-50 text-gray-500 font-mono" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Project Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? "IN_PROGRESS")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value) => PROJECT_STATUSES.find((s) => s.value === value)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Project Manager</Label>
              <Select value={managerId} onValueChange={(v) => setManagerId(v ?? "none")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Search employee">
                    {(value) => {
                      const e = employees.find((emp) => emp.id === value);
                      return e ? `${e.name} (${e.id})` : "None";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {`${e.name} (${e.id})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Project Description (optional)</Label>
              <Textarea id="description" name="description" defaultValue={project.description ?? ""} placeholder="Optional" />
            </div>

            <Separator />
            <p className="text-sm font-medium">Duration &amp; Budget</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="startDate">Project Start Date</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={defaultStartStr} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="endDate">Project End Date (optional)</Label>
                <Input id="endDate" name="endDate" type="date" defaultValue={defaultEndStr} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="costBudget">Cost Budget (optional)</Label>
                <Input
                  id="costBudget"
                  name="costBudget"
                  type="number"
                  step="0.01"
                  defaultValue={project.costBudget ?? ""}
                  placeholder="Enter amount"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="hoursBudget">Hours Budget (optional)</Label>
                <Input
                  id="hoursBudget"
                  name="hoursBudget"
                  type="number"
                  step="0.5"
                  defaultValue={project.hoursBudget ?? ""}
                  placeholder="Enter hours"
                />
              </div>
            </div>

            <Separator />
            <p className="text-sm font-medium">Billing &amp; Expenses</p>

            <div className="flex flex-col gap-2">
              <Label>Billing Model</Label>
              <Select value={billingModel} onValueChange={(v) => setBillingModel(v ?? "TIME_AND_MATERIAL")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => BILLING_MODELS.find((b) => b.value === value)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BILLING_MODELS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Comments Criteria *</Label>
              <Select value={commentsCriteria} onValueChange={(v) => setCommentsCriteria(v ?? "COMPULSORY")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => COMMENTS_CRITERIA.find((c) => c.value === value)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COMMENTS_CRITERIA.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="linkExpenses" name="linkExpenses" defaultChecked={project.linkExpenses} />
              <Label htmlFor="linkExpenses" className="font-normal">
                Enable linking expenses to this project
              </Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                {isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
