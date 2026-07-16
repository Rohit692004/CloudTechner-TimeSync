"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export function SortHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "desc";

  const handleToggle = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === "week_desc") {
      params.set("sort", "week_asc");
    } else if (currentSort === "week_asc") {
      params.set("sort", "desc"); // cycle back to default (Latest Submitted)
    } else {
      params.set("sort", "week_desc");
    }
    router.push(`/manager?${params.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="flex items-center gap-1 hover:text-emerald-700 transition-colors font-semibold group focus:outline-none"
    >
      <span>Week</span>
      {currentSort === "week_desc" ? (
        <ArrowDown className="w-3.5 h-3.5 text-emerald-700 font-bold" />
      ) : currentSort === "week_asc" ? (
        <ArrowUp className="w-3.5 h-3.5 text-emerald-700 font-bold" />
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
      )}
    </button>
  );
}
