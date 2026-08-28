import { Entity } from "../api";
import { addDaysStr, todayStr } from "../dateUtils";
import { habitOccursOn } from "../habitUtils";

function timeToMinutes(t?: string): number {
  if (!t) return 1440;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return 1440;
  return h * 60 + (m || 0);
}

export default function TomorrowPreview({ entities }: { entities: Entity[] }) {
  const tomorrow = addDaysStr(todayStr(), 1);

  const items = entities.filter(e => {
    if (e.attributes?.status === "skipped") return false;
    if (e.type === "event") return e.attributes?.date === tomorrow;
    if (e.type === "task") return e.attributes?.date === tomorrow;
    if (e.type === "habit") return habitOccursOn(e, tomorrow);
    return false;
  }).sort((a, b) => timeToMinutes(a.attributes?.time) - timeToMinutes(b.attributes?.time));

  if (items.length === 0) return null;

  return (
    <div className="tomorrow-preview">
      <span className="suggestion-label">Завтра ожидает</span>
      {items.map(e => (
        <div key={e.id} className="tomorrow-preview-row">
          {e.attributes?.time && <span className="tomorrow-preview-time">{e.attributes.time}</span>}
          <span>{e.name}</span>
        </div>
      ))}
    </div>
  );
}
