import { useEffect, useState } from "react";
import { Entity } from "../api";
import { todayStr, daysUntilNext, addDaysStr, moscowMidnightMs, moscowTimestampMs } from "../dateUtils";

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

function pad2(n: number): string { return String(n).padStart(2, "0"); }

function UnitBoxes({ value, label }: { value: number; label: string }) {
  const str = pad2(Math.max(0, Math.min(99, value)));
  return (
    <div className="countdown-unit">
      <div className="countdown-unit-boxes">
        {str.split("").map((ch, i) => <span key={i} className="digit-box">{ch}</span>)}
      </div>
      <div className="countdown-unit-label">{label}</div>
    </div>
  );
}

export default function Countdown({ entities }: { entities: Entity[] }) {
  const today = todayStr();
  const [now, setNow] = useState(() => new Date());

  const candidates: { name: string; targetDate: string; targetTime?: string }[] = [];

  for (const e of entities) {
    if (e.type === "anniversary" && e.attributes?.month && e.attributes?.day) {
      const days = daysUntilNext(e.attributes.month, e.attributes.day, today);
      candidates.push({ name: e.name, targetDate: addDaysStr(today, days) });
    }
    if (e.type === "event" && e.attributes?.date && e.attributes.date >= today) {
      candidates.push({ name: e.name, targetDate: e.attributes.date, targetTime: e.attributes.time });
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (candidates.length === 0) return null;

  // Nearest by actual remaining time, then filter to the 99-day cap.
  const withDiff = candidates.map(c => ({
    ...c,
    diffMs: (c.targetTime ? moscowTimestampMs(c.targetDate, c.targetTime) : moscowMidnightMs(c.targetDate)) - now.getTime(),
  })).filter(c => c.diffMs >= -999) // allow "today" (small negative jitter near the moment) but not stale past events
    .sort((a, b) => a.diffMs - b.diffMs);

  if (withDiff.length === 0) return null;
  const minDiff = withDiff[0].diffMs;
  const days = Math.floor(Math.max(0, minDiff) / 86400000);
  if (days > 99) return null;

  const nearest = withDiff.filter(c => c.diffMs === minDiff);
  const diffMs = Math.max(0, minDiff);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  return (
    <div className="countdown-widget">
      <div className="countdown-top">
        <span className="suggestion-label">До {joinNamesRu(nearest.map(c => c.name))}</span>
      </div>
      <div className="countdown-timer-row">
        <UnitBoxes value={days} label="дн." />
        <span className="countdown-colon">:</span>
        <UnitBoxes value={hours} label="ч." />
        <span className="countdown-colon">:</span>
        <UnitBoxes value={minutes} label="мин." />
        <span className="countdown-colon">:</span>
        <UnitBoxes value={seconds} label="сек." />
      </div>
    </div>
  );
}
