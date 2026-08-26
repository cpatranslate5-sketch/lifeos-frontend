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

function PageBar({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
        <div key={n} className={`page-btn ${n === page ? "on" : ""}`} onClick={() => onPageChange(n)}>{n}</div>
      ))}
    </div>
  );
}

function GameAddModal({ profile, space, onClose, onAdded }: { profile: string; space?: string; onClose: () => void; onAdded: () => void }) {
  const [val, setVal] = useState("");
  const [developer, setDeveloper] = useState("");
  const [inProgress, setInProgress] = useState(false);

  async function submit() {
    if (!val.trim()) return;
    const attrs: Record<string, any> = {};
    if (developer.trim()) attrs.developer = developer.trim();
    if (inProgress) attrs.status = "in_progress";
    await createEntity("game", val.trim(), attrs, space || "life", profile);
    onAdded();
    onClose();
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Новая игра</div>
        <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder="Название"
          onKeyDown={e => { if (e.key === "Enter") submit(); }} style={{ marginBottom: 10 }} />
        <label className="muted">Разработчик</label>
        <input value={developer} onChange={e => setDeveloper(e.target.value)} placeholder="Название студии" />
        <label className={`status-chip ${inProgress ? "on" : ""}`} style={{ margin: "10px 0 14px", display: "inline-flex" }}>
          <input type="checkbox" checked={inProgress} onChange={e => setInProgress(e.target.checked)} />
          Играю сейчас
        </label>
        <div>
          <button onClick={submit}>Добавить</button>
          <button className="cancel" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

function GameStatsModal({ items, onClose }: { items: Entity[]; onClose: () => void }) {
  function topCounts(values: string[], n = 5): [string, number][] {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
  }
  const inProgress = items.filter(e => e.attributes?.status === "in_progress").length;
  const done = items.filter(e => e.attributes?.done).length;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Статистика</div>
        <div className="muted" style={{ marginBottom: 10 }}>Всего: {items.length} · играю сейчас: {inProgress} · пройдено: {done}</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Топ разработчиков</div>
        {topCounts(items.map(e => e.attributes?.developer).filter(Boolean)).map(([d, n]) => (
          <div key={d} className="field">{d} — {n}</div>
        ))}
        {items.every(e => !e.attributes?.developer) && <div className="muted">нет данных</div>}
        <button className="cancel" style={{ marginTop: 14 }} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}

export default function ShelfTab({ title, placeholder, type, items, onChanged, extraAttrs, space, profile }: Props) {
  const [val, setVal] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const isGame = type === "game";

  async function submit() {
    if (!val.trim()) return;
    await createEntity(type, val.trim(), extraAttrs || {}, space || "life", profile);
    setVal("");
    onChanged();
  }

  const sorted = [...items].sort((a, b) => sortKey(a) - sortKey(b));
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [items.length]);

  return (
    <div className="view">
      <h1>{title}</h1>

      {isGame ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => setShowAdd(true)} style={{ background: "var(--project)", border: "none", borderRadius: 9, padding: "9px 16px", color: "#14171F", fontWeight: 600, cursor: "pointer" }}>
              + Добавить
            </button>
            <button onClick={() => setShowStats(true)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 16px", color: "var(--text)", fontWeight: 600, cursor: "pointer" }}>
              📊 Статистика
            </button>
          </div>
          {showAdd && <GameAddModal profile={profile} space={space} onClose={() => setShowAdd(false)} onAdded={onChanged} />}
          {showStats && <GameStatsModal items={items} onClose={() => setShowStats(false)} />}
        </>
      ) : (
        <div className="addrow">
          <input value={val} placeholder={placeholder} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); }} />
          <button onClick={submit}>+</button>
        </div>
      )}

      <PageBar page={page} totalPages={totalPages} onPageChange={setPage} />

      {sorted.length === 0 && <div className="muted">Пока пусто.</div>}
      {pageItems.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} profile={profile} />)}

      <PageBar page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
