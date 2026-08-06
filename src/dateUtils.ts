export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function localDateStr(dt: Date): string {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return localDateStr(dt);
}

export function weekdayOf(dateStr: string): number {
  // 0=Mon..6=Sun, matching Python's date.weekday() used by the backend seed
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

export function dayMonthOf(dateStr: string): { day: number; month: number } {
  const [, m, d] = dateStr.split("-").map(Number);
  return { day: d, month: m };
}

export function parseDDMM(s: string): { day: number; month: number } | null {
  const m = s.trim().match(/^(\d{1,2})[.\/-](\d{1,2})\.?$/);
  if (!m) return null;
  const day = parseInt(m[1], 10), month = parseInt(m[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month };
}

export function formatDDMM(day: number, month: number): string {
  return `${pad2(day)}.${pad2(month)}`;
}

export function daysUntilNext(day: number, month: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let target = new Date(today.getFullYear(), month - 1, day);
  target.setHours(0, 0, 0, 0);
  if (target < today) {
    target = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
