"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WeekDatePicker({ currentWeekISO }: { currentWeekISO: string }) {
  const router = useRouter();
  const [val, setVal] = useState(currentWeekISO);

  function handleChange(newDateStr: string) {
    if (!newDateStr) return;
    setVal(newDateStr);

    // Calculate Monday of the selected date in UTC
    const date = new Date(`${newDateStr}T00:00:00.000Z`);
    if (isNaN(date.getTime())) return;
    
    const day = date.getUTCDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? -6 : 1 - day;
    date.setUTCDate(date.getUTCDate() + diff);
    
    const mondayISO = date.toISOString().slice(0, 10);
    router.push(`/employee?week=${mondayISO}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 font-medium hidden sm:inline">Jump to:</span>
      <input
        type="date"
        value={val}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-750 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors cursor-pointer"
      />
    </div>
  );
}
