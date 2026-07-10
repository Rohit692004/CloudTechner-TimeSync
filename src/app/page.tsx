import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { dashboardPathForRole } from "@/lib/roles";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  redirect(dashboardPathForRole(session.user.role));
}
