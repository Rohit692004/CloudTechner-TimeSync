-- CreateEnum
CREATE TYPE "AllocationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommentsCriteria" AS ENUM ('NOT_REQUIRED', 'COMPULSORY', 'LESS_THAN_8_HOURS', 'MORE_THAN_8_HOURS');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "commentsCriteria" "CommentsCriteria" NOT NULL DEFAULT 'COMPULSORY';

-- CreateTable
CREATE TABLE "AllocationRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT,
    "allocationPercentage" INTEGER NOT NULL DEFAULT 100,
    "message" TEXT,
    "status" "AllocationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllocationRequest_employeeId_idx" ON "AllocationRequest"("employeeId");

-- CreateIndex
CREATE INDEX "AllocationRequest_projectId_idx" ON "AllocationRequest"("projectId");

-- CreateIndex
CREATE INDEX "Notification_employeeId_idx" ON "Notification"("employeeId");

-- AddForeignKey
ALTER TABLE "AllocationRequest" ADD CONSTRAINT "AllocationRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationRequest" ADD CONSTRAINT "AllocationRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
