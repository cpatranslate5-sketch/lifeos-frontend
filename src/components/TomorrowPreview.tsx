import { useState } from "react";
import { Entity } from "../api";
import { addDaysStr, todayStr } from "../dateUtils";
import { habitOccursOn } from "../habitUtils";

function timeToMinutes(t?: string): number {
  if (!t) return 1440;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return 1440;
  return h * 60 + (m || 0);
}

function itemsWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "дело";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "дела";
  return "дел";
}

export default function TomorrowPreview({ entities }: { entities: Entity[] }) {
  const [expanded, setExpanded] = useState(false);
  const tomorrow = addDaysStr(todayStr(), 1);

  const items = entities.filter(e => {
    if (e.attributes?.status === "skipped") return false;
    if (e.type === "event") return e.attributes?.date === tomorrow;
    if (e.type === "task") return e.attributes?.date === tomorrow;
    if (e.type === "habit") return habitOccursOn(e, tomorrow);
    return false;
  }).sort((a, b) => timeToMinutes(a.attributes?.time) - timeToMinutes(b.attributes?.time));

  if (items.length === 0) return null;
  const first = items[0];

  return (
    <div className="tomorrow-preview" onClick={() => setExpanded(!expanded)}>
      <div className="tomorrow-preview-summary">
        <span className="suggestion-label">Завтра</span>
        <span>
          {items.length} {itemsWord(items.length)}{first.attributes?.time ? ` · ближайшее в ${first.attributes.time}` : ""}
        </span>
        <span className="tomorrow-preview-chevron">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="tomorrow-preview-list">
          {items.map(e => (
            <div key={e.id} className="tomorrow-preview-row">
              {e.attributes?.time && <span className="tomorrow-preview-time">{e.attributes.time}</span>}
              <span>{e.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
