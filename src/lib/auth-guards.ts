import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { dashboardPathForRole, type Role } from "@/lib/roles";

export async function requireRole(...allowed: Role[]) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!allowed.includes(session.user.role)) {
    redirect(dashboardPathForRole(session.user.role));
  }
  return session.user;
}
