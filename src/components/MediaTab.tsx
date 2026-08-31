import { useEffect, useRef, useState } from "react";
import { Entity, createEntity, uploadEntityCover, entityCoverUrl } from "../api";
import EntityCard, { FilterKind } from "./EntityCard";
import { genresFor, authorLabelFor, GEO_OPTIONS } from "../types";
import { showToast } from "../toast";

function yearBucket(y: number): string {
  if (y < 1950) return "1900-1949";
  if (y < 1960) return "1950-1959";
  if (y < 1970) return "1960-1969";
  if (y < 1980) return "1970-1979";
  if (y < 1990) return "1980-1989";
  if (y < 2000) return "1990-1999";
  if (y < 2010) return "2000-2009";
  if (y < 2020) return "2010-2019";
  if (y < 2030) return "2020-2029";
  return "2030-2039";
}

const YEAR_BUCKET_ORDER = ["1900-1949", "1950-1959", "1960-1969", "1970-1979", "1980-1989", "1990-1999", "2000-2009", "2010-2019", "2020-2029", "2030-2039"];

function toRoman(num: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  for (const [val, sym] of map) {
    while (num >= val) { result += sym; num -= val; }
  }
  return result;
}

// Для книг: точные диапазоны для последних ~2 веков, а для всего, что
// раньше 1800 года — по векам римскими цифрами.
const BOOK_YEAR_RANGES: [number, number, string][] = [
  [2030, 2039, "2030-2039"],
  [2020, 2029, "2020-2029"],
  [2010, 2019, "2010-2019"],
  [2000, 2009, "2000-2009"],
  [1990, 1999, "1990-1999"],
  [1980, 1989, "1980-1989"],
  [1970, 1979, "1970-1979"],
  [1960, 1969, "1960-1969"],
  [1950, 1959, "1950-1959"],
  [1940, 1949, "1940-1949"],
  [1930, 1939, "1930-1939"],
  [1920, 1929, "1920-1929"],
  [1910, 1919, "1910-1919"],
  [1900, 1909, "1900-1909"],
  [1850, 1899, "1850-1899"],
  [1800, 1849, "1800-1849"],
];

function bookYearBucket(y: number): string {
  for (const [lo, hi, label] of BOOK_YEAR_RANGES) {
    if (y >= lo && y <= hi) return label;
  }
  if (y < 1800) return `${toRoman(Math.ceil(y / 100))} век`;
  return String(y);
}

const LOOKALIKES: Record<string, string> = {
  a: "а", b: "в", c: "с", e: "е", h: "н", k: "к", m: "м", o: "о", p: "р", t: "т", x: "х", y: "у",
};

function normalizeSearch(s: string): string {
  return s.toLowerCase().split("").map(ch => LOOKALIKES[ch] || ch).join("");
}

interface Props {
  title: string;
  placeholder: string;
  type: "movie" | "show" | "book";
  items: Entity[];
  onChanged: () => void;
  profile: string;
}

const PAGE_SIZE = 25;
const DONE_LABEL: Record<string, [string, string]> = {
  movie: ["Просмотрено", "Непросмотрено"], show: ["Просмотрено", "Непросмотрено"],
  book: ["Прочитано", "Непрочитано"],
};

function starWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "звезда";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "звезды";
  return "звёзд";
}

function sortKey(e: Entity): number {
  if (e.attributes?.done) return 3;
  if (e.attributes?.status === "in_progress") return 0;
  if (e.attributes?.status === "waiting_season") return 1;
  return 2;
}

function toggleInList(list: string[], val: string): string[] {
  return list.includes(val) ? list.filter(x => x !== val) : [...list, val];
}

const STATUS_LABEL: Record<string, string> = {
  movie: "Смотрю сейчас", show: "Смотрю сейчас", book: "Читаю сейчас",
};

function AddModal({ type, profile, onClose, onAdded }: { type: string; profile: string; onClose: () => void; onAdded: () => void }) {
  const [val, setVal] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newGeo, setNewGeo] = useState("");
  const [newGenres, setNewGenres] = useState<string[]>([]);
  const [newActors, setNewActors] = useState("");
  const [newInProgress, setNewInProgress] = useState(false);
  const [newRating, setNewRating] = useState<number | null>(null);
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);
  const newCoverInputRef = useRef<HTMLInputElement>(null);
  const isCast = type === "movie" || type === "show";

  function pickNewCover(file: File | null | undefined) {
    if (!file) return;
    setNewCoverFile(file);
    setNewCoverPreview(URL.createObjectURL(file));
  }

  function handleNewCoverPaste(ev: React.ClipboardEvent) {
    const items = ev.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        ev.preventDefault();
        pickNewCover(items[i].getAsFile());
        return;
      }
    }
  }

  async function submit() {
    if (!val.trim()) return;
    const attrs: Record<string, any> = {};
    if (newAuthor.trim()) attrs.author = newAuthor.split(",").map(s => s.trim()).filter(Boolean);
    if (newGeo) attrs.geo = newGeo;
    if (newGenres.length > 0) attrs.genres = newGenres;
    if (isCast && newActors.trim()) attrs.actors = newActors.split(",").map(s => s.trim()).filter(Boolean);
    if (newInProgress) attrs.status = "in_progress";
    if (newRating) attrs.rating = newRating;
    const created = await createEntity(type, val.trim(), attrs, "life", profile);
    if (newCoverFile) await uploadEntityCover(created.id, newCoverFile);
    showToast("Добавлено");
    onAdded();
    onClose();
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Новая запись</div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
          <div className="cover-thumb" tabIndex={0} onPaste={handleNewCoverPaste} title="Нажмите сюда и вставьте (Ctrl+V) картинку">
            <input ref={newCoverInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(ev) => pickNewCover(ev.target.files?.[0])} />
            {newCoverPreview ? <img src={newCoverPreview} alt="" /> : <span className="cover-placeholder">🖼️</span>}
            <div className="cover-pick-btn" title="Выбрать файл с компьютера"
              onClick={(ev) => { ev.stopPropagation(); newCoverInputRef.current?.click(); }}>📁</div>
          </div>
          <div style={{ flex: 1 }}>
            <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder="Название"
              onKeyDown={e => { if (e.key === "Enter") submit(); }} />
          </div>
        </div>

        <label className="muted">{authorLabelFor(type)}</label>
        <input value={newAuthor} onChange={e => setNewAuthor(e.target.value)} placeholder="Через запятую, если несколько" />

        <label className="muted">Гео</label>
        <select value={newGeo} onChange={e => setNewGeo(e.target.value)}
          style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", padding: 8, marginBottom: 10 }}>
          <option value="">не указано</option>
          {GEO_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        {isCast && (
          <>
            <label className="muted">Актёры</label>
            <input value={newActors} onChange={e => setNewActors(e.target.value)} placeholder="Через запятую" />
          </>
        )}

        <label className="muted">Жанр</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", margin: "4px 0 10px" }}>
          {genresFor(type).map(g => (
            <label key={g} className="genre-chip">
              <input type="checkbox" checked={newGenres.includes(g)} onChange={() => setNewGenres(toggleInList(newGenres, g))} />
              {g}
            </label>
          ))}
        </div>

        <label className="muted">Оценка</label>
        <div className="star-rating" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <span key={n} className={`star ${(newRating || 0) >= n ? "filled" : ""}`}
              onClick={() => setNewRating(newRating === n ? null : n)}>
              {(newRating || 0) >= n ? "★" : "☆"}
            </span>
          ))}
        </div>

        <label className={`status-chip ${newInProgress ? "on" : ""}`} style={{ marginBottom: 14, display: "inline-flex" }}>
          <input type="checkbox" checked={newInProgress} onChange={e => setNewInProgress(e.target.checked)} />
          {STATUS_LABEL[type]}
        </label>

        <div>
          <button onClick={submit}>Добавить</button>
          <button className="cancel" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

function StatsModal({ type, items, onClose }: { type: string; items: Entity[]; onClose: () => void }) {
  const isCast = type === "movie" || type === "show";

  function topCounts(values: string[], n = 5): [string, number][] {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  function authorsOf(e: Entity): string[] {
    const a = e.attributes?.author;
    if (!a) return [];
    return Array.isArray(a) ? a : [a];
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Статистика</div>
        <div className="muted" style={{ marginBottom: 10 }}>По {items.length} {items.length === 1 ? "записи" : "записям"}</div>

        <div style={{ fontWeight: 600, marginBottom: 4 }}>Топ жанров</div>
        {topCounts(items.flatMap(e => e.attributes?.genres || [])).map(([g, n]) => (
          <div key={g} className="field">{g} — {n}</div>
        ))}
        {items.every(e => (e.attributes?.genres || []).length === 0) && <div className="muted" style={{ marginBottom: 8 }}>нет данных</div>}

        <div style={{ fontWeight: 600, margin: "10px 0 4px" }}>Топ {authorLabelFor(type).toLowerCase()}ов</div>
        {topCounts(items.flatMap(e => authorsOf(e))).map(([a, n]) => (
          <div key={a} className="field">{a} — {n}</div>
        ))}
        {items.every(e => authorsOf(e).length === 0) && <div className="muted" style={{ marginBottom: 8 }}>нет данных</div>}

        {isCast && (
          <>
            <div style={{ fontWeight: 600, margin: "10px 0 4px" }}>Топ актёров</div>
            {topCounts(items.flatMap(e => e.attributes?.actors || [])).map(([a, n]) => (
              <div key={a} className="field">{a} — {n}</div>
            ))}
            {items.every(e => (e.attributes?.actors || []).length === 0) && <div className="muted">нет данных</div>}
          </>
        )}

        <div style={{ fontWeight: 600, margin: "10px 0 4px" }}>По гео</div>
        {topCounts(items.map(e => e.attributes?.geo).filter(Boolean)).map(([g, n]) => (
          <div key={g} className="field">{g} — {n}</div>
        ))}
        {items.every(e => !e.attributes?.geo) && <div className="muted">нет данных</div>}

        <button className="cancel" style={{ marginTop: 14 }} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}

export default function MediaTab({ title, placeholder, type, items, onChanged, profile }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [geoFilter, setGeoFilter] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string[]>([]);
  const [authorFilter, setAuthorFilter] = useState<string[]>([]);
  const [actorFilter, setActorFilter] = useState<string[]>([]);
  const [ratingFilter, setRatingFilter] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<"genre" | "geo" | "year" | "author" | "actor" | "rating" | "status" | null>(null);
  const [page, setPage] = useState(1);
  const isCast = type === "movie" || type === "show";
  const isBook = type === "book";
  const [doneLabelDone, doneLabelNotDone] = DONE_LABEL[type] || ["Просмотрено", "Непросмотрено"];

  useEffect(() => { setPage(1); }, [searchTerm, genreFilter, geoFilter, yearFilter, authorFilter, actorFilter, ratingFilter, statusFilter]);

  useEffect(() => {
    if (!openDropdown) return;
    function onKey(ev: KeyboardEvent) { if (ev.key === "Escape") setOpenDropdown(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDropdown]);

  function authorsOf(e: Entity): string[] {
    const a = e.attributes?.author;
    if (!a) return ["Без автора"];
    const list = Array.isArray(a) ? a : [a];
    return list.length > 0 ? list : ["Без автора"];
  }

  function handleFilterByCriterion(kind: FilterKind, value: string) {
    setSearchTerm(""); setGenreFilter([]); setGeoFilter([]); setYearFilter([]); setAuthorFilter([]); setActorFilter([]); setRatingFilter([]); setStatusFilter([]);
    if (kind === "genre") setGenreFilter([value]);
    if (kind === "geo") setGeoFilter([value]);
    if (kind === "year") setYearFilter([value]);
    if (kind === "author") setAuthorFilter([value]);
    if (kind === "actor") setActorFilter([value]);
    setOpenDropdown(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const years = isBook
    ? (() => {
        const bookYears = items.map(e => e.attributes?.year).filter(Boolean).map(Number);
        const explicitPresent = BOOK_YEAR_RANGES.filter(([lo, hi]) => bookYears.some(y => y >= lo && y <= hi)).map(([, , label]) => label);
        const centuriesPresent = Array.from(new Set(bookYears.filter(y => y < 1800).map(y => Math.ceil(y / 100))))
          .sort((a, b) => b - a).map(c => `${toRoman(c)} век`);
        return [...explicitPresent, ...centuriesPresent];
      })()
    : (() => {
        const presentBuckets = new Set(items.map(e => e.attributes?.year).filter(Boolean).map(y => yearBucket(Number(y))));
        return YEAR_BUCKET_ORDER.filter(b => presentBuckets.has(b)).reverse();
      })();

  const authors = Array.from(new Set(items.flatMap(e => authorsOf(e)))).sort();
  const allActors = Array.from(new Set(items.flatMap(e => (e.attributes?.actors || []) as string[]))).sort();

  const filtered = items.filter(e => {
    if (searchTerm && !normalizeSearch(e.name).includes(normalizeSearch(searchTerm))) return false;
    if (genreFilter.length > 0) {
      const g: string[] = e.attributes?.genres || [];
      if (!genreFilter.some(f => g.includes(f))) return false;
    }
    if (geoFilter.length > 0 && !geoFilter.includes(e.attributes?.geo || "")) return false;
    if (yearFilter.length > 0) {
      if (!e.attributes?.year) return false;
      const bucketLabel = isBook ? bookYearBucket(Number(e.attributes.year)) : yearBucket(Number(e.attributes.year));
      if (!yearFilter.includes(bucketLabel)) return false;
    }
    if (authorFilter.length > 0) {
      if (!authorFilter.some(f => authorsOf(e).includes(f))) return false;
    }
    if (actorFilter.length > 0) {
      const cast: string[] = e.attributes?.actors || [];
      if (!actorFilter.some(f => cast.includes(f))) return false;
    }
    if (ratingFilter.length > 0 && !ratingFilter.includes(e.attributes?.rating || 0)) return false;
    if (statusFilter.length > 0) {
      const isDone = !!e.attributes?.done;
      if (!(statusFilter.includes("done") && isDone) && !(statusFilter.includes("not_done") && !isDone)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => sortKey(a) - sortKey(b));
  const anyFilterActive = !!searchTerm || genreFilter.length > 0 || geoFilter.length > 0 || yearFilter.length > 0 || authorFilter.length > 0 || actorFilter.length > 0 || ratingFilter.length > 0 || statusFilter.length > 0;
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const PageBar = () => totalPages > 1 ? (
    <div className="pagination">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
        <div key={n} className={`page-btn ${n === page ? "on" : ""}`} onClick={() => setPage(n)}>{n}</div>
      ))}
    </div>
  ) : null;

  return (
    <div className="view">
      <h1>{title}</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setShowAdd(true)} style={{ background: "var(--project)", border: "none", borderRadius: 9, padding: "9px 16px", color: "#14171F", fontWeight: 600, cursor: "pointer" }}>
          + Добавить
        </button>
        <button onClick={() => setShowStats(true)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 16px", color: "var(--text)", fontWeight: 600, cursor: "pointer" }}>
          📊 Статистика
        </button>
      </div>

      {showAdd && <AddModal type={type} profile={profile} onClose={() => setShowAdd(false)} onAdded={onChanged} />}
      {showStats && <StatsModal type={type} items={items} onClose={() => setShowStats(false)} />}

      <div className="media-filters">
        <input value={searchTerm} placeholder="Поиск по названию…" onChange={e => setSearchTerm(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "7px 12px", color: "var(--text)", fontSize: "0.8rem", minWidth: 160, flex: 1 }} />

        <div style={{ position: "relative" }}>
          <div className={`media-filter-btn ${genreFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "genre" ? null : "genre")}>
            Жанр {genreFilter.length > 0 ? `(${genreFilter.length})` : ""}
          </div>
          {openDropdown === "genre" && (
            <>
              <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
              <div className="media-filter-dropdown">
                {genresFor(type).map(g => (
                  <label key={g} className="media-filter-option">
                    <input type="checkbox" checked={genreFilter.includes(g)} onChange={() => setGenreFilter(toggleInList(genreFilter, g))} />
                    {g}
                  </label>
                ))}
                {genreFilter.length > 0 && <div className="media-filter-clear" onClick={() => setGenreFilter([])}>Сбросить</div>}
              </div>
            </>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <div className={`media-filter-btn ${geoFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "geo" ? null : "geo")}>
            Гео {geoFilter.length > 0 ? `(${geoFilter.length})` : ""}
          </div>
          {openDropdown === "geo" && (
            <>
              <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
              <div className="media-filter-dropdown">
                {GEO_OPTIONS.map(g => (
                  <label key={g} className="media-filter-option">
                    <input type="checkbox" checked={geoFilter.includes(g)} onChange={() => setGeoFilter(toggleInList(geoFilter, g))} />
                    {g}
                  </label>
                ))}
                {geoFilter.length > 0 && <div className="media-filter-clear" onClick={() => setGeoFilter([])}>Сбросить</div>}
              </div>
            </>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <div className={`media-filter-btn ${yearFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "year" ? null : "year")}>
            {isBook ? "Век" : "Год"} {yearFilter.length > 0 ? `(${yearFilter.length})` : ""}
          </div>
          {openDropdown === "year" && (
            <>
              <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
              <div className="media-filter-dropdown">
                {years.length === 0 && <div className="muted" style={{ fontSize: "0.75rem" }}>Пока нет записей.</div>}
                {years.map(y => (
                  <label key={y} className="media-filter-option">
                    <input type="checkbox" checked={yearFilter.includes(y)} onChange={() => setYearFilter(toggleInList(yearFilter, y))} />
                    {y}
                  </label>
                ))}
                {yearFilter.length > 0 && <div className="media-filter-clear" onClick={() => setYearFilter([])}>Сбросить</div>}
              </div>
            </>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <div className={`media-filter-btn ${authorFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "author" ? null : "author")}>
            {authorLabelFor(type)} {authorFilter.length > 0 ? `(${authorFilter.length})` : ""}
          </div>
          {openDropdown === "author" && (
            <>
              <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
              <div className="media-filter-dropdown">
                {authors.length === 0 && <div className="muted" style={{ fontSize: "0.75rem" }}>Пока нет записей.</div>}
                {authors.map(a => (
                  <label key={a} className="media-filter-option">
                    <input type="checkbox" checked={authorFilter.includes(a)} onChange={() => setAuthorFilter(toggleInList(authorFilter, a))} />
                    {a}
                  </label>
                ))}
                {authorFilter.length > 0 && <div className="media-filter-clear" onClick={() => setAuthorFilter([])}>Сбросить</div>}
              </div>
            </>
          )}
        </div>

        {isCast && (
          <div style={{ position: "relative" }}>
            <div className={`media-filter-btn ${actorFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "actor" ? null : "actor")}>
              Актёры {actorFilter.length > 0 ? `(${actorFilter.length})` : ""}
            </div>
            {openDropdown === "actor" && (
              <>
                <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
                <div className="media-filter-dropdown">
                  {allActors.length === 0 && <div className="muted" style={{ fontSize: "0.75rem" }}>Пока нет записей.</div>}
                  {allActors.map(a => (
                    <label key={a} className="media-filter-option">
                      <input type="checkbox" checked={actorFilter.includes(a)} onChange={() => setActorFilter(toggleInList(actorFilter, a))} />
                      {a}
                    </label>
                  ))}
                  {actorFilter.length > 0 && <div className="media-filter-clear" onClick={() => setActorFilter([])}>Сбросить</div>}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ position: "relative" }}>
          <div className={`media-filter-btn ${ratingFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "rating" ? null : "rating")}>
            По оценке {ratingFilter.length > 0 ? `(${ratingFilter.length})` : ""}
          </div>
          {openDropdown === "rating" && (
            <>
              <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
              <div className="media-filter-dropdown" style={{ left: "auto", right: 0 }}>
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
                  <label key={n} className="media-filter-option">
                    <input type="checkbox" checked={ratingFilter.includes(n)} onChange={() => setRatingFilter(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])} />
                    {n} {starWord(n)}
                  </label>
                ))}
                {ratingFilter.length > 0 && <div className="media-filter-clear" onClick={() => setRatingFilter([])}>Сбросить</div>}
              </div>
            </>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <div className={`media-filter-btn ${statusFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}>
            Статус {statusFilter.length > 0 ? `(${statusFilter.length})` : ""}
          </div>
          {openDropdown === "status" && (
            <>
              <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
              <div className="media-filter-dropdown" style={{ left: "auto", right: 0 }}>
                <label className="media-filter-option">
                  <input type="checkbox" checked={statusFilter.includes("done")} onChange={() => setStatusFilter(prev => prev.includes("done") ? prev.filter(x => x !== "done") : [...prev, "done"])} />
                  {doneLabelDone}
                </label>
                <label className="media-filter-option">
                  <input type="checkbox" checked={statusFilter.includes("not_done")} onChange={() => setStatusFilter(prev => prev.includes("not_done") ? prev.filter(x => x !== "not_done") : [...prev, "not_done"])} />
                  {doneLabelNotDone}
                </label>
                {statusFilter.length > 0 && <div className="media-filter-clear" onClick={() => setStatusFilter([])}>Сбросить</div>}
              </div>
            </>
          )}
        </div>

        {anyFilterActive && (
          <div className="media-filter-btn" onClick={() => { setSearchTerm(""); setGenreFilter([]); setGeoFilter([]); setYearFilter([]); setAuthorFilter([]); setActorFilter([]); setRatingFilter([]); setStatusFilter([]); }} style={{ color: "var(--event)" }}>
            Сбросить все
          </div>
        )}
      </div>

      <PageBar />

      {sorted.length === 0 && <div className="muted">{anyFilterActive ? "Ничего не найдено по этим фильтрам." : "Пока пусто."}</div>}
      {pageItems.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} profile={profile} onFilterByCriterion={handleFilterByCriterion} />)}

      <PageBar />
    </div>
  );
}
