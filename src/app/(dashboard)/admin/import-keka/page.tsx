import { requireRole } from "@/lib/auth-guards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ImportKekaPage() {
  await requireRole("TS_ADMIN", "HR_ADMIN");

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Keka HR Integration</h1>
        <p className="text-base text-gray-500">
          Synchronize employee profiles, active allocations, and leaves directly from the Keka HR platform.
        </p>
      </div>

      <Card className="border border-gray-200/60 shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b border-gray-100 bg-gray-50/50 px-6 py-5">
          <CardTitle className="text-lg font-bold text-gray-800">Integration Configuration</CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex flex-col gap-6">
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200/60 rounded-xl p-4">
            <span className="text-2xl select-none">⏳</span>
            <div className="flex flex-col gap-0.5">
              <h3 className="font-bold text-amber-900 text-sm">Integration Status: Deferred to Phase 4</h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                Automated synchronization of employee rosters, project assignments, and daily attendance logs has been scheduled for Phase 4 of the roadmap. The target database schemas are ready to receive data payloads.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/20">
              <h4 className="font-bold text-gray-700 text-sm mb-1">Active Endpoints</h4>
              <ul className="text-xs text-gray-500 space-y-1.5 mt-2 list-disc list-inside">
                <li>`/api/v1/keka/employees` (Roster)</li>
                <li>`/api/v1/keka/allocations` (Assignments)</li>
                <li>`/api/v1/keka/attendance` (Timesheet reference)</li>
              </ul>
            </div>
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/20">
              <h4 className="font-bold text-gray-700 text-sm mb-1">Target Action Policies</h4>
              <ul className="text-xs text-gray-500 space-y-1.5 mt-2 list-disc list-inside">
                <li>Auto-sync on Monday 04:00 AM</li>
                <li>Conflict resolution: Local overrides prioritize</li>
                <li>Manager reporting hierarchy updates</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <Button disabled className="bg-emerald-700 text-white font-semibold">
              Trigger Manual Sync (Phase 4)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
