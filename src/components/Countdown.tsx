import { useEffect, useState } from "react";
import { Entity } from "../api";
import { todayStr, daysUntilNext } from "../dateUtils";

function daysWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "день";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "дня";
  return "дней";
}

function toGenitive(name: string): string {
  if (/^день рождения/i.test(name)) {
    return name.replace(/^день/i, "Дня");
  }
  return name;
}

function joinNamesRu(names: string[]): string {
  const quoted = names.map(n => `«${toGenitive(n)}»`);
  if (quoted.length === 1) return quoted[0];
  return quoted.slice(0, -1).join(", ") + " и " + quoted[quoted.length - 1];
}

function pad(n: number): string { return String(n).padStart(2, "0"); }

function DigitTimer({ value }: { value: string }) {
  return (
    <div className="digit-timer">
      {value.split("").map((ch, i) => (
        /\d/.test(ch)
          ? <span key={i} className="digit-box">{ch}</span>
          : <span key={i} className="digit-sep">{ch}</span>
      ))}
    </div>
  );
}

export default function Countdown({ entities }: { entities: Entity[] }) {
  const today = todayStr();
  const [now, setNow] = useState(() => new Date());

  const candidates: { name: string; days: number; targetDate: string }[] = [];

  for (const e of entities) {
    if (e.type === "anniversary" && e.attributes?.month && e.attributes?.day) {
      const days = daysUntilNext(e.attributes.month, e.attributes.day, today);
      candidates.push({ name: e.name, days, targetDate: "" });
    }
    if (e.type === "event" && e.attributes?.date && e.attributes.date >= today) {
      const diff = Math.round((new Date(e.attributes.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
      candidates.push({ name: e.name, days: diff, targetDate: e.attributes.date });
    }
  }

  useEffect(() => {
    const minDaysNow = candidates.length > 0 ? Math.min(...candidates.map(c => c.days)) : null;
    if (minDaysNow === null || minDaysNow > 7) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities]);

  if (candidates.length === 0) return null;
  const minDays = Math.min(...candidates.map(c => c.days));
  const nearest = candidates.filter(c => c.days === minDays);

  let liveTimer: string | null = null;
  if (minDays <= 7) {
    const withDate = nearest.find(c => c.targetDate);
    if (withDate) {
      const target = new Date(withDate.targetDate + "T00:00:00").getTime();
      const diffMs = Math.max(0, target - now.getTime());
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      liveTimer = `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
  }

  const lessThanDay = minDays <= 0;
  if (lessThanDay && !liveTimer) return null; // nothing meaningful left to show

  return (
    <div className={`countdown-widget ${lessThanDay ? "countdown-centered" : ""}`}>
      <span className="suggestion-label">До {joinNamesRu(nearest.map(c => c.name))}</span>
      <div className="countdown-row">
        {!lessThanDay && <span className="countdown-days">{minDays} {daysWord(minDays)}</span>}
        {liveTimer && <DigitTimer value={liveTimer} />}
      </div>
    </div>
  );
}
