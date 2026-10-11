import { useState } from "react";
import { Entity, updateEntityField } from "../api";
import { seasonInfo } from "../mediaTime";

// Сезоны сериала: сколько вышло, сколько просмотрено, сколько будет всего.
// Нужно для расчёта времени: просмотренное вычитается, будущие сезоны добавляются.
export default function SeasonsField({ e, onChanged }: { e: Entity; onChanged: () => void }) {
  const s = seasonInfo(e);
  const [editing, setEditing] = useState(false);
  const [released, setReleased] = useState("");
  const [watched, setWatched] = useState("");
  const [total, setTotal] = useState("");
  const [ongoing, setOngoing] = useState(false);
  const [saving, setSaving] = useState(false);

  function open() {
    setReleased(s.released ? String(s.released) : "");
    setWatched(s.watched ? String(s.watched) : "");
    setTotal(s.total ? String(s.total) : "");
    setOngoing(!!e.attributes?.show_ongoing);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const num = (v: string) => { const n = parseInt(v, 10); return n > 0 ? n : null; };
    const next: Record<string, any> = {
      seasons_released: num(released), seasons_watched: num(watched), seasons_total: num(total), show_ongoing: ongoing,
    };
    try {
      for (const [k, v] of Object.entries(next)) {
        const cur = e.attributes?.[k] ?? null;
        if ((cur || null) !== (v || null)) await updateEntityField(e.id, k, v);
      }
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="field media-criterion seasons-edit" onClick={ev => ev.stopPropagation()}>
        <strong>Сезоны:</strong>
        <div className="seasons-grid">
          <label>вышло<input inputMode="numeric" value={released} onChange={ev => setReleased(ev.target.value.replace(/\D/g, ""))} placeholder="—" /></label>
          <label>просмотрено<input inputMode="numeric" value={watched} onChange={ev => setWatched(ev.target.value.replace(/\D/g, ""))} placeholder="0" /></label>
          <label>всего будет<input inputMode="numeric" value={total} onChange={ev => setTotal(ev.target.value.replace(/\D/g, ""))} placeholder="?" /></label>
        </div>
        <label className="seasons-ongoing"><input type="checkbox" checked={ongoing} onChange={ev => setOngoing(ev.target.checked)} /> ещё выходит</label>
        <div className="seasons-actions">
          <button type="button" disabled={saving} onClick={save}>{saving ? "Сохраняю…" : "Сохранить"}</button>
          <span className="muted" style={{ cursor: "pointer" }} onClick={() => setEditing(false)}>Отмена</span>
        </div>
      </div>
    );
  }

  const parts: string[] = [];
  if (s.released) parts.push(`вышло ${s.released}`);
  if (s.watched) parts.push(`просмотрено ${s.watched}`);
  if (s.total) parts.push(`всего будет ${s.total}`);
  else if (s.ongoing) parts.push("ещё выходит");

  return (
    <div className="field media-criterion" onClick={open}>
      <strong>Сезоны:</strong> {parts.length ? parts.join(" · ") : "не указано"}
      <span className="edit-pencil" onClick={ev => { ev.stopPropagation(); open(); }} title="Изменить">✎</span>
    </div>
  );
}
