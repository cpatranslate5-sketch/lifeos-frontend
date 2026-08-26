import { useEffect, useState } from "react";
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

const PAGE_SIZE = 25;

function sortKey(e: Entity): number {
  if (e.attributes?.done) return 2;
  if (e.attributes?.status === "in_progress") return 0;
  return 1;
}

export default function ShelfTab({ title, placeholder, type, items, onChanged, extraAttrs, space, profile }: Props) {
  const [val, setVal] = useState("");
  const [newInProgress, setNewInProgress] = useState(false);
  const [page, setPage] = useState(1);
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
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [items.length]);

  return (
    <div className="view">
      <h1>{title}</h1>
      <div className="addrow">
        <input value={val} placeholder={placeholder} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <button onClick={submit}>+</button>
      </div>
      {isGame && (
        <label className={`status-chip ${newInProgress ? "on" : ""}`} style={{ marginBottom: 12, display: "inline-flex" }}>
          <input type="checkbox" checked={newInProgress} onChange={e => setNewInProgress(e.target.checked)} />
          Играю сейчас
        </label>
      )}
      {sorted.length === 0 && <div className="muted">Пока пусто.</div>}
      {pageItems.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} profile={profile} />)}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <div key={n} className={`page-btn ${n === page ? "on" : ""}`} onClick={() => setPage(n)}>{n}</div>
          ))}
        </div>
      )}
    </div>
  );
}
