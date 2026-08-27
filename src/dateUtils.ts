export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (dt.getDay() + 6) % 7; // 0=Mon..6=Sun
}

export function dayMonthOf(dateStr: string): { day: number; month: number } {
  const [, m, d] = dateStr.split("-").map(Number);
  return { day: d, month: m };
}

export function daysUntilNext(month: number, day: number, fromDateStr: string): number {
  const [fy] = fromDateStr.split("-").map(Number);
  const from = new Date(fromDateStr + "T00:00:00");
  let target = new Date(fy, month - 1, day);
  if (target.getTime() < from.getTime()) target = new Date(fy + 1, month - 1, day);
  return Math.round((target.getTime() - from.getTime()) / 86400000);
}
