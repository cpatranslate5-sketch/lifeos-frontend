import { Entity } from "../api";
import { todayStr, daysUntilNext } from "../dateUtils";

function daysWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "день";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "дня";
  return "дней";
}

export default function Countdown({ entities }: { entities: Entity[] }) {
  const today = todayStr();

  const candidates: { name: string; days: number }[] = [];

  for (const e of entities) {
    if (e.type === "anniversary" && e.attributes?.month && e.attributes?.day) {
      candidates.push({ name: e.name, days: daysUntilNext(e.attributes.month, e.attributes.day, today) });
    }
    if (e.type === "event" && e.attributes?.date && e.attributes.date > today) {
      const [, m, d] = e.attributes.date.split("-").map(Number);
      const diff = Math.round((new Date(e.attributes.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
      candidates.push({ name: e.name, days: diff });
    }
  }

  if (candidates.length === 0) return null;
  const nearest = candidates.sort((a, b) => a.days - b.days)[0];
  if (nearest.days === 0) return null; // today already shows in its own section

  return (
    <div className="countdown-widget">
      <span className="suggestion-label">До «{nearest.name}»</span>
      <div>{nearest.days} {daysWord(nearest.days)}</div>
    </div>
  );
}
