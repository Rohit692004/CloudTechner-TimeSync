"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
};

export function HeaderNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1.5">
      {items.map((item) => {
        // Matches exact path or starts with path (except home/root matches)
        const active =
          pathname === item.href ||
          (item.href !== "/" && item.href !== "/employee" && item.href !== "/manager" && pathname.startsWith(item.href)) ||
          (item.href === "/employee" && pathname === "/employee") ||
          (item.href === "/manager" && pathname.startsWith("/manager"));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
              active
                ? "bg-white/15 text-white shadow-sm shadow-black/5"
                : "text-white/75 hover:text-white hover:bg-white/10"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
