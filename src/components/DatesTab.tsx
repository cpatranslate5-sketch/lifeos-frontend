import { useState } from "react";
import { Entity, createEntity } from "../api";
import { daysUntilNext, todayStr } from "../dateUtils";

export default function DatesTab({ items, onChanged, profile }: { items: Entity[]; onChanged: () => void; profile: string }) {
  const [name, setName] = useState("");
  const [dateVal, setDateVal] = useState("");

  async function submit() {
    if (!name.trim() || !dateVal) return;
    const [, m, d] = dateVal.split("-").map(Number); // yyyy-mm-dd input, year ignored
    await createEntity("anniversary", name.trim(), { month: m, day: d }, "life", profile);
    setName(""); setDateVal("");
    onChanged();
  }

  const valid = items.filter(e => e.attributes?.month && e.attributes?.day);
  const today = todayStr();
  const sorted = [...valid].sort((a, b) =>
    daysUntilNext(a.attributes.month, a.attributes.day, today) - daysUntilNext(b.attributes.month, b.attributes.day, today)
  );

  return (
    <div className="view">
      <h1>События</h1>
      <div className="addrow">
        <input value={name} placeholder="Имя / повод…" onChange={e => setName(e.target.value)}
          style={{ flex: 2 }} onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "0 10px", color: "var(--text)", fontSize: "0.82rem" }} />
        <button onClick={submit}>+</button>
      </div>

      {sorted.length === 0 && <div className="muted">Пока пусто.</div>}
      {sorted.map(e => {
        const days = daysUntilNext(e.attributes.month, e.attributes.day, today);
        const label = days === 0 ? "сегодня!" : days === 1 ? "завтра" : `через ${days} дней`;
        return (
          <div key={e.id} className={`card ${days <= 7 ? "upcoming" : ""}`} style={{ marginBottom: 10 }}>
            <div className="card-title-text">{e.name}</div>
            <div className="field">{e.attributes.day}.{String(e.attributes.month).padStart(2, "0")} — {label}</div>
          </div>
        );
      })}
    </div>
  );
}
