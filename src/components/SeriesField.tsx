import { useMemo, useState } from "react";
import { Entity, updateEntityField } from "../api";
import { seriesName } from "../series";
import {
  useSeriesCatalog, seriesOfType, similarity, matches, addToSeries, removeFromSeries, suggestSeriesName,
} from "../seriesActions";

// Поле «Серия» на карточке. По нажатию открывается выбор:
//  • существующие серии (похожие по названию — сверху), один клик — и карточка в серии;
//  • «объединить с…» — другая карточка без серии, вместе они образуют новую серию;
//  • своя новая серия по введённому названию.
// Ручная правка помечается как manual, автосборка её больше не трогает.
export default function SeriesField({ e, onChanged }: { e: Entity; onChanged: () => void }) {
  const catalog = useSeriesCatalog();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const cur = seriesName(e) || "";
  const curOrder = Number(e.attributes?.series_order) || 0;

  const all = useMemo(() => seriesOfType(catalog, e.type), [catalog, e.type]);
  const mine = all.find(s => s.name.toLowerCase() === cur.toLowerCase());
  const curMembers = mine ? mine.members : [e];

  const seriesHits = useMemo(() => {
    const list = all.filter(s => s.name.toLowerCase() !== cur.toLowerCase());
    if (q.trim()) return list.filter(s => matches(s.name, q)).slice(0, 8);
    return list
      .map(s => ({ s, score: similarity(e.name, s.name) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => x.s);
  }, [all, q, cur, e.name]);

  const cardHits = useMemo(() => {
    const singles = catalog.filter(x => x.type === e.type && x.id !== e.id && !seriesName(x));
    if (q.trim().length >= 2) return singles.filter(x => matches(x.name, q)).slice(0, 6);
    return singles
      .map(x => ({ x, score: similarity(e.name, x.name) }))
      .filter(v => v.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(v => v.x);
  }, [catalog, q, e.id, e.name, e.type]);

  const exact = all.some(s => s.name.toLowerCase() === q.trim().toLowerCase());

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); setOpen(false); setQ(""); onChanged(); } finally { setBusy(false); }
  }
  const joinSeries = (name: string, members: Entity[]) => run(async () => {
    if (mine && cur) await removeFromSeries(e, curMembers);
    await addToSeries(name, members, [e]);
  });
  const joinCard = (other: Entity) => run(async () => {
    if (mine && cur) {
      // карточка уже в серии — добавляем найденную к ней
      await addToSeries(cur, curMembers, [other]);
    } else {
      await addToSeries(q.trim() || suggestSeriesName(e, other), [], [e, other]);
    }
  });
  const createNew = () => run(async () => {
    if (mine && cur) await removeFromSeries(e, curMembers);
    await addToSeries(q.trim(), [], [e]);
  });
  const leave = () => run(() => removeFromSeries(e, curMembers));
  async function setOrder(v: string) {
    const o = parseFloat(v.replace(",", ".")) || 0;
    if (o === curOrder) return;
    await updateEntityField(e.id, "series_order", o || null);
    await updateEntityField(e.id, "series_source", "manual");
    onChanged();
  }

  const word = e.type === "book" ? "книгу" : e.type === "game" ? "игру" : e.type === "show" ? "сериал" : "фильм";

  if (!open) {
    return (
      <div className="field media-criterion" onClick={() => setOpen(true)}>
        <strong>Серия:</strong> {cur ? <>{cur}{curOrder ? ` · часть ${curOrder}` : ""}</> : <span className="series-add-link">добавить в серию</span>}
        <span className="edit-pencil" onClick={ev => { ev.stopPropagation(); setOpen(true); }} title="Изменить">✎</span>
      </div>
    );
  }

  return (
    <div className="field media-criterion series-picker" onClick={ev => ev.stopPropagation()}>
      <div className="series-picker-head">
        <strong>Серия</strong>
        <button type="button" className="series-picker-close" onClick={() => { setOpen(false); setQ(""); }} aria-label="Закрыть">✕</button>
      </div>

      {cur && (
        <div className="series-picker-current">
          <span>Сейчас: <b>{cur}</b> · часть</span>
          <input className="series-order-input" defaultValue={curOrder || ""} inputMode="decimal"
            onBlur={ev => setOrder(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
          <button type="button" className="series-chip danger" disabled={busy} onClick={leave}>Убрать из серии</button>
        </div>
      )}

      <input className="series-picker-search" autoFocus value={q} onChange={ev => setQ(ev.target.value)}
        placeholder={cur ? `Найти ${word}, чтобы добавить в эту серию…` : "Название серии или другой части…"}
        onKeyDown={ev => { if (ev.key === "Escape") { setOpen(false); setQ(""); } }} />

      {seriesHits.length > 0 && (
        <div className="series-picker-group">
          <div className="series-picker-label">{q.trim() ? "Серии" : "Похожие серии"}</div>
          {seriesHits.map(s => (
            <button key={s.name} type="button" className="series-option" disabled={busy} onClick={() => joinSeries(s.name, s.members)}>
              <span className="series-option-name">🗂 {s.name}</span>
              <span className="muted">{s.members.length} шт. · добавить сюда</span>
            </button>
          ))}
        </div>
      )}

      {cardHits.length > 0 && (
        <div className="series-picker-group">
          <div className="series-picker-label">{cur ? "Добавить в эту серию" : "Объединить в серию с…"}</div>
          {cardHits.map(x => (
            <button key={x.id} type="button" className="series-option" disabled={busy} onClick={() => joinCard(x)}>
              <span className="series-option-name">{x.name}</span>
              <span className="muted">{x.attributes?.year || ""}</span>
            </button>
          ))}
        </div>
      )}

      {q.trim() && !exact && !cur && (
        <button type="button" className="series-option series-option-new" disabled={busy} onClick={createNew}>
          ＋ Новая серия «{q.trim()}»
        </button>
      )}

      {!q.trim() && seriesHits.length === 0 && cardHits.length === 0 && (
        <div className="muted series-picker-hint">Начни вводить название — покажу подходящие серии и карточки.</div>
      )}
      {busy && <div className="muted series-picker-hint">Сохраняю…</div>}
    </div>
  );
}
