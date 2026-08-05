import { useState } from "react";
import { Entity, createEntity } from "../api";
import EntityCard from "./EntityCard";

export default function LongTerm({ items, space, onChanged }: { items: Entity[]; space: string; onChanged: () => void }) {
  const [val, setVal] = useState("");

  async function submit() {
    if (!val.trim()) return;
    await createEntity("project", val.trim(), {}, space);
    setVal("");
    onChanged();
  }

  return (
    <div className="view">
      <h1>Долгосрочное</h1>
      <div className="addrow">
        <input value={val} placeholder="Проект, направление, долгосрочная цель…" onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <button onClick={submit}>+</button>
      </div>
      {items.length === 0 && <div className="muted">Пока пусто.</div>}
      {items.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} showNextStep />)}
    </div>
  );
}
