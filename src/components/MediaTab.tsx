import { useEffect, useState } from "react";
import { Entity, createEntity } from "../api";
import EntityCard from "./EntityCard";
import { genresFor, authorLabelFor, GEO_OPTIONS } from "../types";

interface Props {
  title: string;
  placeholder: string;
  type: "movie" | "show" | "book";
  items: Entity[];
  onChanged: () => void;
  profile: string;
}

function sortKey(e: Entity): number {
  if (e.attributes?.done) return 2;
  if (e.attributes?.status === "in_progress") return 0;
  return 1;
}

function toggleInList(list: string[], val: string): string[] {
  return list.includes(val) ? list.filter(x => x !== val) : [...list, val];
}

export default function MediaTab({ title, placeholder, type, items, onChanged, profile }: Props) {
  const [val, setVal] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newGeo, setNewGeo] = useState("");
  const [newGenres, setNewGenres] = useState<string[]>([]);
  const [newActors, setNewActors] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [geoFilter, setGeoFilter] = useState<string[]>([]);
  const [authorFilter, setAuthorFilter] = useState<string[]>([]);
  const [actorFilter, setActorFilter] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<"genre" | "geo" | "author" | "actor" | null>(null);
  const isCast = type === "movie" || type === "show";

  useEffect(() => {
    if (!openDropdown) return;
    function onKey(ev: KeyboardEvent) { if (ev.key === "Escape") setOpenDropdown(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDropdown]);

  async function submit() {
    if (!val.trim()) return;
    const attrs: Record<string, any> = {};
    if (newAuthor.trim()) attrs.author = newAuthor.trim();
    if (newGeo) attrs.geo = newGeo;
    if (newGenres.length > 0) attrs.genres = newGenres;
    if (isCast && newActors.trim()) attrs.actors = newActors.split(",").map(s => s.trim()).filter(Boolean);
    await createEntity(type, val.trim(), attrs, "life", profile);
    setVal(""); setNewAuthor(""); setNewGeo(""); setNewGenres([]); setNewActors(""); setShowDetails(false);
    onChanged();
  }

  const authors = Array.from(new Set(items.map(e => e.attributes?.author || "Без автора"))).sort();
  const allActors = Array.from(new Set(items.flatMap(e => (e.attributes?.actors || []) as string[]))).sort();

  const filtered = items.filter(e => {
    if (searchTerm && !e.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (genreFilter.length > 0) {
      const g: string[] = e.attributes?.genres || [];
      if (!genreFilter.some(f => g.includes(f))) return false;
    }
    if (geoFilter.length > 0 && !geoFilter.includes(e.attributes?.geo || "")) return false;
    if (authorFilter.length > 0) {
      const a = e.attributes?.author || "Без автора";
      if (!authorFilter.includes(a)) return false;
    }
    if (actorFilter.length > 0) {
      const cast: string[] = e.attributes?.actors || [];
      if (!actorFilter.some(f => cast.includes(f))) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => sortKey(a) - sortKey(b));
  const anyFilterActive = !!searchTerm || genreFilter.length > 0 || geoFilter.length > 0 || authorFilter.length > 0 || actorFilter.length > 0;

  return (
    <div className="view">
      <h1>{title}</h1>
      <div className="addrow" style={{ marginBottom: 4 }}>
        <input value={val} placeholder={placeholder} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !showDetails) submit(); }} />
        <button onClick={submit}>+</button>
      </div>
      <div className="edit-link" style={{ marginBottom: 16, display: "inline-block" }} onClick={() => setShowDetails(!showDetails)}>
        {showDetails ? "скрыть детали" : "+ детали"}
      </div>

      {showDetails && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 6 }}>
            <strong>{authorLabelFor(type)}:</strong>
            <input value={newAuthor} onChange={e => setNewAuthor(e.target.value)} placeholder="Имя" />
          </div>
          <div className="field" style={{ marginBottom: 6 }}>
            <strong>Гео:</strong>
            <select value={newGeo} onChange={e => setNewGeo(e.target.value)}>
              <option value="">не указано</option>
              {GEO_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {isCast && (
            <div className="field" style={{ marginBottom: 6 }}>
              <strong>Актёры:</strong>
              <input value={newActors} onChange={e => setNewActors(e.target.value)} placeholder="Через запятую" />
            </div>
          )}
          <div className="field" style={{ marginBottom: 8 }}><strong>Жанр:</strong></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginBottom: 8 }}>
            {genresFor(type).map(g => (
              <label key={g} className="genre-chip">
                <input type="checkbox" checked={newGenres.includes(g)} onChange={() => setNewGenres(toggleInList(newGenres, g))} />
                {g}
              </label>
            ))}
          </div>
          <button onClick={submit} style={{ background: "var(--project)", border: "none", borderRadius: 8, padding: "7px 14px", color: "#14171F", fontWeight: 600, cursor: "pointer" }}>
            Добавить
          </button>
        </div>
      )}

      <input value={searchTerm} placeholder="Поиск по названию…" onChange={e => setSearchTerm(e.target.value)}
        style={{ width: "100%", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px", color: "var(--text)", fontSize: "0.85rem", marginBottom: 10 }} />

      <div className="media-filters">
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
                {genreFilter.length > 0 && <div className="media-filter-clear" onClick={() => setGenreFilter([])}>сбросить</div>}
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
                {geoFilter.length > 0 && <div className="media-filter-clear" onClick={() => setGeoFilter([])}>сбросить</div>}
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
                {authorFilter.length > 0 && <div className="media-filter-clear" onClick={() => setAuthorFilter([])}>сбросить</div>}
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
                  {actorFilter.length > 0 && <div className="media-filter-clear" onClick={() => setActorFilter([])}>сбросить</div>}
                </div>
              </>
            )}
          </div>
        )}

        {anyFilterActive && (
          <div className="media-filter-btn" onClick={() => { setSearchTerm(""); setGenreFilter([]); setGeoFilter([]); setAuthorFilter([]); setActorFilter([]); }} style={{ color: "var(--event)" }}>
            сбросить все
          </div>
        )}
      </div>

      {sorted.length === 0 && <div className="muted">{anyFilterActive ? "Ничего не найдено по этим фильтрам." : "Пока пусто."}</div>}
      {sorted.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} profile={profile} />)}
    </div>
  );
}
