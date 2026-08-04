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
