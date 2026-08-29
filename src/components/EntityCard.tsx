import { useEffect, useRef, useState } from "react";
import { Entity, updateEntityField, renameEntity, deleteEntity, createEntity, uploadEntityCover, entityCoverUrl, propagateCover } from "../api";
import { TYPES, genresFor, authorLabelFor, GEO_OPTIONS } from "../types";
import { todayStr, addDaysStr } from "../dateUtils";
import { showToast } from "../toast";
import { computeStreak } from "../habitUtils";
import { useLiteMode } from "../liteMode";
import MiniCalendar from "./MiniCalendar";

const MONTHS_RU = ["", "января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

function authorsOf(e: Entity): string[] {
  const a = e.attributes?.author;
  if (!a) return [];
  return Array.isArray(a) ? a : [a];
}

export type FilterKind = "genre" | "geo" | "author" | "actor";

interface Props {
  e: Entity;
  onChanged: () => void;
  selectedDate?: string;
  showNextStep?: boolean;
  profile?: string;
  onFilterByCriterion?: (kind: FilterKind, value: string) => void;
  layout?: "even" | "sequential" | "compact";
}

export default function EntityCard({ e, onChanged, selectedDate, showNextStep, profile, onFilterByCriterion, layout }: Props) {
  const liteMode = useLiteMode();
  const [showTime, setShowTime] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [genrePickerOpen, setGenrePickerOpen] = useState(false);
  const [geoEditing, setGeoEditing] = useState(false);
  const [authorEditing, setAuthorEditing] = useState(false);
  const [developerEditing, setDeveloperEditing] = useState(false);
  const [actorsEditing, setActorsEditing] = useState(false);
  const [movePickerOpen, setMovePickerOpen] = useState(false);

  useEffect(() => {
    if (!genrePickerOpen) return;
    function onKey(ev: KeyboardEvent) { if (ev.key === "Escape") setGenrePickerOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [genrePickerOpen]);

  const meta = TYPES[e.type] || { label: e.type, color: "var(--muted)", emoji: "•" };
  const isHabit = e.type === "habit";
  const isMedia = ["movie", "show", "book"].includes(e.type);
  const hasRating = ["movie", "show", "book", "game"].includes(e.type);
  const isCast = ["movie", "show"].includes(e.type);
  const doneDates: string[] = e.attributes?.done_dates || [];
  const skippedDates: string[] = e.attributes?.skipped_dates || [];
  const isDoneToday = isHabit ? (selectedDate ? doneDates.includes(selectedDate) : false) : !!e.attributes?.done;
  const canCheck = ["task", "event", "movie", "show", "book", "game", "leisure", "habit"].includes(e.type);
  const isHousehold = e.attributes?.category === "household";
  const effectiveLayout = hasRating ? "media" : (layout || "even");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverLightbox, setCoverLightbox] = useState(false);
  const [confirmState, setConfirmState] = useState<{ message: string; onYes: () => void } | null>(null);
  const [propagatePrompt, setPropagatePrompt] = useState(false);
  const [propagateKeyword, setPropagateKeyword] = useState("");

  function clickCriterion(ev: React.MouseEvent, kind: FilterKind, value: string) {
    if (!onFilterByCriterion) return;
    ev.stopPropagation();
    onFilterByCriterion(kind, value);
  }

  async function uploadCover(file: File | null | undefined) {
    if (!file) return;
    setCoverUploading(true);
    try {
      await uploadEntityCover(e.id, file);
      onChanged();
      setPropagatePrompt(true);
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function doPropagate() {
    if (!propagateKeyword.trim()) { setPropagatePrompt(false); return; }
    const res = await propagateCover(e.id, propagateKeyword.trim());
    showToast(res.updated > 0 ? `Обложка применена: ${res.updated}` : "Совпадений не найдено");
    setPropagatePrompt(false);
    setPropagateKeyword("");
    onChanged();
  }

  function handleCoverPaste(ev: React.ClipboardEvent) {
    const items = ev.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        ev.preventDefault();
        uploadCover(items[i].getAsFile());
        return;
      }
    }
  }

  async function toggleDone() {
    if (isHabit && selectedDate) {
      const next = isDoneToday ? doneDates.filter(d => d !== selectedDate) : [...doneDates, selectedDate];
      await updateEntityField(e.id, "done_dates", next);
    } else {
      await updateEntityField(e.id, "done", !e.attributes?.done);
    }
    onChanged();
  }

  function skip() {
    setConfirmState({
      message: `Пропустить/отменить «${e.name}»?`,
      onYes: async () => {
        if (isHabit && selectedDate) {
          const next = skippedDates.includes(selectedDate) ? skippedDates : [...skippedDates, selectedDate];
          await updateEntityField(e.id, "skipped_dates", next);
        } else {
          await updateEntityField(e.id, "status", "skipped");
        }
        onChanged();
      },
    });
  }

  const moveMinDate = todayStr();

  async function moveTo(targetDate: string) {
    if (isHabit && selectedDate) {
      const nextSkipped = skippedDates.includes(selectedDate) ? skippedDates : [...skippedDates, selectedDate];
      await updateEntityField(e.id, "skipped_dates", nextSkipped);
      await createEntity("task", `${e.name} (перенесено)`, { date: targetDate }, e.space, profile || "nemalenkiy");
    } else {
      await updateEntityField(e.id, "date", targetDate);
    }
    setMovePickerOpen(false);
    showToast("Перенесено");
    onChanged();
  }

  async function copyToOtherFolder() {
    const target = profile === "kotyonok" ? "nemalenkiy" : "kotyonok";
    const targetLabel = target === "kotyonok" ? "Котёнок" : "НеМаленький";
    const { done, done_dates, status, rating, reminder_marker, skipped_dates, ...catalogAttrs } = e.attributes || {};
    await createEntity(e.type, e.name, catalogAttrs, "life", target);
    showToast(`Скопировано в «${targetLabel}»`);
  }

  function handleDelete() {
    setConfirmState({
      message: `Удалить «${e.name}» насовсем? Это нельзя отменить.`,
      onYes: async () => {
        await deleteEntity(e.id);
        showToast("Удалено");
        onChanged();
      },
    });
  }

  async function toggleGenre(g: string) {
    const current: string[] = e.attributes?.genres || [];
    const next = current.includes(g) ? current.filter(x => x !== g) : [...current, g];
    await updateEntityField(e.id, "genres", next);
    onChanged();
  }

  if (e.type === "anniversary") {
    return (
      <div className="card card-with-cover">
        <div className="cover-thumb" tabIndex={0} onPaste={handleCoverPaste}
          onDoubleClick={() => e.attributes?.cover_path && !liteMode && setCoverLightbox(true)}
          title="Нажмите сюда и вставьте (Ctrl+V) скопированную картинку, двойной клик — открыть на весь экран">
          <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(ev) => uploadCover(ev.target.files?.[0])} />
          {e.attributes?.cover_path && !liteMode ? (
            <img src={entityCoverUrl(e.attributes.cover_path)} alt="" />
          ) : (
            <span className="cover-placeholder">{coverUploading ? "…" : "🖼️"}</span>
          )}
          <div className="cover-pick-btn" title="Выбрать файл с компьютера"
            onClick={(ev) => { ev.stopPropagation(); coverInputRef.current?.click(); }}>📁</div>
        </div>
        {coverLightbox && e.attributes?.cover_path && (
          <div className="lightbox-overlay" onClick={() => setCoverLightbox(false)}>
            <img src={entityCoverUrl(e.attributes.cover_path)} alt="" className="lightbox-img" />
          </div>
        )}
        <div className="card-body">
          <div className="card-top">
            <div className="card-title-text">{e.name}</div>
          </div>
          <div className="field">{e.attributes.day} {MONTHS_RU[e.attributes.month]}</div>
          <div className="why danger-action" onClick={handleDelete}>Удалить</div>
        </div>
        {confirmState && (
          <div className="modal-bg" onClick={() => setConfirmState(null)}>
            <div className="modal" onClick={ev => ev.stopPropagation()}>
              <div style={{ marginBottom: 14 }}>{confirmState.message}</div>
              <div>
                <button onClick={() => { confirmState.onYes(); setConfirmState(null); }}>Да</button>
                <button className="cancel" onClick={() => setConfirmState(null)}>Отмена</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const isLastDay = isHabit && e.attributes?.until && selectedDate === e.attributes.until;

  return (
    <div className="card card-with-cover">
      <div className="cover-thumb" tabIndex={0} onPaste={handleCoverPaste}
        onDoubleClick={() => e.attributes?.cover_path && !liteMode && setCoverLightbox(true)}
        title="Нажмите сюда и вставьте (Ctrl+V) скопированную картинку, двойной клик — открыть на весь экран">
        <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(ev) => uploadCover(ev.target.files?.[0])} />
        {e.attributes?.cover_path && !liteMode ? (
          <img src={entityCoverUrl(e.attributes.cover_path)} alt="" />
        ) : (
          <span className="cover-placeholder">{coverUploading ? "…" : "🖼️"}</span>
        )}
        <div className="cover-pick-btn" title="Выбрать файл с компьютера"
          onClick={(ev) => { ev.stopPropagation(); coverInputRef.current?.click(); }}>📁</div>
      </div>
      {coverLightbox && e.attributes?.cover_path && (
        <div className="lightbox-overlay" onClick={() => setCoverLightbox(false)}>
          <img src={entityCoverUrl(e.attributes.cover_path)} alt="" className="lightbox-img" />
        </div>
      )}
      {canCheck && (
        <div className="check-column">
          <input type="checkbox" className="done-check" checked={isDoneToday} onChange={toggleDone} />
        </div>
      )}
      <div className="card-body card-body-flex">
      <div className="card-top card-top-title">
        {editingTitle ? (
          <input className="card-title-input" autoFocus defaultValue={e.name}
            onBlur={async (ev) => { const v = ev.target.value.trim(); if (v && v !== e.name) { await renameEntity(e.id, v); onChanged(); } setEditingTitle(false); }}
            onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
        ) : (
          <div className="card-title-text" onClick={() => setEditingTitle(true)}
            style={isDoneToday ? { textDecoration: "line-through", textDecorationColor: "var(--event)", textDecorationThickness: 2, color: "var(--event)" } : {}}>
            {e.name}
          </div>
        )}
      </div>

      <div className={`card-middle layout-${effectiveLayout}`}>
      {e.attributes?.company && <div className="field">Компания: {e.attributes.company}</div>}
      {e.type === "event" && e.attributes?.date && effectiveLayout !== "sequential" && (
        <div className="field">Дата: {e.attributes.date}</div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {!isHousehold && (isHabit || e.type === "event" || e.type === "task") && (
          showTime ? (
            <span className="time-badge editing">
              <input autoFocus={!e.attributes?.time} defaultValue={e.attributes?.time || ""} placeholder="19:00" maxLength={5}
                onBlur={async (ev) => { await updateEntityField(e.id, "time", ev.target.value); setShowTime(false); onChanged(); }}
                onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
            </span>
          ) : (
            <div className={`status-badge time-badge ${e.attributes?.time ? "on" : ""}`} onClick={() => setShowTime(true)}>
              {e.attributes?.time || "Время"}
            </div>
          )
        )}

        {!isHousehold && (e.type === "task" || isHabit) && !e.attributes?.done && (
          <div className={`status-badge in-process-badge ${e.attributes?.in_process ? "on" : ""}`}
            onClick={async () => { await updateEntityField(e.id, "in_process", !e.attributes?.in_process); onChanged(); }}>
            {e.attributes?.in_process ? <><span className="dot-small">🟢</span> В процессе</> : "В процессе"}
          </div>
        )}
      </div>

      {isLastDay && (
        <div className="field" style={{ color: "var(--event)", fontWeight: 600 }}>⚠️ Последний день действия карточки!</div>
      )}
      {isHabit && !e.attributes?.recurring && (
        <div className="field" style={{ color: "var(--event)" }}>не отмечена как повторяющаяся!</div>
      )}
      {isHabit && e.attributes?.irregular && <div className="field" style={{ color: "var(--event)" }}>нерегулярно — не всегда случается</div>}
      {isHabit && e.space === "life" && computeStreak(e, todayStr()) >= 2 && (
        <div className="field" style={{ color: "#E8963D" }}>🔥 {computeStreak(e, todayStr())} подряд</div>
      )}

      {["movie", "show", "book", "game"].includes(e.type) && !e.attributes?.done && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <div className={`status-badge ${e.attributes?.status === "in_progress" ? "on" : ""}`}
            onClick={async () => { await updateEntityField(e.id, "status", e.attributes?.status === "in_progress" ? "want" : "in_progress"); onChanged(); }}>
            {e.attributes?.status === "in_progress"
              ? `▶ ${({ movie: "Смотрю сейчас", show: "Смотрю сейчас", book: "Читаю сейчас", game: "Играю сейчас" } as any)[e.type]}`
              : "Хочу — отметить как «сейчас»"}
          </div>
          {e.type === "show" && (
            <div className={`status-badge new-season ${e.attributes?.status === "waiting_season" ? "on" : ""}`}
              onClick={async () => { await updateEntityField(e.id, "status", e.attributes?.status === "waiting_season" ? "want" : "waiting_season"); onChanged(); }}>
              {e.attributes?.status === "waiting_season" ? "🔔 Жду новый сезон" : "Новый сезон"}
            </div>
          )}
        </div>
      )}

      {e.type === "game" && (
        <div className="field media-criterion" onClick={() => !developerEditing && setDeveloperEditing(true)}>
          {developerEditing ? (
            <>
              <strong>Разработчик:</strong>
              <input autoFocus defaultValue={e.attributes?.developer || ""} placeholder="Название студии" onClick={(ev) => ev.stopPropagation()}
                onBlur={async (ev) => { await updateEntityField(e.id, "developer", ev.target.value); setDeveloperEditing(false); onChanged(); }}
                onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); if (ev.key === "Escape") setDeveloperEditing(false); }} />
            </>
          ) : <><strong>Разработчик:</strong> {e.attributes?.developer ? (
            <span className={onFilterByCriterion ? "criterion-link" : ""} onClick={(ev) => clickCriterion(ev, "author", e.attributes.developer)}>{e.attributes.developer}</span>
          ) : "не указан"}</>}
        </div>
      )}

      {isMedia && (
        <div className="media-criteria">
          <div className="field media-criterion" onClick={() => !authorEditing && setAuthorEditing(true)}>
            {authorEditing ? (
              <>
                <strong>{authorLabelFor(e.type)}:</strong>
                <input autoFocus defaultValue={authorsOf(e).join(", ")} placeholder="Через запятую, если несколько" onClick={(ev) => ev.stopPropagation()}
                  onBlur={async (ev) => {
                    const list = ev.target.value.split(",").map(s => s.trim()).filter(Boolean);
                    await updateEntityField(e.id, "author", list);
                    setAuthorEditing(false);
                    onChanged();
                  }}
                  onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); if (ev.key === "Escape") setAuthorEditing(false); }} />
              </>
            ) : (
              <>
                <strong>{authorLabelFor(e.type)}:</strong>{" "}
                {authorsOf(e).length > 0 ? authorsOf(e).map((a, i) => (
                  <span key={a}>
                    {i > 0 && ", "}
                    <span className={onFilterByCriterion ? "criterion-link" : ""} onClick={(ev) => clickCriterion(ev, "author", a)}>{a}</span>
                  </span>
                )) : "не указан"}
              </>
            )}
          </div>

          {isCast && (
            <div className="field media-criterion" onClick={() => !actorsEditing && setActorsEditing(true)}>
              {actorsEditing ? (
                <>
                  <strong>Актёры:</strong>
                  <input autoFocus defaultValue={(e.attributes?.actors || []).join(", ")} placeholder="Через запятую" onClick={(ev) => ev.stopPropagation()}
                    onBlur={async (ev) => {
                      const list = ev.target.value.split(",").map(s => s.trim()).filter(Boolean);
                      await updateEntityField(e.id, "actors", list);
                      setActorsEditing(false);
                      onChanged();
                    }}
                    onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); if (ev.key === "Escape") setActorsEditing(false); }} />
                </>
              ) : (
                <>
                  <strong>Актёры:</strong>{" "}
                  {(e.attributes?.actors || []).length > 0 ? (e.attributes.actors as string[]).map((a, i) => (
                    <span key={a}>
                      {i > 0 && ", "}
                      <span className={onFilterByCriterion ? "criterion-link" : ""} onClick={(ev) => clickCriterion(ev, "actor", a)}>{a}</span>
                    </span>
                  )) : "не указаны"}
                </>
              )}
            </div>
          )}

          <div className="field media-criterion" style={{ position: "relative" }} onClick={() => setGenrePickerOpen(!genrePickerOpen)}>
            <strong>Жанр:</strong>{" "}
            {(e.attributes?.genres || []).length > 0 ? (e.attributes.genres as string[]).map((g, i) => (
              <span key={g}>
                {i > 0 && ", "}
                <span className={onFilterByCriterion ? "criterion-link" : ""} onClick={(ev) => clickCriterion(ev, "genre", g)}>{g}</span>
              </span>
            )) : "не указан"}
            {genrePickerOpen && (
              <>
                <div className="picker-overlay" onClick={(ev) => { ev.stopPropagation(); setGenrePickerOpen(false); }} />
                <div className="genre-picker" onClick={(ev) => ev.stopPropagation()}>
                  {genresFor(e.type).map(g => (
                    <label key={g} className="genre-option">
                      <input type="checkbox" checked={(e.attributes?.genres || []).includes(g)} onChange={() => toggleGenre(g)} />
                      {g}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="field media-criterion" onClick={() => !geoEditing && setGeoEditing(true)}>
            {geoEditing ? (
              <>
                <strong>Гео:</strong>
                <select autoFocus defaultValue={e.attributes?.geo || ""}
                  onChange={async (ev) => { await updateEntityField(e.id, "geo", ev.target.value); setGeoEditing(false); onChanged(); }}
                  onBlur={() => setGeoEditing(false)}
                  onKeyDown={(ev) => { if (ev.key === "Escape") setGeoEditing(false); }}>
                  <option value="">не указано</option>
                  {GEO_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </>
            ) : (
              <>
                <strong>Гео:</strong>{" "}
                {e.attributes?.geo ? (
                  <span className={onFilterByCriterion ? "criterion-link" : ""} onClick={(ev) => clickCriterion(ev, "geo", e.attributes.geo)}>{e.attributes.geo}</span>
                ) : "не указано"}
              </>
            )}
          </div>
        </div>
      )}

      {showNextStep && (
        <div className="field">
          Следующий шаг:
          <input defaultValue={e.attributes?.next_step || ""} placeholder="что дальше?"
            onBlur={async (ev) => { await updateEntityField(e.id, "next_step", ev.target.value); onChanged(); }} />
        </div>
      )}
      </div>

      <div className="card-bottom">
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {(["task", "event"].includes(e.type) || isHabit) && (
          <div className="why" style={{ position: "relative" }} onClick={() => setMovePickerOpen(!movePickerOpen)}>
            Перенести
            {movePickerOpen && (
              <>
                <div className="picker-overlay" onClick={(ev) => { ev.stopPropagation(); setMovePickerOpen(false); }} />
                <MiniCalendar minDate={moveMinDate} onSelect={moveTo} />
              </>
            )}
          </div>
        )}
        {!["movie", "show", "book", "leisure", "game"].includes(e.type) && e.attributes?.status !== "skipped" && (
          <div className="why danger-action" onClick={skip}>{isHabit ? `Отменить на ${selectedDate}` : "Пропустить/отменить"}</div>
        )}
        {profile && ["movie", "show", "book", "game", "leisure"].includes(e.type) && (
          <div className="why" onClick={copyToOtherFolder}>Скопировать в {profile === "kotyonok" ? "НеМаленький" : "Котёнок"}</div>
        )}
        <div className="why danger-action" onClick={handleDelete}>Удалить</div>
        {hasRating && (
          <div className="star-rating" style={{ marginBottom: 0, marginLeft: "auto" }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <span key={n} className={`star ${(e.attributes?.rating || 0) >= n ? "filled" : ""}`}
                onClick={async () => { await updateEntityField(e.id, "rating", e.attributes?.rating === n ? null : n); onChanged(); }}>
                {(e.attributes?.rating || 0) >= n ? "★" : "☆"}
              </span>
            ))}
          </div>
        )}
      </div>
      </div>
      {propagatePrompt && (
        <div className="modal-bg" onClick={() => setPropagatePrompt(false)}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div style={{ marginBottom: 8 }}>Применить эту обложку и к другим карточкам?</div>
            <input autoFocus value={propagateKeyword} onChange={ev => setPropagateKeyword(ev.target.value)}
              placeholder="Например: Манчестер Юнайтед" onKeyDown={ev => { if (ev.key === "Enter") doPropagate(); }} />
            <div className="muted" style={{ fontSize: "0.72rem", marginTop: 4, marginBottom: 10 }}>Применится ко всем карточкам того же типа с этим текстом в названии.</div>
            <div>
              <button onClick={doPropagate}>Применить</button>
              <button className="cancel" onClick={() => setPropagatePrompt(false)}>Нет, только сюда</button>
            </div>
          </div>
        </div>
      )}
      {confirmState && (
        <div className="modal-bg" onClick={() => setConfirmState(null)}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div style={{ marginBottom: 14 }}>{confirmState.message}</div>
            <div>
              <button onClick={() => { confirmState.onYes(); setConfirmState(null); }}>Да</button>
              <button className="cancel" onClick={() => setConfirmState(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
