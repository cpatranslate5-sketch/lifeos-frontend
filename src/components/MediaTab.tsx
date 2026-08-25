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

export default function MediaTab({ title, placeholder, type, items, onChanged, profile }: Props) {
  const [val, setVal] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [geoFilter, setGeoFilter] = useState<string>("");
  const [authorFilter, setAuthorFilter] = useState<string>("");
  const [openDropdown, setOpenDropdown] = useState<"genre" | "geo" | "author" | null>(null);

  useEffect(() => {
    if (!openDropdown) return;
    function onKey(ev: KeyboardEvent) { if (ev.key === "Escape") setOpenDropdown(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDropdown]);

  async function submit() {
    if (!val.trim()) return;
    await createEntity(type, val.trim(), {}, "life", profile);
    setVal("");
    onChanged();
  }

  function toggleGenreFilter(g: string) {
    setGenreFilter(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  const authors = Array.from(new Set(items.map(e => e.attributes?.author || "Без автора"))).sort();

  const filtered = items.filter(e => {
    if (searchTerm && !e.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (genreFilter.length > 0) {
      const g: string[] = e.attributes?.genres || [];
      if (!genreFilter.some(f => g.includes(f))) return false;
    }
    if (geoFilter && e.attributes?.geo !== geoFilter) return false;
    if (authorFilter) {
      const a = e.attributes?.author || "Без автора";
      if (a !== authorFilter) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => sortKey(a) - sortKey(b));
  const anyFilterActive = !!searchTerm || genreFilter.length > 0 || !!geoFilter || !!authorFilter;

  return (
    <div className="view">
      <h1>{title}</h1>
      <div className="addrow">
        <input value={val} placeholder={placeholder} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <button onClick={submit}>+</button>
      </div>

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
                    <input type="checkbox" checked={genreFilter.includes(g)} onChange={() => toggleGenreFilter(g)} />
                    {g}
                  </label>
                ))}
                {genreFilter.length > 0 && <div className="media-filter-clear" onClick={() => setGenreFilter([])}>сбросить</div>}
              </div>
            </>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <div className={`media-filter-btn ${geoFilter ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "geo" ? null : "geo")}>
            Гео {geoFilter ? `(${geoFilter})` : ""}
          </div>
          {openDropdown === "geo" && (
            <>
              <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
              <div className="media-filter-dropdown">
                {GEO_OPTIONS.map(g => (
                  <div key={g} className="media-filter-option" onClick={() => { setGeoFilter(geoFilter === g ? "" : g); setOpenDropdown(null); }}>
                    {geoFilter === g ? "✓ " : ""}{g}
                  </div>
                ))}
                {geoFilter && <div className="media-filter-clear" onClick={() => { setGeoFilter(""); setOpenDropdown(null); }}>сбросить</div>}
              </div>
            </>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <div className={`media-filter-btn ${authorFilter ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "author" ? null : "author")}>
            {authorLabelFor(type)} {authorFilter ? `(${authorFilter})` : ""}
          </div>
          {openDropdown === "author" && (
            <>
              <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
              <div className="media-filter-dropdown">
                {authors.length === 0 && <div className="muted" style={{ fontSize: "0.75rem" }}>Пока нет записей.</div>}
                {authors.map(a => (
                  <div key={a} className="media-filter-option" onClick={() => { setAuthorFilter(authorFilter === a ? "" : a); setOpenDropdown(null); }}>
                    {authorFilter === a ? "✓ " : ""}{a}
                  </div>
                ))}
                {authorFilter && <div className="media-filter-clear" onClick={() => { setAuthorFilter(""); setOpenDropdown(null); }}>сбросить</div>}
              </div>
            </>
          )}
        </div>

        {anyFilterActive && (
          <div className="media-filter-btn" onClick={() => { setSearchTerm(""); setGenreFilter([]); setGeoFilter(""); setAuthorFilter(""); }} style={{ color: "var(--event)" }}>
            сбросить все
          </div>
        )}
      </div>

      {sorted.length === 0 && <div className="muted">{anyFilterActive ? "Ничего не найдено по этим фильтрам." : "Пока пусто."}</div>}
      {sorted.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} />)}
    </div>
  );
}
