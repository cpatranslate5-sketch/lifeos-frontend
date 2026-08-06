import { useState } from "react";
import { Entity, createEntity } from "../api";
import EntityCard from "./EntityCard";
import { daysUntilNext } from "../dateUtils";

function proximityLabel(days: number): string {
  if (days === 0) return "сегодня!";
  if (days === 1) return "завтра";
  const lastDigit = days % 10, lastTwo = days % 100;
  let word = "дней";
  if (lastTwo < 11 || lastTwo > 14) {
    if (lastDigit === 1) word = "день";
    else if (lastDigit >= 2 && lastDigit <= 4) word = "дня";
  }
  return `через ${days} ${word}`;
}

export default function DatesTab({ items, onChanged }: { items: Entity[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [dateVal, setDateVal] = useState("");

  async function submit() {
    if (!name.trim() || !dateVal) return;
    const [, m, d] = dateVal.split("-").map(Number); // yyyy-mm-dd input, year ignored
    await createEntity("anniversary", name.trim(), { month: m, day: d }, "life");
    setName(""); setDateVal("");
    onChanged();
  }

  const withDays = items
    .filter(it => it.attributes?.month && it.attributes?.day)
    .map(it => ({ it, days: daysUntilNext(it.attributes.day, it.attributes.month) }))
    .sort((a, b) => a.days - b.days);

  return (
    <div className="view">
      <h1>Даты</h1>
      <div className="muted" style={{ marginBottom: 10 }}>Ежегодные даты (дни рождения и т.п.), отсортированы по близости — за неделю и в сам день приложение само создаст напоминание в "Сегодня".</div>
      <div className="addrow" style={{ flexWrap: "wrap" }}>
        <input value={name} placeholder="Кто/что…" onChange={e => setName(e.target.value)} style={{ minWidth: 120 }} />
        <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 10px", color: "var(--text)" }} />
        <button onClick={submit}>+</button>
      </div>
      {withDays.length === 0 && <div className="muted">Пока пусто.</div>}
      {withDays.map(({ it, days }) => (
        <div key={it.id}>
          <div className={days <= 7 ? "proximity-badge soon" : "proximity-badge"}>{proximityLabel(days)}</div>
          <EntityCard e={it} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}
