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
import { createProject } from "./actions";

export function CreateProjectDialog({
  clients,
  employees,
  suggestedCode,
}: {
  clients: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  suggestedCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("IN_PROGRESS");
  const [managerId, setManagerId] = useState("");
  const [billingModel, setBillingModel] = useState("TIME_AND_MATERIAL");

  function reset() {
    setClientId("");
    setStatus("IN_PROGRESS");
    setManagerId("");
    setBillingModel("TIME_AND_MATERIAL");
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("clientId", clientId);
    formData.set("status", status);
    formData.set("projectManagerId", managerId);
    formData.set("billingModel", billingModel);
    startTransition(async () => {
      try {
        await createProject(formData);
        setOpen(false);
        reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create project");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <Button onClick={() => setOpen(true)} disabled={clients.length === 0}>
        Create Project
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm font-medium">Basic details</p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Project name *</Label>
            <Input id="name" name="name" required placeholder="Enter project name" />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Client * (cannot be changed later)</Label>
            <Select value={clientId} onValueChange={(v) => setClientId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select client name">
                  {(value) => clients.find((c) => c.id === value)?.name || null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Project code</Label>
              <Input id="code" name="code" defaultValue={suggestedCode} placeholder="P0001" />
              <p className="text-xs text-muted-foreground">Suggested: {suggestedCode}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Project status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "IN_PROGRESS")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
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
            <Label>Project manager</Label>
            <Select value={managerId} onValueChange={(v) => setManagerId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Search employee">
                  {(value) => {
                    const e = employees.find((emp) => emp.id === value);
                    return e ? `${e.name} (${e.id})` : null;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Project description (optional)</Label>
            <Textarea id="description" name="description" placeholder="Optional" />
          </div>

          <Separator />
          <p className="text-sm font-medium">Duration &amp; Budget</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate">Project start date</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endDate">Project end date (optional)</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="costBudget">Cost budget (optional)</Label>
              <Input id="costBudget" name="costBudget" type="number" step="0.01" placeholder="Enter amount" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hoursBudget">Hours budget (optional)</Label>
              <Input id="hoursBudget" name="hoursBudget" type="number" step="0.5" placeholder="Enter hours" />
            </div>
          </div>

          <Separator />
          <p className="text-sm font-medium">Billing &amp; Expenses</p>

          <div className="flex flex-col gap-2">
            <Label>Billing model</Label>
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

          <div className="flex items-center gap-2">
            <input type="checkbox" id="linkExpenses" name="linkExpenses" />
            <Label htmlFor="linkExpenses" className="font-normal">
              Enable linking expenses to this project
            </Label>
          </div>

          <p className="text-xs text-muted-foreground">
            Default tasks (Project work, Project work - WFH, Project work - Client, Training) are created automatically.
            Attachments are not yet supported in this build.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !clientId}>
              {isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
