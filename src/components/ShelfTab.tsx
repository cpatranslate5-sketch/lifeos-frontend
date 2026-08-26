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
  space?: string;
  profile: string;
}

function sortKey(e: Entity): number {
  if (e.attributes?.done) return 2;
  if (e.attributes?.status === "in_progress") return 0;
  return 1;
}

export default function ShelfTab({ title, placeholder, type, items, onChanged, extraAttrs, space, profile }: Props) {
  const [val, setVal] = useState("");
  const [newInProgress, setNewInProgress] = useState(false);
  const isGame = type === "game";

  async function submit() {
    if (!val.trim()) return;
    const attrs = { ...(extraAttrs || {}) };
    if (isGame && newInProgress) attrs.status = "in_progress";
    await createEntity(type, val.trim(), attrs, space || "life", profile);
    setVal(""); setNewInProgress(false);
    onChanged();
  }

  const sorted = [...items].sort((a, b) => sortKey(a) - sortKey(b));

  return (
    <div className="view">
      <h1>{title}</h1>
      <div className="addrow">
        <input value={val} placeholder={placeholder} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <button onClick={submit}>+</button>
      </div>
      {isGame && (
        <label className="genre-chip" style={{ marginBottom: 12, display: "inline-flex" }}>
          <input type="checkbox" checked={newInProgress} onChange={e => setNewInProgress(e.target.checked)} />
          Играю сейчас
        </label>
      )}
      {sorted.length === 0 && <div className="muted">Пока пусто.</div>}
      {sorted.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} profile={profile} />)}
    </div>
  );
}
