-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalDataRows" INTEGER NOT NULL,
    "usableRows" INTEGER NOT NULL,
    "weeksNew" INTEGER NOT NULL,
    "weeksAlreadyImported" INTEGER NOT NULL,
    "newTasks" INTEGER NOT NULL,
    "newAllocations" INTEGER NOT NULL,
    "linesNew" INTEGER NOT NULL,
    "headersCreated" INTEGER NOT NULL,
    "linesCreated" INTEGER NOT NULL,
    "unknownEmployeesCount" INTEGER NOT NULL,
    "unknownProjectsCount" INTEGER NOT NULL,
    "clientMismatchesCount" INTEGER NOT NULL,
    "unresolvedManagersCount" INTEGER NOT NULL,
    "timeOffRowsSkipped" INTEGER NOT NULL,
    "mixedStatusWeeksCount" INTEGER NOT NULL,
    "reportDetailsJson" TEXT NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

