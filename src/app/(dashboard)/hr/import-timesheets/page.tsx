import { requireRole } from "@/lib/auth-guards";
import { ImportTimesheetsClient } from "./import-timesheets-client";
import { getImportHistory, getEmployeesForExport, getExportYearRange } from "./actions";

export default async function ImportTimesheetsPage() {
  await requireRole("TS_ADMIN", "HR_ADMIN");
  const [history, employees, yearRange] = await Promise.all([
    getImportHistory(),
    getEmployeesForExport(),
    getExportYearRange(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Import / Export Timesheets</h1>
        <p className="text-muted-foreground text-sm">
          Upload a Keka "Employees Timesheet Entries" export, review past imports, or export
          existing timesheet data. Nothing is written to the database until an import is
          explicitly confirmed.
        </p>
      </div>
      <ImportTimesheetsClient initialHistory={history} employees={employees} yearRange={yearRange} />
    </div>
  );
}
