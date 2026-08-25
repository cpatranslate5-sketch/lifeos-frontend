import { useState } from "react";
import { Entity, updateEntityField, renameEntity, deleteEntity, entityHistory } from "../api";
import { TYPES, ALL_EMOJI, genresFor, authorLabelFor, GEO_OPTIONS } from "../types";
import { todayStr, addDaysStr } from "../dateUtils";

const MONTHS_RU = ["", "января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

interface Props {
  e: Entity;
  onChanged: () => void;
  selectedDate?: string;
  showNextStep?: boolean;
}

export default function EntityCard({ e, onChanged, selectedDate, showNextStep }: Props) {
  const [showTime, setShowTime] = useState(!!e.attributes?.time);
  const [showNote, setShowNote] = useState(!!e.attributes?.note);
  const [traceOpen, setTraceOpen] = useState(false);
  const [trace, setTrace] = useState<any[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [genrePickerOpen, setGenrePickerOpen] = useState(false);
  const [showGeo, setShowGeo] = useState(!!e.attributes?.geo);
  const [showAuthor, setShowAuthor] = useState(!!e.attributes?.author);

  const meta = TYPES[e.type] || { label: e.type, color: "var(--muted)", emoji: "•" };
  const isHabit = e.type === "habit";
  const isMedia = ["movie", "show", "book"].includes(e.type);
  const doneDates: string[] = e.attributes?.done_dates || [];
  const skippedDates: string[] = e.attributes?.skipped_dates || [];
  const isDoneToday = isHabit ? (selectedDate ? doneDates.includes(selectedDate) : false) : !!e.attributes?.done;
  const canCheck = ["task", "event", "movie", "show", "book", "game", "leisure", "habit"].includes(e.type);

  async function toggleDone() {
    if (isHabit && selectedDate) {
      const next = isDoneToday ? doneDates.filter(d => d !== selectedDate) : [...doneDates, selectedDate];
      await updateEntityField(e.id, "done_dates", next);
    } else {
      await updateEntityField(e.id, "done", !e.attributes?.done);
    }
    onChanged();
  }

  async function skip() {
    if (!window.confirm(`Пропустить/отменить «${e.name}»?`)) return;
    if (isHabit && selectedDate) {
      const next = skippedDates.includes(selectedDate) ? skippedDates : [...skippedDates, selectedDate];
      await updateEntityField(e.id, "skipped_dates", next);
    } else {
      await updateEntityField(e.id, "status", "skipped");
    }
    onChanged();
  }

  async function moveToTomorrow() {
    await updateEntityField(e.id, "date", addDaysStr(todayStr(), 1));
    onChanged();
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить «${e.name}» насовсем? Это нельзя отменить.`)) return;
    await deleteEntity(e.id);
    onChanged();
  }

  async function setEmoji(em: string) {
    setPickerOpen(false);
    await updateEntityField(e.id, "emoji", em);
    onChanged();
  }

  async function toggleTrace() {
    if (!traceOpen) {
      const h = await entityHistory(e.id);
      setTrace(h);
    }
    setTraceOpen(!traceOpen);
  }

  async function toggleGenre(g: string) {
    const current: string[] = e.attributes?.genres || [];
    const next = current.includes(g) ? current.filter(x => x !== g) : [...current, g];
    await updateEntityField(e.id, "genres", next);
    onChanged();
  }

  if (e.type === "anniversary") {
    return (
      <div className="card">
        <div className="card-top">
          <div className="type-badge" style={{ background: meta.color }}>{meta.emoji}</div>
          <div className="card-title-text">{e.name}</div>
        </div>
        <div className="field">{e.attributes.day} {MONTHS_RU[e.attributes.month]}</div>
        <div className="why" style={{ color: "var(--event)" }} onClick={handleDelete}>удалить</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-top">
        <div className="type-badge-wrap">
          <div className="type-badge" style={{ background: meta.color }} onClick={() => setPickerOpen(!pickerOpen)}>
            {e.attributes?.emoji || meta.emoji}
          </div>
          {pickerOpen && (
            <>
              <div className="picker-overlay" onClick={() => setPickerOpen(false)} />
              <div className="emoji-picker">
                {ALL_EMOJI.map(em => (
                  <div key={em} className="emoji-option" onClick={() => setEmoji(em)}>{em}</div>
                ))}
              </div>
            </>
          )}
        </div>
        {canCheck && (
          <input type="checkbox" className="done-check" checked={isDoneToday} onChange={toggleDone} />
        )}
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

      {e.attributes?.company && <div className="field">Компания: {e.attributes.company}</div>}
      {e.attributes?.date && <div className="field">Дата: {e.attributes.date}</div>}

      {(isHabit || e.type === "event" || e.type === "task") && (
        showTime ? (
          <div className="field">
            Время:
            <input autoFocus={!e.attributes?.time} defaultValue={e.attributes?.time || ""} placeholder="например 19:00"
              onBlur={async (ev) => { await updateEntityField(e.id, "time", ev.target.value); onChanged(); }} />
          </div>
        ) : <div className="add-field-link" onClick={() => setShowTime(true)}>+ время</div>
      )}

      {isHabit && <div className="field">{e.attributes?.daily ? "Ежедневно" : e.attributes?.workdays ? "По будням (Пн-Пт)" : e.attributes?.monthday ? `Каждое ${e.attributes.monthday} число месяца` : `День недели: ${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"][Number(e.attributes?.weekday)] ?? "не задан"}`}{e.attributes?.recurring ? "" : " (не отмечена как повторяющаяся!)"}</div>}
      {isHabit && e.attributes?.until && <div className="field">До: {e.attributes.until}</div>}
      {isHabit && /бокс|теннис/i.test(e.name) && (
        <div className="why" style={e.attributes?.needs_bag ? { color: "var(--project)" } : {}}
          onClick={async () => { await updateEntityField(e.id, "needs_bag", !e.attributes?.needs_bag); onChanged(); }}>
          {e.attributes?.needs_bag ? "✓ напоминать собрать сумку" : "+ напоминать собрать сумку"}
        </div>
      )}
      {isHabit && e.attributes?.irregular && <div className="field" style={{ color: "var(--event)" }}>нерегулярно — не всегда случается</div>}

      {["movie", "show", "book", "game"].includes(e.type) && !e.attributes?.done && (
        <div className={`status-badge ${e.attributes?.status === "in_progress" ? "on" : ""}`}
          onClick={async () => { await updateEntityField(e.id, "status", e.attributes?.status === "in_progress" ? "want" : "in_progress"); onChanged(); }}>
          {e.attributes?.status === "in_progress"
            ? `▶ ${({ movie: "Смотрю сейчас", show: "Смотрю сейчас", book: "Читаю сейчас", game: "Играю сейчас" } as any)[e.type]}`
            : "Хочу — отметить как «сейчас»"}
        </div>
      )}

      {isMedia && (
        <>
          <div className="field" style={{ position: "relative" }}>
            Жанр: {(e.attributes?.genres || []).length > 0 ? (e.attributes.genres as string[]).join(", ") : "не указан"}
            {" "}<span className="add-field-link" onClick={() => setGenrePickerOpen(!genrePickerOpen)}>изменить</span>
            {genrePickerOpen && (
              <>
                <div className="picker-overlay" onClick={() => setGenrePickerOpen(false)} />
                <div className="genre-picker">
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

          {showGeo ? (
            <div className="field">
              Гео:
              <select defaultValue={e.attributes?.geo || ""} onChange={async (ev) => { await updateEntityField(e.id, "geo", ev.target.value); onChanged(); }}>
                <option value="">не указано</option>
                {GEO_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          ) : <div className="add-field-link" onClick={() => setShowGeo(true)}>+ гео</div>}

          {showAuthor ? (
            <div className="field">
              {authorLabelFor(e.type)}:
              <input autoFocus={!e.attributes?.author} defaultValue={e.attributes?.author || ""} placeholder="Имя"
                onBlur={async (ev) => { await updateEntityField(e.id, "author", ev.target.value); onChanged(); }} />
            </div>
          ) : <div className="add-field-link" onClick={() => setShowAuthor(true)}>+ {authorLabelFor(e.type).toLowerCase()}</div>}
        </>
      )}

      {showNote ? (
        <div className="field">
          Комментарий:
          <input autoFocus={!e.attributes?.note} defaultValue={e.attributes?.note || ""} placeholder="короткая заметка…"
            onBlur={async (ev) => { await updateEntityField(e.id, "note", ev.target.value); onChanged(); }} />
        </div>
      ) : <div className="add-field-link" style={{ marginRight: 10 }} onClick={() => setShowNote(true)}>+ комментарий</div>}

      {showNextStep && (
        <div className="field">
          Следующий шаг:
          <input defaultValue={e.attributes?.next_step || ""} placeholder="что дальше?"
            onBlur={async (ev) => { await updateEntityField(e.id, "next_step", ev.target.value); onChanged(); }} />
        </div>
      )}

      {!isHabit && e.attributes?.status !== "skipped" && (
        <div className="why" style={{ color: "var(--event)" }} onClick={skip}>пропустить/отменить</div>
      )}
      {!isHabit && ["task", "event"].includes(e.type) && (
        <div className="why" onClick={moveToTomorrow}>перенести на завтра</div>
      )}
      {isHabit && selectedDate && (
        <div className="why" style={{ color: "var(--event)" }} onClick={skip}>отменить на {selectedDate}</div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
        <div className="why" onClick={toggleTrace}>почему это здесь?</div>
        <div className="why" style={{ color: "var(--event)" }} onClick={handleDelete}>удалить</div>
      </div>
      {traceOpen && (
        <div className="trace">
          {trace.length === 0 ? "нет записей истории" :
            trace.map((t, i) => `${t.decision_trace?.action || t.field} — ${(t.decision_trace?.factors || []).join("; ")} (уверенность ${t.confidence})`).join("\n")}
        </div>
      )}
    </div>
  );
}
