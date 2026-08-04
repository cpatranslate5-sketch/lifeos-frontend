import { useState } from "react";
import { Entity, createEntity } from "../api";
import EntityCard from "./EntityCard";

interface Props {
  title: string;
  placeholder: string;
  type: string;
  items: Entity[];
  onChanged: () => void;
  extraAttrs?: Record<string, any>;
}

export default function ShelfTab({ title, placeholder, type, items, onChanged, extraAttrs }: Props) {
  const [val, setVal] = useState("");

  async function submit() {
    if (!val.trim()) return;
    await createEntity(type, val.trim(), extraAttrs || {});
    setVal("");
    onChanged();
  }

  return (
    <div className="view">
      <h1>{title}</h1>
      <div className="addrow">
        <input value={val} placeholder={placeholder} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <button onClick={submit}>+</button>
      </div>
      {items.length === 0 && <div className="muted">Пока пусто.</div>}
      {items.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} />)}
    </div>
  );
}
