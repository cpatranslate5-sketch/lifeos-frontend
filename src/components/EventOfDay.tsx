import { Entity } from "../api";
import { todayStr, dayMonthOf } from "../dateUtils";

export default function EventOfDay({ entities }: { entities: Entity[] }) {
  const { day, month } = dayMonthOf(todayStr());
  const today = entities.filter(e =>
    e.type === "anniversary" && e.attributes?.day === day && e.attributes?.month === month
  );
  if (today.length === 0) return null;

  return (
    <div className="event-of-day">
      <span className="suggestion-label">Сегодня</span>
      {today.map(e => <div key={e.id}>🎉 {e.name}</div>)}
    </div>
  );
}
