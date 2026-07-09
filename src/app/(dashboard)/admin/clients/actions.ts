"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";

function str(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
}

export async function createClient(formData: FormData) {
  await requireRole("TS_ADMIN");

  const name = str(formData, "name");
  if (!name) throw new Error("Client name is required");

  const code = str(formData, "code");
  if (code) {
    const existing = await prisma.client.findUnique({ where: { code } });
    if (existing) throw new Error(`Client code ${code} is already in use`);
  }

  const sameAsClient = formData.get("billingSameAsClient") === "on";

  await prisma.client.create({
    data: {
      name,
      code,
      country: str(formData, "country"),
      billingCurrency: str(formData, "billingCurrency"),
      clientManagerId: str(formData, "clientManagerId"),
      description: str(formData, "description"),
      billingName: sameAsClient ? name : str(formData, "billingName"),
      addressLine1: str(formData, "addressLine1"),
      addressLine2: str(formData, "addressLine2"),
      billingCountry: str(formData, "billingCountry"),
      state: str(formData, "state"),
      city: str(formData, "city"),
      zip: str(formData, "zip"),
    },
  });

  revalidatePath("/admin/clients");
}

export async function toggleClientActive(id: string, isActive: boolean) {
  await requireRole("TS_ADMIN");
  await prisma.client.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/clients");
}
