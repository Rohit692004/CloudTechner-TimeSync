import { requireRole } from "@/lib/auth-guards";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  await requireRole("HR_ADMIN", "TS_ADMIN");

  return (
    <div className="flex flex-col gap-6">
      {children}
    </div>
  );
}
