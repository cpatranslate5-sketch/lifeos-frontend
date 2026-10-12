import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Entity, entityCoverUrl, updateEntityField } from "../api";
import { seriesName } from "../series";
import { showToast } from "../toast";

// Кнопка «Случайный фильм / книга / сериал / игра»: крутит барабан
// по тому, что ещё не просмотрено/не прочитано (с учётом включённых фильтров).
const TEXT: Record<string, { btn: string; title: string; verb: string; empty: string }> = {
  movie: { btn: "🎲 Случайный фильм", title: "Сегодня смотрим", verb: "Смотрю", empty: "Все фильмы уже просмотрены" },
  show: { btn: "🎲 Случайный сериал", title: "Сегодня смотрим", verb: "Смотрю", empty: "Все сериалы уже просмотрены" },
  book: { btn: "🎲 Случайная книга", title: "Следующей читаем", verb: "Читаю", empty: "Все книги уже прочитаны" },
  game: { btn: "🎲 Случайная игра", title: "Следующей играем", verb: "Играю", empty: "Все игры уже пройдены" },
};

export function randomButtonLabel(type: string) { return (TEXT[type] || TEXT.movie).btn; }

// Если выпала часть серии — предлагаем первую непройденную часть этой серии
function resolveSeries(e: Entity, all: Entity[]): Entity {
  const s = seriesName(e);
  if (!s) return e;
  const parts = all.filter(x => x.type === e.type && seriesName(x) === s && !x.attributes?.done)
    .sort((a, b) => (Number(a.attributes?.series_order) || 999) - (Number(b.attributes?.series_order) || 999));
  return parts[0] || e;
}

export default function RandomPick({ type, pool, all, onClose, onChanged }: {
  type: string; pool: Entity[]; all: Entity[]; onClose: () => void; onChanged: () => void;
}) {
  const t = TEXT[type] || TEXT.movie;
  const candidates = pool.filter(e => !e.attributes?.done && e.attributes?.status !== "in_progress");
  const [shown, setShown] = useState<Entity | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<number | null>(null);

  function roll() {
    if (!candidates.length) return;
    setRolling(true);
    let i = 0;
    const steps = 16;
    const tick = () => {
      i++;
      const r = candidates[Math.floor(Math.random() * candidates.length)];
      if (i >= steps) { setShown(resolveSeries(r, all)); setRolling(false); return; }
      setShown(r);
      timer.current = window.setTimeout(tick, 50 + i * i * 1.2);
    };
    tick();
  }

  useEffect(() => { roll(); return () => { if (timer.current) clearTimeout(timer.current); }; }, []);

  async function start() {
    if (!shown) return;
    await updateEntityField(shown.id, "status", "in_progress");
    showToast(`«${shown.name}» — во вкладке «Сейчас»`);
    onChanged();
    onClose();
  }

  const a = shown?.attributes || {};
  const s = shown ? seriesName(shown) : null;
  const authors: string[] = Array.isArray(a.author) ? a.author : a.author ? [a.author] : [];

  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal random-modal" onClick={ev => ev.stopPropagation()}>
        <div className="random-title">{t.title}</div>
        {!candidates.length ? (
          <div className="random-empty">🎉 {t.empty}!</div>
        ) : shown && (
          <div className={`random-card ${rolling ? "rolling" : "landed"}`}>
            <div className="random-cover">
              {a.cover_path ? <img src={entityCoverUrl(a.cover_path)} alt="" /> : <span>🎲</span>}
            </div>
            <div className="random-name">{shown.name}</div>
            {!rolling && (
              <div className="random-meta">
                {[a.year, authors.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
                {s && <div className="random-series">Серия: {s}{a.series_order ? ` · часть ${a.series_order}` : ""}</div>}
                {(a.genres || []).length > 0 && <div className="random-genres">{(a.genres as string[]).slice(0, 4).join(" · ")}</div>}
              </div>
            )}
          </div>
        )}
        <div className="random-actions">
          {candidates.length > 0 && <button onClick={start} disabled={rolling || !shown}>▶ {t.verb} сейчас</button>}
          {candidates.length > 1 && <button className="random-again" onClick={roll} disabled={rolling}>🎲 Ещё раз</button>}
          <button className="cancel" onClick={onClose}>Закрыть</button>
        </div>
        {candidates.length > 0 && <div className="random-hint">Выбираю из {candidates.length} — учитываются включённые фильтры</div>}
      </div>
    </div>,
    document.body
  );
}
