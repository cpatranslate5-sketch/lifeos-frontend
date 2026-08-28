import { useState } from "react";
import { todayStr } from "../dateUtils";

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WEEKDAYS_RU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function pad(n: number): string { return String(n).padStart(2, "0"); }

export default function MiniCalendar({ minDate, initialDate, onSelect }: { minDate?: string; initialDate?: string; onSelect: (date: string) => void }) {
  const base = minDate || initialDate || todayStr();
  const [y0, m0] = base.split("-").map(Number);
  const [viewYear, setViewYear] = useState(y0);
  const [viewMonth, setViewMonth] = useState(m0 - 1); // 0-indexed

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function shiftMonth(delta: number) {
    let ny = viewYear, nm = viewMonth + delta;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setViewYear(ny); setViewMonth(nm);
  }

  const cells: (number | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="mini-calendar" onClick={(ev) => ev.stopPropagation()}>
      <div className="mini-calendar-header">
        <span className="why" onClick={() => shiftMonth(-1)}>←</span>
        <span>{MONTHS_RU[viewMonth]} {viewYear}</span>
        <span className="why" onClick={() => shiftMonth(1)}>→</span>
      </div>
      <div className="mini-calendar-weekdays">
        {WEEKDAYS_RU.map(w => <span key={w}>{w}</span>)}
      </div>
      <div className="mini-calendar-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
          const disabled = !!minDate && dateStr < minDate;
          const isToday = dateStr === todayStr();
          return (
            <span key={i} className={`mini-calendar-day ${disabled ? "disabled" : ""} ${isToday ? "today" : ""}`}
              onClick={() => !disabled && onSelect(dateStr)}>
              {d}
            </span>
          );
        })}
      </div>
    </div>
  );
}
