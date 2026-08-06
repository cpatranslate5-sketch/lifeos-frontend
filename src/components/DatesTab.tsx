import { useState } from "react";
import { Entity, createEntity } from "../api";
import EntityCard from "./EntityCard";

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

  const sorted = [...items].sort((a, b) => {
    const am = a.attributes?.month || 13, ad = a.attributes?.day || 32;
    const bm = b.attributes?.month || 13, bd = b.attributes?.day || 32;
    return am !== bm ? am - bm : ad - bd;
  });

  return (
    <div className="view">
      <h1>Даты</h1>
      <div className="muted" style={{ marginBottom: 10 }}>Ежегодные даты (дни рождения и т.п.) — за неделю и в сам день приложение само создаст напоминание в "Сегодня".</div>
      <div className="addrow" style={{ flexWrap: "wrap" }}>
        <input value={name} placeholder="Кто/что…" onChange={e => setName(e.target.value)} style={{ minWidth: 120 }} />
        <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 10px", color: "var(--text)" }} />
        <button onClick={submit}>+</button>
      </div>
      {sorted.length === 0 && <div className="muted">Пока пусто.</div>}
      {sorted.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} />)}
    </div>
  );
}
