import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Entity, entityCoverUrl, updateEntityField } from "../api";
import { todayStr } from "../dateUtils";
import { seriesName, normalizeSearch } from "../series";
import { showToast } from "../toast";

// ============================================================
// «Циклы» — одна вселенная в разных форматах: книги, фильмы,
// сериалы и игры (например, «Оно»: роман, два фильма, сериал).
// Хранится на карточке: universe — название цикла.
// Серия — это части ОДНОГО формата, цикл объединяет РАЗНЫЕ.
// ============================================================

const TYPES: { t: string; label: string; emoji: string; color: string }[] = [
  { t: "book", label: "Книги", emoji: "📚", color: "var(--book)" },
  { t: "movie", label: "Фильмы", emoji: "🎬", color: "var(--movie)" },
  { t: "show", label: "Сериалы", emoji: "📺", color: "var(--show)" },
  { t: "game", label: "Игры", emoji: "🎮", color: "var(--game)" },
];
const META = Object.fromEntries(TYPES.map(x => [x.t, x]));
const DONE_WORD: Record<string, string> = { book: "прочитано", movie: "просмотрено", show: "просмотрено", game: "пройдено" };

const isNow = (e: Entity) => e.attributes?.status === "in_progress" && !e.attributes?.done;
const isWaiting = (e: Entity) => e.attributes?.status === "waiting_season" && !e.attributes?.done;
const NOW_VERB: Record<string, string> = { book: "Читаю", movie: "Смотрю", show: "Смотрю", game: "Играю" };

export const cycleOf = (e: Entity): string | null => (e.attributes?.universe ? String(e.attributes.universe).trim() : null) || null;
const norm = (s: string) => normalizeSearch(s).replace(/[«»"':,.!?—–-]/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => new Set(norm(s).split(" ").filter(w => w.length > 2));
function likeness(name: string, e: Entity): number {
  const w = words(name); let n = 0;
  for (const x of words(e.name + " " + (seriesName(e) || ""))) if (w.has(x)) n++;
  return n;
}

// Карточка + все части её серии (правило: отметил часть серии — берём всю серию)
function withSeries(ids: Set<string>, items: Entity[]): Entity[] {
  const picked = items.filter(e => ids.has(e.id));
  const out = new Map(picked.map(e => [e.id, e]));
  for (const e of picked) {
    const s = seriesName(e);
    if (s) items.filter(x => x.type === e.type && seriesName(x) === s).forEach(x => out.set(x.id, x));
  }
  return [...out.values()];
}

function Picker({ items, cycle, onClose, onDone }: { items: Entity[]; cycle?: string; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(cycle || "");
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const key = (name || "").trim();

  const pool = useMemo(() => {
    let list = items.filter(e => !cycle || cycleOf(e) !== cycle);
    if (typeF) list = list.filter(e => e.type === typeF);
    if (q.trim()) { const nq = norm(q); list = list.filter(e => norm(e.name + " " + (seriesName(e) || "") + " " + ((e.attributes?.author || []) as string[]).join(" ")).includes(nq)); }
    const score = (e: Entity) => (picked.has(e.id) ? 1000 : 0) + (key ? likeness(key, e) * 10 : 0);
    return [...list].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, "ru")).slice(0, 150);
  }, [items, typeF, q, picked, key, cycle]);

  const toggle = (id: string) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const finalList = withSeries(picked, items);
  const extra = finalList.length - picked.size;

  async function save() {
    if (!key || !finalList.length) return;
    setBusy(true);
    try {
      for (const e of finalList) await updateEntityField(e.id, "universe", key);
      showToast(cycle ? `Добавлено в цикл «${key}»: ${finalList.length}` : `Цикл «${key}» создан`);
      onDone(); onClose();
    } catch { showToast("Не сохранилось — попробуй ещё раз"); }
    finally { setBusy(false); }
  }

  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal cy-modal" onClick={ev => ev.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{cycle ? `🌌 Добавить в «${cycle}»` : "🌌 Новый цикл"}</h3>
        {!cycle && <>
          <label className="muted">Название вселенной</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Например: Оно, Ведьмак, Гарри Поттер" autoFocus />
        </>}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по названию, серии или автору…" />
        <div className="cy-types">
          <span className={!typeF ? "on" : ""} onClick={() => setTypeF(null)}>Все</span>
          {TYPES.map(x => <span key={x.t} className={typeF === x.t ? "on" : ""} onClick={() => setTypeF(typeF === x.t ? null : x.t)}>{x.emoji} {x.label}</span>)}
        </div>
        <div className="cy-pool">
          {pool.map(e => {
            const other = cycleOf(e);
            return (
              <label key={e.id} className={`cy-opt ${picked.has(e.id) ? "on" : ""}`}>
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} />
                <span>{META[e.type]?.emoji} {e.name}{e.attributes?.year ? <span className="muted"> · {e.attributes.year}</span> : null}
                  {seriesName(e) && <span className="cy-ser">серия</span>}
                  {other && <span className="muted"> · сейчас в «{other}»</span>}</span>
              </label>
            );
          })}
          {!pool.length && <div className="muted time-small" style={{ padding: 8 }}>Ничего не нашлось</div>}
        </div>
        <div className="muted time-small" style={{ margin: "8px 0 12px" }}>
          Выбрано: {picked.size}{extra > 0 ? ` + ещё ${extra} — остальные части их серий` : ""}
        </div>
        <button onClick={save} disabled={busy || !key || !picked.size}>{busy ? "Сохраняю…" : cycle ? "Добавить" : "Создать цикл"}</button>
        <button className="cancel" onClick={onClose}>Отмена</button>
      </div>
    </div>,
    document.body
  );
}

function CycleCard({ name, members, items, onChanged }: { name: string; members: Entity[]; items: Entity[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const done = members.filter(e => e.attributes?.done).length;
  const now = members.filter(isNow);
  const waiting = members.filter(isWaiting);
  const covers = members.filter(e => e.attributes?.cover_path).slice(0, 4);
  const byType = TYPES.map(x => ({ ...x, list: members.filter(e => e.type === x.t).sort((a, b) => (+a.attributes?.year || 0) - (+b.attributes?.year || 0) || (+a.attributes?.series_order || 0) - (+b.attributes?.series_order || 0)) })).filter(x => x.list.length);

  async function rename(v: string) {
    const nv = v.trim(); setRenaming(false);
    if (!nv || nv === name) return;
    for (const e of members) await updateEntityField(e.id, "universe", nv);
    onChanged();
  }
  async function removeAll() {
    for (const e of members) await updateEntityField(e.id, "universe", null);
    showToast(`Цикл «${name}» распущен — карточки остались на месте`);
    onChanged();
  }
  async function toggleDone(e: Entity) {
    const v = !e.attributes?.done;
    await updateEntityField(e.id, "done", v);
    await updateEntityField(e.id, "done_at", v ? todayStr() : null);
    onChanged();
  }

  return (
    <div className={`cy-card ${now.length ? "active" : waiting.length ? "waiting" : ""}`}>
      <div className="cy-top" onClick={() => setOpen(!open)}>
        <div className={`cy-covers n${covers.length}`}>
          {covers.length ? covers.map(e => <img key={e.id} src={entityCoverUrl(e.attributes!.cover_path)} alt="" />) : <span>🌌</span>}
        </div>
        <div className="cy-info">
          {renaming ? (
            <input className="cy-rename" autoFocus defaultValue={name} onClick={ev => ev.stopPropagation()}
              onBlur={ev => rename(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); if (ev.key === "Escape") setRenaming(false); }} />
          ) : (
            <div className="cy-name">{name} <span className="cy-tag">цикл</span>
              {now.length > 0 && <span className="cy-live">▶ Сейчас</span>}
              {!now.length && waiting.length > 0 && <span className="cy-wait">🔔 Жду сезон</span>}
              <span className="edit-pencil" onClick={ev => { ev.stopPropagation(); setRenaming(true); }} title="Переименовать">✎</span></div>
          )}
          <div className="cy-chips">
            {byType.map(x => <span key={x.t} style={{ ["--accent" as any]: x.color }}>{x.emoji} {x.list.length}</span>)}
          </div>
          <div className="cy-prog">
            <div className="cy-bar"><div style={{ width: `${members.length ? (done / members.length) * 100 : 0}%` }} /></div>
            <span>{done} / {members.length}</span>
          </div>
          {now.length > 0 && <div className="cy-nowline">{now.map(e => <span key={e.id}>{META[e.type]?.emoji} {NOW_VERB[e.type]}: <b>{e.name}</b></span>)}</div>}
        </div>
        <span className="cy-open">{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div className="cy-body">
          {byType.map(x => (
            <div key={x.t} className="cy-group">
              <div className="cy-group-title" style={{ color: x.color }}>{x.emoji} {x.label} <span className="muted">· {DONE_WORD[x.t]} {x.list.filter(e => e.attributes?.done).length} из {x.list.length}</span></div>
              {x.list.map(e => (
                <div key={e.id} className={`cy-row ${e.attributes?.done ? "done" : ""}`}>
                  <input type="checkbox" checked={!!e.attributes?.done} onChange={() => toggleDone(e)} title={DONE_WORD[x.t]} />
                  <span className="cy-row-name">{e.name}{e.attributes?.year ? <span className="muted"> · {e.attributes.year}</span> : null}
                    {seriesName(e) && <span className="cy-ser">{seriesName(e)}{e.attributes?.series_order ? ` · ${e.attributes.series_order}` : ""}</span>}
                    {e.attributes?.status === "in_progress" && !e.attributes?.done && <span className="cy-now">▶ сейчас</span>}</span>
                  {e.attributes?.rating ? <span className="cy-rate">★ {e.attributes.rating}</span> : null}
                  <span className="cy-x" title="Убрать из цикла" onClick={async () => { await updateEntityField(e.id, "universe", null); onChanged(); }}>✕</span>
                </div>
              ))}
            </div>
          ))}
          <div className="cy-actions">
            <button type="button" className="cy-add" onClick={() => setAdding(true)}>＋ Добавить в цикл</button>
            {confirmDel ? (
              <span className="ch-del-confirm">Распустить цикл? Карточки останутся
                <button type="button" onClick={removeAll}>Да</button>
                <button type="button" onClick={() => setConfirmDel(false)}>Нет</button>
              </span>
            ) : <span className="time-link ch-del" onClick={() => setConfirmDel(true)}>Распустить цикл</span>}
          </div>
        </div>
      )}
      {adding && <Picker items={items} cycle={name} onClose={() => setAdding(false)} onDone={onChanged} />}
    </div>
  );
}

export default function CyclesTab({ items, onChanged }: { items: Entity[]; onChanged: () => void; profile?: string }) {
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const cycles = useMemo(() => {
    const m = new Map<string, { name: string; members: Entity[] }>();
    for (const e of items) { const c = cycleOf(e); if (!c) continue; const k = c.toLowerCase(); if (!m.has(k)) m.set(k, { name: c, members: [] }); m.get(k)!.members.push(e); }
    // наверху — циклы, где что-то «сейчас», затем «жду сезон», затем остальные по алфавиту
    const rank = (c: { members: Entity[] }) => c.members.some(isNow) ? 0 : c.members.some(isWaiting) ? 1 : 2;
    return [...m.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "ru"));
  }, [items]);
  const shown = q.trim() ? cycles.filter(c => norm(c.name + " " + c.members.map(e => e.name).join(" ")).includes(norm(q))) : cycles;

  return (
    <div className="view">
      <h1>🌌 Циклы</h1>
      <div className="muted now-summary">Одна вселенная в разных форматах: книги, фильмы, сериалы и игры вместе. Серия — части одного формата, цикл объединяет разные.</div>
      <div className="cy-toolbar">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по циклам…" />
        <button type="button" className="ch-new" onClick={() => setCreating(true)}>＋ Новый цикл</button>
      </div>
      {!cycles.length && <div className="ch-empty muted">Пока нет ни одного цикла. Нажми «Новый цикл», назови вселенную и отметь всё, что к ней относится.</div>}
      {shown.map(c => <CycleCard key={c.name} name={c.name} members={c.members} items={items} onChanged={onChanged} />)}
      {creating && <Picker items={items} onClose={() => setCreating(false)} onDone={onChanged} />}
    </div>
  );
}
