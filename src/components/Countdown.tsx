import { Entity } from "../api";
import { todayStr, daysUntilNext } from "../dateUtils";

function daysWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "день";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "дня";
  return "дней";
}

function toGenitive(name: string): string {
  // "До <X>" needs the genitive case — we can't decline arbitrary Russian
  // names, but "День Рождения ..." is common enough (from anniversaries) to
  // handle explicitly: "День Рождения X" → "Дня Рождения X".
  if (/^день рождения/i.test(name)) {
    return name.replace(/^день/i, "Дня");
  }
  return name;
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
      <span className="suggestion-label">До «{toGenitive(nearest.name)}»</span>
      <div>{nearest.days} {daysWord(nearest.days)}</div>
    </div>
  );
}
