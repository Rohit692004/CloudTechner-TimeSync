import { prisma } from "@/lib/prisma";

/** Next client code like C001, C026 — based on the highest existing C-number. */
export async function nextClientCode(): Promise<string> {
  const clients = await prisma.client.findMany({
    where: { code: { startsWith: "C" } },
    select: { code: true },
  });
  return `C${String(maxNumber(clients.map((c) => c.code)) + 1).padStart(3, "0")}`;
}

/** Next project code like P0001, P0061 — based on the highest existing P-number. */
export async function nextProjectCode(): Promise<string> {
  const projects = await prisma.project.findMany({
    where: { code: { startsWith: "P" } },
    select: { code: true },
  });
  return `P${String(maxNumber(projects.map((p) => p.code)) + 1).padStart(4, "0")}`;
}

/** Next employee code like CT010, CT011 — based on the highest existing CT-number. */
export async function nextEmployeeCode(): Promise<string> {
  const employees = await prisma.employee.findMany({
    where: { id: { startsWith: "CT" } },
    select: { id: true },
  });
  return `CT${String(maxNumber(employees.map((e) => e.id)) + 1).padStart(3, "0")}`;
}

function maxNumber(codes: (string | null)[]): number {
  let max = 0;
  for (const code of codes) {
    if (!code) continue;
    const n = parseInt(code.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}
