import { requireRole } from "@/lib/auth-guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("TS_ADMIN");

  return (
    <div className="flex flex-col gap-6">
      {children}
    </div>
  );
}
