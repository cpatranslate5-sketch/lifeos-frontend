import { useState } from "react";
import { Entity, renameEntity, bulkDeleteEntities } from "../api";
import { TYPES } from "../types";

export default function Manage({ entities, onChanged }: { entities: Entity[]; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = entities.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && e.type !== typeFilter) return false;
    return true;
  });

  const types = Array.from(new Set(entities.map(e => e.type))).sort();

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveRename(id: string, newName: string) {
    const v = newName.trim();
    if (v) await renameEntity(id, v);
    setEditingId(null);
    onChanged();
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Удалить выбранные карточки (${selected.size} шт.) насовсем? Это нельзя отменить.`)) return;
    await bulkDeleteEntities([...selected]);
    setSelected(new Set());
    onChanged();
  }

  return (
    <div className="view">
      <h1>Управление</h1>

      <div className="addrow" style={{ marginBottom: 10 }}>
        <input value={search} placeholder="Поиск по названию…" onChange={e => setSearch(e.target.value)} style={{ flex: 2 }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "0 10px", color: "var(--text)", fontSize: "0.82rem" }}>
          <option value="">Все типы</option>
          {types.map(t => <option key={t} value={t}>{TYPES[t]?.label || t}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="why" style={{ color: "var(--event)", marginBottom: 10, display: "inline-block" }} onClick={deleteSelected}>
          Удалить выбранные ({selected.size})
        </div>
      )}

      <div className="muted" style={{ marginBottom: 10, fontSize: "0.75rem" }}>Найдено: {filtered.length}</div>

      {filtered.map(e => (
        <div key={e.id} className="card" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} />
          <div className="muted" style={{ fontSize: "0.7rem", minWidth: 70 }}>{TYPES[e.type]?.label || e.type}</div>
          {editingId === e.id ? (
            <input autoFocus defaultValue={e.name} style={{ flex: 1 }}
              onBlur={(ev) => saveRename(e.id, ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); if (ev.key === "Escape") setEditingId(null); }} />
          ) : (
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setEditingId(e.id)}>{e.name}</div>
          )}
          <div className="edit-link" onClick={() => setEditingId(e.id)}>Редактировать</div>
        </div>
      ))}
    </div>
  );
}
