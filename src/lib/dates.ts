export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Monday (UTC midnight) of the week containing `date`. */
export function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function weekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Mondays (as ISO dates) whose date falls within the calendar month containing `date`. */
export function mondaysInMonth(date: Date): string[] {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const mondays: string[] = [];
  let cursor = mondayOf(new Date(Date.UTC(year, month, 1)));
  if (cursor.getUTCMonth() !== month) cursor = addDays(cursor, 7);
  while (cursor.getUTCMonth() === month && cursor.getUTCFullYear() === year) {
    mondays.push(toISODate(cursor));
    cursor = addDays(cursor, 7);
  }
  return mondays;
}
