-- CreateIndex
CREATE UNIQUE INDEX "ProjectAllocation_employeeId_projectId_startDate_key" ON "ProjectAllocation"("employeeId", "projectId", "startDate");
