import { useState } from "react";
import { Entity, entityCoverUrl } from "../api";
import { Unit, unitRating, unitStatus } from "../series";
import EntityCard, { FilterKind } from "./EntityCard";
import { useLiteMode } from "../liteMode";

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

// Папка серии: обложка первой части, сколько частей и сколько из них пройдено,
// средняя оценка. По нажатию раскрывается список частей (обычные карточки).
export default function SeriesFolder({ unit, onChanged, profile, onFilterByCriterion }: {
  unit: Extract<Unit, { kind: "series" }>; onChanged: () => void; profile?: string;
  onFilterByCriterion?: (kind: FilterKind, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const liteMode = useLiteMode();
  const m = unit.members;
  const type = m[0].type;
  const done = m.filter(e => e.attributes?.done).length;
  const rating = unitRating(unit);
  const rated = m.filter(e => Number(e.attributes?.rating) > 0).length;
  const status = unitStatus(unit);
  const cover = m.find(e => e.attributes?.cover_path)?.attributes.cover_path as string | undefined;
  const years = m.map(e => Number(e.attributes?.year)).filter(Boolean);
  const span = years.length ? (Math.min(...years) === Math.max(...years) ? `${Math.min(...years)}` : `${Math.min(...years)}–${Math.max(...years)}`) : "";

  return (
    <div className={`card series-folder ${open ? "open" : ""}`}>
      <button type="button" className="series-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="cover-thumb series-cover">
          {cover && !liteMode ? <img src={entityCoverUrl(cover)} alt="" /> : <span className="cover-placeholder">🗂️</span>}
          <span className="series-count">{m.length}</span>
        </span>
        <span className="series-info">
          <span className="series-title">{unit.name}</span>
          <span className="muted series-meta">{m.length} {plural(m.length, WORD[type])}{span ? ` · ${span}` : ""}</span>
          <span className="series-progress"><span style={{ width: `${(done / m.length) * 100}%` }} /></span>
          <span className="series-meta">
            {DONE[type]} {done} из {m.length}
            {status === "in_progress" && done < m.length ? " · в процессе" : ""}
            {status === "done" ? " ✓" : ""}
          </span>
        </span>
        <span className="series-rating" title={rating ? `Средняя по ${rated} оценённым частям` : "Пока нет оценок"}>
          {rating ? <>★ {rating.toFixed(1).replace(".", ",")}<small>средняя</small></> : <small>без оценок</small>}
        </span>
        <span className="series-chevron" aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
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
