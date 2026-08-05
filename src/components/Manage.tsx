import { useState } from "react";
import { Entity, bulkDeleteEntities } from "../api";
import { TYPES } from "../types";

export default function Manage({ entities, onChanged }: { entities: Entity[]; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = entities.filter(e => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (query && !e.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(e => e.id)));
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Удалить ${selected.size} записей насовсем? Это нельзя отменить.`)) return;
    await bulkDeleteEntities([...selected]);
    setSelected(new Set());
    onChanged();
  }

  const typesPresent = [...new Set(entities.map(e => e.type))];

  return (
    <div className="view">
      <h1>Управление</h1>
      <div className="muted" style={{ marginBottom: 10 }}>Список всех записей текущего пространства — найдите нужные и удалите разом.</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по названию…"
          style={{ flex: 1, minWidth: 140, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: "0.85rem" }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: "0.85rem" }}>
          <option value="">Все типы</option>
          {typesPresent.map(t => <option key={t} value={t}>{TYPES[t]?.label || t}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="why" onClick={toggleAll}>{selected.size === filtered.length && filtered.length > 0 ? "снять выделение" : "выбрать всё видимое"}</div>
        <button onClick={deleteSelected} disabled={selected.size === 0}
          style={{ background: selected.size ? "var(--event)" : "var(--line)", border: "none", borderRadius: 8, padding: "8px 14px", color: "#14171F", fontWeight: 600, cursor: selected.size ? "pointer" : "default" }}>
          Удалить выбранное ({selected.size})
        </button>
      </div>

      {filtered.length === 0 && <div className="muted">Ничего не найдено.</div>}
      {filtered.map(e => (
        <div key={e.id} className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="done-check" />
          <div className="type-badge" style={{ background: TYPES[e.type]?.color || "var(--muted)" }}>{e.attributes?.emoji || TYPES[e.type]?.emoji || "•"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{e.name}</div>
            <div className="muted" style={{ fontSize: "0.7rem" }}>{TYPES[e.type]?.label || e.type}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
