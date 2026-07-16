"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ApprovalFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sort = searchParams.get("sort") || "desc";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  const updateFilters = (updates: { sort?: string; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (updates.sort !== undefined) {
      if (updates.sort) {
        params.set("sort", updates.sort);
      } else {
        params.delete("sort");
      }
    }
    
    if (updates.startDate !== undefined) {
      if (updates.startDate) {
        params.set("startDate", updates.startDate);
      } else {
        params.delete("startDate");
      }
    }
    
    if (updates.endDate !== undefined) {
      if (updates.endDate) {
        params.set("endDate", updates.endDate);
      } else {
        params.delete("endDate");
      }
    }

    router.push(`/manager?${params.toString()}`);
  };

  const handleReset = () => {
    router.push("/manager");
  };

  const hasActiveFilters = startDate || endDate || sort !== "desc";

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg border border-gray-150 shadow-sm text-xs font-semibold text-gray-700">
      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <span className="text-gray-450 font-medium">Filter weeks:</span>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => updateFilters({ startDate: e.target.value })}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors cursor-pointer"
            title="Start date"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => updateFilters({ endDate: e.target.value })}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors cursor-pointer"
            title="End date"
          />
        </div>
      </div>

      <div className="h-4 w-px bg-gray-200" />

      {/* Sort Select */}
      <div className="flex items-center gap-2">
        <span className="text-gray-450 font-medium">Sort by:</span>
        <select
          value={sort}
          onChange={(e) => updateFilters({ sort: e.target.value })}
          className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors cursor-pointer font-semibold"
        >
          <option value="desc">Latest Submitted</option>
          <option value="asc">Oldest Submitted</option>
          <option value="week_desc">Latest Week Start</option>
          <option value="week_asc">Oldest Week Start</option>
        </select>
      </div>

      {hasActiveFilters && (
        <>
          <div className="h-4 w-px bg-gray-200" />
          <button
            type="button"
            onClick={handleReset}
            className="text-red-600 hover:text-red-700 transition-colors px-2 py-1 hover:bg-red-50 rounded-md font-medium"
          >
            Clear Filters
          </button>
        </>
      )}
    </div>
  );
}
