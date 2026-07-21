import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { dashboardPathForRole } from "@/lib/roles";

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && nextUrl.pathname === "/login") {
    return NextResponse.redirect(
      new URL(dashboardPathForRole(req.auth.user.role), nextUrl.origin)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
