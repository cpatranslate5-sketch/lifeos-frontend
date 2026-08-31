import { useEffect, useRef, useState } from "react";
import { Entity, createEntity, uploadEntityCover, entityCoverUrl } from "../api";
import EntityCard, { FilterKind } from "./EntityCard";

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

interface Props {
  title: string;
  placeholder: string;
  type: string;
  items: Entity[];
  onChanged: () => void;
  extraAttrs?: Record<string, any>;
  space?: string;
  profile: string;
  layout?: "even" | "compact";
}

const PAGE_SIZE = 25;

function sortKey(e: Entity): number {
  if (e.attributes?.done) return 2;
  if (e.attributes?.status === "in_progress") return 0;
  return 1;
}

function starWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "звезда";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "звезды";
  return "звёзд";
}

function toggleInList(list: string[], val: string): string[] {
  return list.includes(val) ? list.filter(x => x !== val) : [...list, val];
}

function PageBar({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
        <div key={n} className={`page-btn ${n === page ? "on" : ""}`} onClick={() => onPageChange(n)}>{n}</div>
      ))}
    </div>
  );
}

function GameAddModal({ profile, space, onClose, onAdded }: { profile: string; space?: string; onClose: () => void; onAdded: () => void }) {
  const [val, setVal] = useState("");
  const [developer, setDeveloper] = useState("");
  const [inProgress, setInProgress] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  function pickCover(file: File | null | undefined) {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function handlePaste(ev: React.ClipboardEvent) {
    const items = ev.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        ev.preventDefault();
        pickCover(items[i].getAsFile());
        return;
      }
    }
  }

  async function submit() {
    if (!val.trim()) return;
    const attrs: Record<string, any> = {};
    if (developer.trim()) attrs.developer = developer.trim();
    if (inProgress) attrs.status = "in_progress";
    if (rating) attrs.rating = rating;
    const created = await createEntity("game", val.trim(), attrs, space || "life", profile);
    if (coverFile) await uploadEntityCover(created.id, coverFile);
    onAdded();
    onClose();
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Новая игра</div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
          <div className="cover-thumb" tabIndex={0} onPaste={handlePaste} title="Нажмите сюда и вставьте (Ctrl+V) картинку">
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(ev) => pickCover(ev.target.files?.[0])} />
            {coverPreview ? <img src={coverPreview} alt="" /> : <span className="cover-placeholder">🖼️</span>}
            <div className="cover-pick-btn" title="Выбрать файл с компьютера"
              onClick={(ev) => { ev.stopPropagation(); coverInputRef.current?.click(); }}>📁</div>
          </div>
          <div style={{ flex: 1 }}>
            <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder="Название"
              onKeyDown={e => { if (e.key === "Enter") submit(); }} />
          </div>
        </div>

        <label className="muted">Разработчик</label>
        <input value={developer} onChange={e => setDeveloper(e.target.value)} placeholder="Название студии" />

        <label className="muted">Оценка</label>
        <div className="star-rating" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <span key={n} className={`star ${(rating || 0) >= n ? "filled" : ""}`} onClick={() => setRating(rating === n ? null : n)}>
              {(rating || 0) >= n ? "★" : "☆"}
            </span>
          ))}
        </div>

        <label className={`status-chip ${inProgress ? "on" : ""}`} style={{ marginBottom: 14, display: "inline-flex" }}>
          <input type="checkbox" checked={inProgress} onChange={e => setInProgress(e.target.checked)} />
          Играю сейчас
        </label>
        <div>
          <button onClick={submit}>Добавить</button>
          <button className="cancel" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

function GameStatsModal({ items, onClose }: { items: Entity[]; onClose: () => void }) {
  function topCounts(values: string[], n = 5): [string, number][] {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
  }
  const inProgress = items.filter(e => e.attributes?.status === "in_progress").length;
  const done = items.filter(e => e.attributes?.done).length;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Статистика</div>
        <div className="muted" style={{ marginBottom: 10 }}>Всего: {items.length} · играю сейчас: {inProgress} · пройдено: {done}</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Топ разработчиков</div>
        {topCounts(items.map(e => e.attributes?.developer).filter(Boolean)).map(([d, n]) => (
          <div key={d} className="field">{d} — {n}</div>
        ))}
        {items.every(e => !e.attributes?.developer) && <div className="muted">Нет данных</div>}
        <button className="cancel" style={{ marginTop: 14 }} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}

export default function ShelfTab({ title, placeholder, type, items, onChanged, extraAttrs, space, profile, layout }: Props) {
  const [val, setVal] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [developerFilter, setDeveloperFilter] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<"rating" | "status" | "developer" | "year" | null>(null);
  const isGame = type === "game";

  useEffect(() => {
    if (!openDropdown) return;
    function onKey(ev: KeyboardEvent) { if (ev.key === "Escape") setOpenDropdown(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDropdown]);

  async function submit() {
    if (!val.trim()) return;
    await createEntity(type, val.trim(), extraAttrs || {}, space || "life", profile);
    setVal("");
    onChanged();
  }

  const developers = Array.from(new Set(items.map(e => e.attributes?.developer).filter(Boolean))).sort();
  const presentBuckets = new Set(items.map(e => e.attributes?.year).filter(Boolean).map(y => yearBucket(Number(y))));
  const years = YEAR_BUCKET_ORDER.filter(b => presentBuckets.has(b)).reverse();

  const filtered = isGame ? items.filter(e => {
    if (ratingFilter.length > 0 && !ratingFilter.includes(e.attributes?.rating || 0)) return false;
    if (statusFilter.length > 0) {
      const isDone = !!e.attributes?.done;
      if (!(statusFilter.includes("done") && isDone) && !(statusFilter.includes("not_done") && !isDone)) return false;
    }
    if (developerFilter.length > 0 && !developerFilter.includes(e.attributes?.developer || "")) return false;
    if (yearFilter.length > 0 && (!e.attributes?.year || !yearFilter.includes(yearBucket(Number(e.attributes.year))))) return false;
    return true;
  }) : items;

  const anyFilterActive = ratingFilter.length > 0 || statusFilter.length > 0 || developerFilter.length > 0 || yearFilter.length > 0;
  const sorted = [...filtered].sort((a, b) => sortKey(a) - sortKey(b));
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [items.length, ratingFilter, statusFilter, developerFilter, yearFilter]);

  function handleFilterByCriterion(kind: FilterKind, value: string) {
    if (kind === "author") { setRatingFilter([]); setStatusFilter([]); setYearFilter([]); setDeveloperFilter([value]); }
    if (kind === "year") { setRatingFilter([]); setStatusFilter([]); setDeveloperFilter([]); setYearFilter([value]); }
  }

  return (
    <div className="view">
      <h1>{title}</h1>

      {isGame ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => setShowAdd(true)} style={{ background: "var(--project)", border: "none", borderRadius: 9, padding: "9px 16px", color: "#14171F", fontWeight: 600, cursor: "pointer" }}>
              + Добавить
            </button>
            <button onClick={() => setShowStats(true)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 16px", color: "var(--text)", fontWeight: 600, cursor: "pointer" }}>
              📊 Статистика
            </button>
          </div>
          {showAdd && <GameAddModal profile={profile} space={space} onClose={() => setShowAdd(false)} onAdded={onChanged} />}
          {showStats && <GameStatsModal items={items} onClose={() => setShowStats(false)} />}

          <div className="media-filters">
            <div style={{ position: "relative" }}>
              <div className={`media-filter-btn ${ratingFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "rating" ? null : "rating")}>
                По оценке {ratingFilter.length > 0 ? `(${ratingFilter.length})` : ""}
              </div>
              {openDropdown === "rating" && (
                <>
                  <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
                  <div className="media-filter-dropdown">
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
                      <label key={n} className="media-filter-option">
                        <input type="checkbox" checked={ratingFilter.includes(n)} onChange={() => setRatingFilter(toggleInList(ratingFilter.map(String), String(n)).map(Number))} />
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
                  <div className="media-filter-dropdown">
                    <label className="media-filter-option">
                      <input type="checkbox" checked={statusFilter.includes("done")} onChange={() => setStatusFilter(toggleInList(statusFilter, "done"))} />
                      Пройдено
                    </label>
                    <label className="media-filter-option">
                      <input type="checkbox" checked={statusFilter.includes("not_done")} onChange={() => setStatusFilter(toggleInList(statusFilter, "not_done"))} />
                      Не пройдено
                    </label>
                    {statusFilter.length > 0 && <div className="media-filter-clear" onClick={() => setStatusFilter([])}>Сбросить</div>}
                  </div>
                </>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <div className={`media-filter-btn ${developerFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "developer" ? null : "developer")}>
                Разработчик {developerFilter.length > 0 ? `(${developerFilter.length})` : ""}
              </div>
              {openDropdown === "developer" && (
                <>
                  <div className="picker-overlay" onClick={() => setOpenDropdown(null)} />
                  <div className="media-filter-dropdown">
                    {developers.length === 0 && <div className="muted" style={{ fontSize: "0.75rem" }}>Пока нет записей.</div>}
                    {developers.map(d => (
                      <label key={d} className="media-filter-option">
                        <input type="checkbox" checked={developerFilter.includes(d)} onChange={() => setDeveloperFilter(toggleInList(developerFilter, d))} />
                        {d}
                      </label>
                    ))}
                    {developerFilter.length > 0 && <div className="media-filter-clear" onClick={() => setDeveloperFilter([])}>Сбросить</div>}
                  </div>
                </>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <div className={`media-filter-btn ${yearFilter.length ? "active" : ""}`} onClick={() => setOpenDropdown(openDropdown === "year" ? null : "year")}>
                Год {yearFilter.length > 0 ? `(${yearFilter.length})` : ""}
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

            {anyFilterActive && (
              <div className="media-filter-btn" onClick={() => { setRatingFilter([]); setStatusFilter([]); setDeveloperFilter([]); setYearFilter([]); }} style={{ color: "var(--event)" }}>
                Сбросить все
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="addrow">
          <input value={val} placeholder={placeholder} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); }} />
          <button className="btn-add-plus" onClick={submit}>+</button>
        </div>
      )}

      <PageBar page={page} totalPages={totalPages} onPageChange={setPage} />

      {sorted.length === 0 && <div className="muted">{anyFilterActive ? "Ничего не найдено по этим фильтрам." : "Пока пусто."}</div>}
      {pageItems.map(it => <EntityCard key={it.id} e={it} onChanged={onChanged} profile={profile} onFilterByCriterion={isGame ? handleFilterByCriterion : undefined} layout={layout} />)}

      <PageBar page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
