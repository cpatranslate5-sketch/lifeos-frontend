import { useState } from "react";
import { Entity, entityCoverUrl } from "../api";
import { Unit, unitRating, unitStatus } from "../series";
import EntityCard, { FilterKind } from "./EntityCard";
import { useLiteMode } from "../liteMode";
import { authorLabelFor } from "../types";

const WORD: Record<string, [string, string, string]> = {
  movie: ["фильм", "фильма", "фильмов"], show: ["сериал", "сериала", "сериалов"],
  book: ["книга", "книги", "книг"], game: ["игра", "игры", "игр"],
};
function plural(n: number, [one, few, many]: [string, string, string]) {
  const a = n % 100, b = n % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b > 1 && b < 5) return few;
  return many;
}
const DONE: Record<string, string> = { movie: "просмотрено", show: "просмотрено", book: "прочитано", game: "пройдено" };

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
/** Уникальные значения по всем частям, самые частые — первыми. */
function common(members: Entity[], key: string, max = 3): string[] {
  const cnt = new Map<string, number>();
  for (const e of members) for (const v of new Set(asList(e.attributes?.[key]))) cnt.set(v, (cnt.get(v) || 0) + 1);
  return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([v]) => v);
}

// Папка серии. Снаружи выглядит как обычная карточка (та же обложка, заголовок,
// поля, звёзды снизу), только обложка «стопкой» и звёзды — средняя по частям.
// По нажатию раскрывается список частей (обычные карточки).
export default function SeriesFolder({ unit, onChanged, profile, onFilterByCriterion }: {
  unit: Extract<Unit, { kind: "series" }>; onChanged: () => void; profile?: string;
  onFilterByCriterion?: (kind: FilterKind, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const liteMode = useLiteMode();
  const m = unit.members;
  const type = m[0].type;
  const done = m.filter(e => e.attributes?.done).length;
  const allDone = done === m.length;
  const rating = unitRating(unit);
  const rated = m.filter(e => Number(e.attributes?.rating) > 0).length;
  const status = unitStatus(unit);
  const cover = m.find(e => e.attributes?.cover_path)?.attributes.cover_path as string | undefined;
  const years = m.map(e => Number(e.attributes?.year)).filter(Boolean);
  const span = years.length ? (Math.min(...years) === Math.max(...years) ? `${Math.min(...years)}` : `${Math.min(...years)}–${Math.max(...years)}`) : "";
  const isGame = type === "game";
  const creators = common(m, isGame ? "developer" : "author");
  const genres = common(m, "genres");
  const toggle = () => setOpen(!open);

  return (
    <div className={`series-folder ${open ? "open" : ""}`}>
      <div className="card card-with-cover series-card" onClick={toggle} role="button" tabIndex={0}
        aria-expanded={open} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } }}>
        <div className="cover-thumb series-cover">
          {cover && !liteMode ? <img src={entityCoverUrl(cover)} alt="" /> : <span className="cover-placeholder">🗂️</span>}
          <span className="series-count">{m.length}</span>
        </div>
        <div className="check-column">
          <input type="checkbox" className="done-check" checked={allDone} readOnly tabIndex={-1}
            title={allDone ? "Вся серия пройдена" : "Отмечается сама, когда пройдены все части"}
            style={{ pointerEvents: "none" }} />
        </div>
        <div className="card-body card-body-flex">
          <div className="card-top card-top-title">
            <div className="card-title-text series-title-text"
              style={allDone ? { textDecoration: "line-through", textDecorationColor: "var(--event)", textDecorationThickness: 2, color: "var(--event)" } : {}}>
              {unit.name} <span className="series-tag">серия</span>
            </div>
          </div>
          <div className="card-middle layout-media series-middle">
            <div className="media-criteria">
            <div className="field"><strong>Части:</strong> {m.length} {plural(m.length, WORD[type])}{span ? ` · ${span}` : ""}</div>
            <div className="field series-progress-field">
              <strong>Прогресс:</strong> {DONE[type]} {done} из {m.length}
              {status === "in_progress" && !allDone ? " · в процессе" : ""}
              <span className="series-progress"><span style={{ width: `${(done / m.length) * 100}%` }} /></span>
            </div>
            {creators.length > 0 && (
              <div className="field"><strong>{isGame ? "Разработчик" : authorLabelFor(type)}:</strong> {creators.join(", ")}</div>
            )}
            {genres.length > 0 && <div className="field"><strong>Жанр:</strong> {genres.join(", ")}</div>}
            <div className="field"><strong>Оценка:</strong>{" "}
              {rating ? <>{rating.toFixed(1).replace(".", ",")} — средняя по {rated} из {m.length}</> : "пока нет"}
            </div>
            </div>
          </div>
          <div className="card-bottom">
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div className="why series-open-btn">{open ? "Свернуть ▾" : `Открыть ${m.length} ${plural(m.length, WORD[type])} ▸`}</div>
              <div className="star-rating series-stars" style={{ marginBottom: 0, marginLeft: "auto" }}
                title={rating ? `Средняя по ${rated} из ${m.length} оценённым частям` : "Пока нет оценок"}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <span key={n} className={`star ${(rating || 0) >= n - 0.25 ? "filled" : ""}`}>
                    {(rating || 0) >= n - 0.25 ? "★" : "☆"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {open && (
        <div className="series-members">
          {m.map((e: Entity, i) => (
            <div key={e.id} className="series-member">
              <span className="series-num">{Number(e.attributes?.series_order) > 0 ? e.attributes.series_order : i + 1}</span>
              <div className="series-member-card">
                <EntityCard e={e} onChanged={onChanged} profile={profile} onFilterByCriterion={onFilterByCriterion} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
