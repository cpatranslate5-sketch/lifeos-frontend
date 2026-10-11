import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Entity } from "../api";
import { seriesName } from "../series";
import { useSeriesCatalog, seriesOfType, similarity, matches, putIntoSeries, baseTitle } from "../seriesActions";
import { showToast } from "../toast";

const WORDS: Record<string, string> = { movie: "фильмы", show: "сериалы", book: "книги", game: "игры" };

// Окно работы с сериями.
//  mode="add"    — одна карточка: выбрать серию из списка или создать новую.
//  mode="create" — новая серия: ввести название и отметить, что в неё войдёт.
export default function SeriesModal({ mode, type, card, onClose, onDone }: {
  mode: "add" | "create"; type: string; card?: Entity; onClose: () => void; onDone: () => void;
}) {
  const catalog = useSeriesCatalog();
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState(card ? baseTitle(card.name) : "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const cur = card ? seriesName(card) : null;

  const series = useMemo(() => {
    const list = seriesOfType(catalog, type).filter(s => !cur || s.name.toLowerCase() !== cur.toLowerCase());
    const filtered = q.trim() ? list.filter(s => matches(s.name, q)) : list;
    return filtered
      .map(s => ({ s, score: card ? similarity(card.name, s.name) : 0 }))
      .sort((a, b) => (b.score - a.score) || a.s.name.localeCompare(b.s.name, "ru"))
      .map(x => x.s);
  }, [catalog, type, q, card, cur]);

  const pool = useMemo(() => {
    const list = catalog.filter(x => x.type === type);
    const filtered = q.trim() ? list.filter(x => matches(x.name, q)) : list;
    // отмеченные — наверху, дальше без серии, потом остальные
    return [...filtered].sort((a, b) =>
      (Number(picked.has(b.id)) - Number(picked.has(a.id))) ||
      (Number(!!seriesName(a)) - Number(!!seriesName(b))) ||
      a.name.localeCompare(b.name, "ru"));
  }, [catalog, type, q, picked]);

  async function save(name: string, cards: Entity[]) {
    if (!name.trim() || !cards.length) return;
    setBusy(true);
    try {
      await putIntoSeries(name, cards, catalog);
      showToast?.(`Серия «${name.trim()}»: готово`);
      onDone();
      onClose();
    } finally { setBusy(false); }
  }

  const toggle = (id: string) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const existing = seriesOfType(catalog, type).find(s => s.name.toLowerCase() === newName.trim().toLowerCase());

  const body = mode === "add" && card ? (
    <>
      <div className="series-modal-title">Добавить в серию</div>
      <div className="muted series-modal-sub">«{card.name}»{cur ? ` · сейчас в «${cur}»` : ""}</div>

      <div className="series-modal-label">Новая серия</div>
      <div className="series-modal-row">
        <input value={newName} onChange={ev => setNewName(ev.target.value)} placeholder="Название серии"
          onKeyDown={ev => { if (ev.key === "Enter") save(newName, [card]); }} />
        <button type="button" className="series-modal-primary" disabled={busy || !newName.trim()} onClick={() => save(newName, [card])}>
          {existing ? "Добавить" : "Создать"}
        </button>
      </div>
      {existing && <div className="muted series-modal-hint">Такая серия уже есть — карточка добавится в неё.</div>}

      <div className="series-modal-label">Или выбери из существующих</div>
      <input value={q} onChange={ev => setQ(ev.target.value)} placeholder="Поиск по сериям…" />
      <div className="series-modal-list">
        {series.length === 0 && <div className="muted series-modal-hint">{q.trim() ? "Ничего не нашлось" : "Серий пока нет"}</div>}
        {series.map(s => (
          <button key={s.name} type="button" className="series-option" disabled={busy} onClick={() => save(s.name, [card])}>
            <span className="series-option-name">🗂 {s.name}</span>
            <span className="muted">{s.members.length} шт.</span>
          </button>
        ))}
      </div>
    </>
  ) : (
    <>
      <div className="series-modal-title">Создать серию</div>
      <div className="series-modal-label">Название</div>
      <input autoFocus value={newName} onChange={ev => setNewName(ev.target.value)} placeholder="Например, Гарри Поттер" />
      {existing && <div className="muted series-modal-hint">Такая серия уже есть ({existing.members.length} шт.) — отмеченное добавится в неё.</div>}

      <div className="series-modal-label">Что войдёт · отмечено {picked.size}</div>
      <input value={q} onChange={ev => setQ(ev.target.value)} placeholder={`Поиск: ${WORDS[type] || "карточки"}…`} />
      <div className="series-modal-list series-modal-checks">
        {pool.length === 0 && <div className="muted series-modal-hint">Ничего не нашлось</div>}
        {pool.slice(0, 200).map(x => (
          <label key={x.id} className={`series-check ${picked.has(x.id) ? "on" : ""}`}>
            <input type="checkbox" checked={picked.has(x.id)} onChange={() => toggle(x.id)} />
            <span className="series-option-name">{x.name}</span>
            <span className="muted">{[x.attributes?.year, seriesName(x) ? `в «${seriesName(x)}»` : ""].filter(Boolean).join(" · ")}</span>
          </label>
        ))}
        {pool.length > 200 && <div className="muted series-modal-hint">Показаны первые 200 — уточни поиск.</div>}
      </div>
      <div className="series-modal-actions">
        <button type="button" className="series-modal-primary" disabled={busy || !newName.trim() || picked.size === 0}
          onClick={() => save(newName, catalog.filter(x => picked.has(x.id)))}>
          {busy ? "Сохраняю…" : existing ? `Добавить в серию (${picked.size})` : `Создать серию (${picked.size})`}
        </button>
        <button type="button" className="cancel" onClick={onClose}>Отмена</button>
      </div>
    </>
  );

  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal series-modal" onClick={ev => ev.stopPropagation()}>
        <button type="button" className="series-modal-close" onClick={onClose} aria-label="Закрыть">✕</button>
        {body}
      </div>
    </div>,
    document.body
  );
}
