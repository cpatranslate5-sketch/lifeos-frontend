import { useState } from "react";
import { Entity, updateEntityField } from "../api";
import { fmtMinutes, itemMinutes, cachedPagesPerHour } from "../mediaTime";

// Поле длительности на карточке фильма/сериала/книги/игры.
// Фильм — в минутах, сериал и игра — в часах, книга — в страницах.
const UNIT: Record<string, { label: string; unit: string; placeholder: string; toStored: (v: number) => number; fromStored: (a: Record<string, any>) => number | null }> = {
  movie: { label: "Длительность", unit: "мин", placeholder: "напр. 120", toStored: v => Math.round(v), fromStored: a => a.duration_min ?? null },
  show: { label: "Все серии", unit: "ч", placeholder: "напр. 40", toStored: v => Math.round(v * 60), fromStored: a => a.duration_min ? Math.round((a.duration_min / 60) * 10) / 10 : null },
  game: { label: "Прохождение", unit: "ч", placeholder: "напр. 35", toStored: v => Math.round(v * 60), fromStored: a => a.duration_min ? Math.round((a.duration_min / 60) * 10) / 10 : null },
  book: { label: "Объём", unit: "стр", placeholder: "напр. 320", toStored: v => Math.round(v), fromStored: a => a.pages ?? null },
};

export default function DurationField({ e, onChanged }: { e: Entity; onChanged: () => void }) {
  const pagesPerHour = cachedPagesPerHour();
  const [editing, setEditing] = useState(false);
  const cfg = UNIT[e.type];
  if (!cfg) return null;
  const a = e.attributes || {};
  const stored = cfg.fromStored(a);
  const minutes = itemMinutes(e, pagesPerHour);
  const approx = a.duration_source === "ai" ? "≈ " : "";

  async function save(raw: string) {
    setEditing(false);
    const v = parseFloat(raw.replace(",", "."));
    const key = e.type === "book" ? "pages" : "duration_min";
    if (!raw.trim()) {
      if (stored === null) return;
      await updateEntityField(e.id, key, null);
    } else {
      if (!(v > 0) || cfg.toStored(v) === (e.type === "book" ? a.pages : a.duration_min)) return;
      await updateEntityField(e.id, key, cfg.toStored(v));
    }
    await updateEntityField(e.id, "duration_source", "manual");
    onChanged();
  }

  return (
    <div className="field media-criterion" onClick={() => !editing && setEditing(true)}>
      <strong>{cfg.label}:</strong>{" "}
      {editing ? (
        <span className="duration-edit" onClick={ev => ev.stopPropagation()}>
          <input autoFocus type="text" inputMode="decimal" defaultValue={stored ?? ""} placeholder={cfg.placeholder}
            onBlur={ev => save(ev.target.value)}
            onKeyDown={ev => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); if (ev.key === "Escape") setEditing(false); }} />
          <span className="muted">{cfg.unit}</span>
        </span>
      ) : stored !== null ? (
        <>
          <span title={approx ? "Оценка Claude — нажмите, чтобы поправить" : undefined}>
            {approx}{e.type === "book" ? `${stored} стр` : fmtMinutes(a.duration_min)}
          </span>
          {e.type === "book" && minutes !== null && <span className="muted"> · {approx}{fmtMinutes(minutes)} чтения</span>}
        </>
      ) : "не указано"}
      {!editing && <span className="edit-pencil" onClick={ev => { ev.stopPropagation(); setEditing(true); }} title="Изменить">✎</span>}
    </div>
  );
}
