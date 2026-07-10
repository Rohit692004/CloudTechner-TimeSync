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
import { CURRENCIES, COUNTRIES } from "@/lib/constants";
import { createClient } from "./actions";

export function CreateClientDialog({
  employees,
  suggestedCode,
}: {
  employees: { id: string; name: string }[];
  suggestedCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [managerId, setManagerId] = useState("");
  const [billingCountry, setBillingCountry] = useState("");
  const [sameAsClient, setSameAsClient] = useState(true);

  function reset() {
    setCountry("");
    setCurrency("");
    setManagerId("");
    setBillingCountry("");
    setSameAsClient(true);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("country", country);
    formData.set("billingCurrency", currency);
    formData.set("clientManagerId", managerId);
    formData.set("billingCountry", billingCountry);
    startTransition(async () => {
      try {
        await createClient(formData);
        setOpen(false);
        reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create client");
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
      <Button onClick={() => setOpen(true)}>Add Client</Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Client</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Client Name *</Label>
              <Input id="name" name="name" required placeholder="Enter client name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Client Code</Label>
              <Input id="code" name="code" defaultValue={suggestedCode} placeholder="C001" />
              <p className="text-xs text-muted-foreground">Suggested: {suggestedCode}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={(v) => setCountry(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Billing Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Client Manager</Label>
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
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Optional" />
          </div>

          <Separator />
          <p className="text-sm font-medium">Billing Details</p>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="billingSameAsClient"
              name="billingSameAsClient"
              checked={sameAsClient}
              onChange={(e) => setSameAsClient(e.target.checked)}
            />
            <Label htmlFor="billingSameAsClient" className="font-normal">
              Billing name same as client name
            </Label>
          </div>

          {!sameAsClient && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="billingName">Billing Name</Label>
              <Input id="billingName" name="billingName" placeholder="Enter billing name" />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="addressLine1">Address line 1</Label>
            <Input id="addressLine1" name="addressLine1" placeholder="Enter address line 1" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="addressLine2">Address line 2 (optional)</Label>
            <Input id="addressLine2" name="addressLine2" placeholder="Enter address line 2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Country</Label>
              <Select value={billingCountry} onValueChange={(v) => setBillingCountry(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" placeholder="Enter state" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" placeholder="Enter city" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="zip">Zip</Label>
              <Input id="zip" name="zip" placeholder="Enter zip" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
