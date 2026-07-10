// One-time setup script for a fresh production database with no seed data,
// or for adding a further admin account without going through the UI's
// onboarding form (which requires picking a Reporting Manager -- fine for
// regular employees, awkward for a top-level admin).
// Unlike seed.ts, this never deletes existing data -- it refuses to run if
// the target id/email is already taken.
//
// Usage:
//   ADMIN_ID=CT001 ADMIN_NAME="Jane Doe" ADMIN_EMAIL=jane@company.com ADMIN_PASSWORD='Str0ngPass' npx tsx prisma/bootstrap-admin.ts
//   ADMIN_ROLE defaults to HR_ADMIN; set to TS_ADMIN/PROJECT_MANAGER/EMPLOYEE to override.

import { PrismaClient, EmployeeRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const VALID_ROLES: EmployeeRole[] = ["EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN"];

const MIN_PASSWORD_LENGTH = 8;

function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("ADMIN_PASSWORD must contain at least one letter and one number.");
  }
}

async function main() {
  const id = process.env.ADMIN_ID;
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const role = (process.env.ADMIN_ROLE ?? "HR_ADMIN") as EmployeeRole;

  if (!id || !name || !email || !password) {
    throw new Error(
      "Missing required env vars. Set ADMIN_ID, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD."
    );
  }
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`ADMIN_ROLE must be one of: ${VALID_ROLES.join(", ")}`);
  }
  validatePassword(password);

  const existing = await prisma.employee.findFirst({
    where: { OR: [{ id }, { email }] },
  });
  if (existing) {
    throw new Error(
      `An employee with id "${id}" or email "${email}" already exists. Refusing to overwrite.`
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.employee.create({
    data: {
      id,
      name,
      email,
      role,
      passwordHash,
      isActive: true,
    },
  });

  console.log(`Created ${admin.role} account: ${admin.name} <${admin.email}> (id: ${admin.id})`);
  console.log("Log in with this account, then use HR > Employees to onboard everyone else.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
