export const ROLES = ["EMPLOYEE", "PROJECT_MANAGER", "HR_ADMIN", "TS_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case "TS_ADMIN":
      return "/admin";
    case "HR_ADMIN":
      return "/hr";
    case "PROJECT_MANAGER":
      return "/manager";
    case "EMPLOYEE":
    default:
      return "/employee";
  }
}
