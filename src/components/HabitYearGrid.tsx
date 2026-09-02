import { Entity } from "../api";
import { habitStatusOn, computeStreak, computeBestStreak } from "../habitUtils";
import { todayStr } from "../dateUtils";

const MONTH_NAMES = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

export default function HabitYearGrid({ e, year, onClose }: { e: Entity; year: number; onClose: () => void }) {
  const today = todayStr();
  const current = computeStreak(e, today);
  const best = computeBestStreak(e, today);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal habit-year-modal" onClick={ev => ev.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{e.name}</div>
        <div className="muted" style={{ marginBottom: 14 }}>
          {year} год · 🔥 сейчас {current} подряд{best > current ? ` · рекорд ${best}` : best > 0 ? " (это и есть рекорд)" : ""}
        </div>

        <div className="habit-year-grid">
          {MONTH_NAMES.map((mName, mi) => {
            const daysInMonth = new Date(year, mi + 1, 0).getDate();
            return (
              <div key={mi} className="habit-year-row">
                <div className="habit-year-month-label">{mName}</div>
                <div className="habit-year-days">
                  {Array.from({ length: daysInMonth }, (_, di) => {
                    const d = di + 1;
                    const dateStr = `${year}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const status = habitStatusOn(e, dateStr, today);
                    return <div key={d} className={`habit-year-cell habit-year-${status}`} title={dateStr} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="habit-year-legend">
          <span><span className="habit-year-cell habit-year-done" /> выполнено</span>
          <span><span className="habit-year-cell habit-year-missed" /> пропущено</span>
          <span><span className="habit-year-cell habit-year-future" /> ещё впереди</span>
          <span><span className="habit-year-cell habit-year-na" /> не по расписанию</span>
        </div>

        <button className="cancel" style={{ marginTop: 14 }} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
