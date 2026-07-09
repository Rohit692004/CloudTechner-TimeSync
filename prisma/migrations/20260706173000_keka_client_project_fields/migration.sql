-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BillingModel" AS ENUM ('TIME_AND_MATERIAL', 'FIXED_FEE', 'RETAINER', 'NON_BILLABLE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "billingCountry" TEXT,
ADD COLUMN     "billingCurrency" TEXT,
ADD COLUMN     "billingName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "clientManagerId" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "zip" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "billingModel" "BillingModel" NOT NULL DEFAULT 'TIME_AND_MATERIAL',
ADD COLUMN     "costBudget" DECIMAL(12,2),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "hoursBudget" DECIMAL(10,2),
ADD COLUMN     "linkExpenses" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectManagerId" TEXT,
ADD COLUMN     "startDate" DATE,
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_clientManagerId_fkey" FOREIGN KEY ("clientManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

