import { Entity } from "../api";
import { habitStatusOn, computeStreak, computeBestStreak } from "../habitUtils";
import { todayStr, addDaysStr } from "../dateUtils";

const MONTH_NAMES = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function weekRatio(e: Entity, weekStart: string, today: string, earliestDone: string | null): number | null {
  let scheduled = 0, done = 0;
  let cursor = weekStart;
  for (let i = 0; i < 7; i++) {
    let status = habitStatusOn(e, cursor, today);
    if (status === "missed" && earliestDone && cursor < earliestDone) status = "na";
    if (status === "done") { scheduled++; done++; }
    else if (status === "missed") { scheduled++; }
    cursor = addDaysStr(cursor, 1);
  }
  if (scheduled === 0) return null;
  return done / scheduled;
}

function bucketClass(ratio: number | null): string {
  if (ratio === null) return "na";
  if (ratio === 0) return "r0";
  if (ratio < 0.4) return "r1";
  if (ratio < 0.7) return "r2";
  if (ratio < 1) return "r3";
  return "r4";
}

export default function HabitYearGrid({ e, year, onClose }: { e: Entity; year: number; onClose: () => void }) {
  const today = todayStr();
  const current = computeStreak(e, today);
  const best = computeBestStreak(e, today);
  const doneDates: string[] = e.attributes?.done_dates || [];
  const earliestDone = doneDates.length > 0 ? [...doneDates].sort()[0] : null;

  // 52 недель подряд от 1 января — простая, приблизительная разбивка
  // (не выровнена по календарным неделям пн-вс), зато весь год влезает в
  // одну компактную полосу.
  const weeks: { start: string; ratio: number | null }[] = [];
  let cursor = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  while (cursor <= yearEnd) {
    weeks.push({ start: cursor, ratio: weekRatio(e, cursor, today, earliestDone) });
    cursor = addDaysStr(cursor, 7);
  }

  // Группируем недели по месяцу их начала — просто для подписи слева.
  const monthGroups: { month: number; weeks: typeof weeks }[] = [];
  for (const w of weeks) {
    const m = Number(w.start.slice(5, 7)) - 1;
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.month === m) last.weeks.push(w);
    else monthGroups.push({ month: m, weeks: [w] });
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal habit-year-modal" onClick={ev => ev.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{e.name}</div>
        <div className="muted" style={{ marginBottom: 14 }}>
          {year} год · 🔥 сейчас {current} подряд{best > current ? ` · рекорд ${best}` : best > 0 ? " (это и есть рекорд)" : ""}
        </div>

        <div className="habit-heatmap">
          {monthGroups.map((g, i) => (
            <div key={i} className="habit-heatmap-row">
              <div className="habit-year-month-label">{MONTH_NAMES[g.month]}</div>
              <div className="habit-heatmap-cells">
                {g.weeks.map((w, wi) => (
                  <div key={wi} className={`habit-heatmap-cell ${bucketClass(w.ratio)}`} title={w.start} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="habit-year-legend">
          <span>меньше</span>
          <span className="habit-heatmap-cell r0" />
          <span className="habit-heatmap-cell r1" />
          <span className="habit-heatmap-cell r2" />
          <span className="habit-heatmap-cell r3" />
          <span className="habit-heatmap-cell r4" />
          <span>больше</span>
        </div>

        <button className="cancel" style={{ marginTop: 14 }} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
