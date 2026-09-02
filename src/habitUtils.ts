import { Entity } from "./api";
import { weekdayOf, addDaysStr } from "./dateUtils";

// "По расписанию ли этот день" — только сама повторяющаяся схема,
// без учёта явных пропусков. Нужна отдельно для подсчёта стрика: пропуск
// должен считаться провалом дня, а не отсутствием дня вовсе.
function matchesRecurrence(e: Entity, dateStr: string): boolean {
  if (!e.attributes?.recurring) return false;
  if (e.attributes?.until && dateStr > e.attributes.until) return false;
  if (e.attributes?.daily) return true;
  const wd = weekdayOf(dateStr);
  if (e.attributes?.workdays) return wd >= 0 && wd <= 4;
  if (e.attributes?.monthday) {
    const dayOfMonth = Number(dateStr.split("-")[2]);
    return Number(e.attributes.monthday) === dayOfMonth;
  }
  if (e.attributes?.biweekly && e.attributes?.anchor_date) {
    if (Number(e.attributes.weekday) !== wd) return false;
    const anchor = new Date(e.attributes.anchor_date + "T00:00:00");
    const target = new Date(dateStr + "T00:00:00");
    const daysDiff = Math.round((target.getTime() - anchor.getTime()) / 86400000);
    return daysDiff >= 0 && daysDiff % 14 === 0;
  }
  return Number(e.attributes?.weekday) === wd;
}

// Используется для отображения карточки на конкретный день — пропущенные
// дни здесь скрываются, как и раньше.
export function habitOccursOn(e: Entity, dateStr: string): boolean {
  if ((e.attributes?.skipped_dates || []).includes(dateStr)) return false;
  return matchesRecurrence(e, dateStr);
}

/**
 * Counts consecutive scheduled occurrences that were completed, walking
 * backward from today. A day matching the recurrence pattern that isn't in
 * done_dates breaks the streak — including a day the person explicitly
 * skipped ("Отменить на ...") since that's a real miss, not an absence
 * of the habit that day. A day that doesn't match the pattern at all is
 * simply skipped over (doesn't break the streak) so e.g. a Mon/Wed/Fri
 * habit's streak isn't broken by the days in between.
 */
export function computeStreak(e: Entity, todayStr: string): number {
  const doneDates: string[] = e.attributes?.done_dates || [];
  const skippedDates: string[] = e.attributes?.skipped_dates || [];
  let streak = 0;
  let cursor = todayStr;
  const todayScheduled = matchesRecurrence(e, todayStr);
  const todayDone = doneDates.includes(todayStr);
  const todaySkipped = skippedDates.includes(todayStr);
  // If today is scheduled but not yet done AND not yet explicitly skipped,
  // start counting from yesterday instead — an unmarked "today" shouldn't
  // read as a broken streak before the day is even over. But if it was
  // already explicitly skipped today, that's a real, immediate miss.
  if (todayScheduled && !todayDone && !todaySkipped) cursor = addDaysStr(todayStr, -1);

  for (let i = 0; i < 3650; i++) {
    if (matchesRecurrence(e, cursor)) {
      if (doneDates.includes(cursor)) {
        streak++;
      } else {
        break;
      }
    }
    cursor = addDaysStr(cursor, -1);
  }
  return streak;
}

/**
 * Longest-ever streak, scanning forward through the whole history of
 * done_dates rather than just the trailing run from today. Always
 * recomputed from the raw data (nothing stored separately), so it can
 * never drift out of sync with done_dates/recurrence changes.
 */
export function computeBestStreak(e: Entity, todayStr: string): number {
  const doneDates: string[] = e.attributes?.done_dates || [];
  if (doneDates.length === 0) return 0;
  const earliest = [...doneDates].sort()[0];
  let best = 0;
  let current = 0;
  let cursor = earliest;
  let guard = 0;
  while (cursor <= todayStr && guard < 20000) {
    if (matchesRecurrence(e, cursor)) {
      if (doneDates.includes(cursor)) {
        current++;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    cursor = addDaysStr(cursor, 1);
    guard++;
  }
  return best;
}

/**
 * Per-day status for the year grid: "done" (completed), "missed"
 * (scheduled but not done/explicitly skipped, and the day has already
 * passed), "future" (scheduled but the day hasn't happened yet), or "na"
 * (not on the recurrence schedule at all that day).
 */
export type HabitDayStatus = "done" | "missed" | "future" | "na";

export function habitStatusOn(e: Entity, dateStr: string, todayStr: string): HabitDayStatus {
  if (!matchesRecurrence(e, dateStr)) return "na";
  const doneDates: string[] = e.attributes?.done_dates || [];
  if (doneDates.includes(dateStr)) return "done";
  if (dateStr > todayStr) return "future";
  return "missed";
}
