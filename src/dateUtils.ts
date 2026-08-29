// "Сегодня" во всём приложении привязано к московскому времени (GMT+3),
// а не к часовому поясу браузера — так дата не "гуляет" в зависимости от
// того, где именно открыт сайт. Date.now() всегда абсолютный момент времени
// (не зависит от локали), поэтому достаточно сдвинуть его на +3 часа и
// читать через UTC-геттеры — так избегаем двойного сдвига через локальный
// часовой пояс браузера.
export function todayStr(): string {
  const d = new Date(Date.now() + 3 * 3600000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// UTC-timestamp of 00:00 Moscow time (GMT+3) on the given date — used for
// live countdowns so "midnight" always means Moscow midnight, regardless of
// where the browser itself is physically located.
export function moscowMidnightMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, 0, 0) - 3 * 3600000;
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
