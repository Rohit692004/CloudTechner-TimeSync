// One-time setup script for a fresh production database with no seed data.
// Creates a single HR_ADMIN account so someone can log in and onboard every
// other employee (including other admins) through the app's own UI.
// Unlike seed.ts, this never deletes existing data -- it refuses to run if
// the target id/email is already taken.
//
// Usage:
//   ADMIN_ID=CT001 ADMIN_NAME="Jane Doe" ADMIN_EMAIL=jane@company.com ADMIN_PASSWORD='Str0ngPass' npx tsx prisma/bootstrap-admin.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!id || !name || !email || !password) {
    throw new Error(
      "Missing required env vars. Set ADMIN_ID, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD."
    );
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
      role: "HR_ADMIN",
      passwordHash,
      isActive: true,
    },
  });

  console.log(`Created HR_ADMIN account: ${admin.name} <${admin.email}> (id: ${admin.id})`);
  console.log("Log in with this account, then use HR > Employees to onboard everyone else.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
