import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  basePath,
  className,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  basePath: string;
  className?: string;
}) {
  const active = currentSort === sortKey;
  const nextDir = active && currentDir === "asc" ? "desc" : "asc";
  const href = `${basePath}?sort=${sortKey}&dir=${nextDir}`;

  return (
    <Link href={href} className={`inline-flex items-center gap-1 hover:text-foreground ${className ?? ""}`}>
      {label}
      {active ? (
        currentDir === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </Link>
  );
}
