import { Entity } from "./api";
import { weekdayOf, addDaysStr } from "./dateUtils";

export function habitOccursOn(e: Entity, dateStr: string): boolean {
  if (!e.attributes?.recurring) return false;
  if ((e.attributes?.skipped_dates || []).includes(dateStr)) return false;
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

/**
 * Counts consecutive scheduled occurrences that were completed, walking
 * backward from today. Stops at the first scheduled-but-not-done day.
 * A day that isn't scheduled for this habit is skipped over (doesn't
 * break the streak) so e.g. a Mon/Wed/Fri habit's streak isn't broken by
 * the days in between.
 */
export function computeStreak(e: Entity, todayStr: string): number {
  const doneDates: string[] = e.attributes?.done_dates || [];
  let streak = 0;
  let cursor = todayStr;
  const todayScheduled = habitOccursOn(e, todayStr);
  const todayDone = doneDates.includes(todayStr);
  // If today is scheduled but not yet done, start counting from yesterday
  // instead — an unmarked "today" shouldn't read as a broken streak before
  // the day is even over.
  if (todayScheduled && !todayDone) cursor = addDaysStr(todayStr, -1);

  for (let i = 0; i < 3650; i++) {
    if (habitOccursOn(e, cursor)) {
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
