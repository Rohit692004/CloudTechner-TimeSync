"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ApprovalFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sort = searchParams.get("sort") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const search = searchParams.get("search") || "";

  const [searchVal, setSearchVal] = React.useState(search);

  // Sync state if search param changes from outside (e.g. clear filters)
  React.useEffect(() => {
    setSearchVal(search);
  }, [search]);

  const updateFilters = (updates: { sort?: string; startDate?: string; endDate?: string; search?: string }) => {
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

    if (updates.search !== undefined) {
      if (updates.search) {
        params.set("search", updates.search);
      } else {
        params.delete("search");
      }
    }

    router.push(`/manager?${params.toString()}`);
  };

  // Debounce search update to avoid constant reload while typing
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchVal !== search) {
        updateFilters({ search: searchVal });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchVal]);

  const handleReset = () => {
    router.push("/manager");
  };

  const hasActiveFilters = startDate || endDate || sort || search;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-2 rounded-lg border border-gray-150 shadow-sm text-xs font-semibold text-gray-700">
      {/* Search Bar */}
      <div className="relative w-full sm:w-52">
        <span className="absolute inset-y-0 left-2.5 flex items-center text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          placeholder="Search employee..."
          className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-gray-700 placeholder-gray-400 focus:border-emerald-500 focus:outline-none transition-all"
        />
      </div>

      <div className="h-4 w-px bg-gray-200 hidden sm:block" />

      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <span className="text-gray-450 font-medium whitespace-nowrap">Filter weeks:</span>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => updateFilters({ startDate: e.target.value })}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors cursor-pointer"
            title="Start date"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => updateFilters({ endDate: e.target.value })}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors cursor-pointer"
            title="End date"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <>
          <div className="h-4 w-px bg-gray-200 hidden sm:block" />
          <button
            type="button"
            onClick={handleReset}
            className="text-red-650 hover:text-red-700 transition-colors px-2 py-1 hover:bg-red-50 rounded-md font-medium whitespace-nowrap"
          >
            Clear Filters
          </button>
        </>
      )}
    </div>
  );
}
