import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Entity, createEntity, deleteEntity, updateEntityField } from "../api";
import { todayStr, addDaysStr } from "../dateUtils";
import { showToast } from "../toast";
import { Confetti } from "./Milestone";

// ============================================================
// Челленджи: «до такого-то числа — столько-то фильмов, книг, сериалов, игр».
// Карточка типа "challenge":
//   start, deadline — "YYYY-MM-DD"
//   goals           — { movie: 10, book: 3, ... } (0 / нет — категория не участвует)
//   completed_at    — когда цель выполнена (чтобы поздравить один раз)
// Засчитывается всё, что отмечено пройденным (done_at) с даты старта по дедлайн.
// ============================================================

export const CHALLENGE_TYPE = "challenge";
type Kind = "movie" | "show" | "book" | "game";
const KINDS: { k: Kind; label: string; emoji: string; color: string; forms: [string, string, string]; verb: string }[] = [
  { k: "movie", label: "Фильмы", emoji: "🎬", color: "var(--movie)", forms: ["фильм", "фильма", "фильмов"], verb: "посмотреть" },
  { k: "show", label: "Сериалы", emoji: "📺", color: "var(--show)", forms: ["сериал", "сериала", "сериалов"], verb: "посмотреть" },
  { k: "book", label: "Книги", emoji: "📚", color: "var(--book)", forms: ["книгу", "книги", "книг"], verb: "прочитать" },
  { k: "game", label: "Игры", emoji: "🎮", color: "var(--game)", forms: ["игру", "игры", "игр"], verb: "пройти" },
];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function plural(n: number, [one, few, many]: [string, string, string]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
const dateRu = (d: string) => { const [y, m, day] = d.split("-").map(Number); return `${day} ${MONTHS[m - 1]}${y !== Number(todayStr().slice(0, 4)) ? " " + y : ""}`; };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T12:00").getTime() - new Date(a + "T12:00").getTime()) / 86400000);
const daysWord = (n: number) => `${n} ${plural(n, ["день", "дня", "дней"])}`;

function endOfMonth(d: string) { const [y, m] = d.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`; }

export function counted(c: Entity, media: Entity[], k: Kind): Entity[] {
  const a = c.attributes || {};
  return media.filter(e => e.type === k && e.attributes?.done && e.attributes?.done_at && e.attributes.done_at >= a.start && e.attributes.done_at <= a.deadline);
}

function NewChallenge({ profile, onClose, onDone }: { profile: string; onClose: () => void; onDone: () => void }) {
  const today = todayStr();
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState(addDaysStr(today, 30));
  const [goals, setGoals] = useState<Record<Kind, number>>({ movie: 10, show: 2, book: 3, game: 1 });
  const [saving, setSaving] = useState(false);
  const presets: [string, string][] = [
    ["+30 дней", addDaysStr(today, 30)],
    ["До конца месяца", endOfMonth(today)],
    ["+3 месяца", addDaysStr(today, 91)],
    ["До Нового года", `${today.slice(0, 4)}-12-31`],
  ];
  const total = KINDS.reduce((s, x) => s + (goals[x.k] || 0), 0);

  async function create() {
    if (!total || deadline <= today) return;
    setSaving(true);
    try {
      const g: Partial<Record<Kind, number>> = {};
      KINDS.forEach(x => { if (goals[x.k] > 0) g[x.k] = goals[x.k]; });
      await createEntity(CHALLENGE_TYPE, name.trim() || `Челлендж до ${dateRu(deadline)}`, { start: today, deadline, goals: g }, "life", profile);
      showToast("Челлендж запущен 🏁");
      onDone(); onClose();
    } catch { showToast("Не получилось создать — попробуй ещё раз"); }
    finally { setSaving(false); }
  }

  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal ch-modal" onClick={ev => ev.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>🏁 Новый челлендж</h3>
        <label className="muted">Название (необязательно)</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={`Челлендж до ${dateRu(deadline)}`} />
        <label className="muted">До какого числа</label>
        <input type="date" value={deadline} min={addDaysStr(today, 1)} onChange={e => setDeadline(e.target.value)} />
        <div className="ch-presets">
          {presets.map(([l, d]) => <span key={l} className={deadline === d ? "on" : ""} onClick={() => setDeadline(d)}>{l}</span>)}
        </div>
        <div className="muted time-small" style={{ margin: "2px 0 10px" }}>С сегодняшнего дня — {daysWord(Math.max(0, daysBetween(today, deadline)))}</div>
        <div className="ch-goals">
          {KINDS.map(x => (
            <div key={x.k} className="ch-goal" style={{ ["--accent" as any]: x.color }}>
              <span>{x.emoji} {x.label}</span>
              <div className="ch-step">
                <button type="button" onClick={() => setGoals({ ...goals, [x.k]: Math.max(0, goals[x.k] - 1) })}>−</button>
                <b>{goals[x.k]}</b>
                <button type="button" onClick={() => setGoals({ ...goals, [x.k]: goals[x.k] + 1 })}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="muted time-small" style={{ margin: "8px 0 12px" }}>0 — категория не участвует. Засчитывается всё, что отметишь пройденным с сегодняшнего дня.</div>
        <button onClick={create} disabled={saving || !total || deadline <= today}>{saving ? "Создаю…" : "Начать челлендж"}</button>
        <button className="cancel" onClick={onClose}>Отмена</button>
      </div>
    </div>,
    document.body
  );
}

function ChallengeCard({ c, media, onChanged }: { c: Entity; media: Entity[]; onChanged: () => void }) {
  const a = c.attributes || {};
  const today = todayStr();
  const goals: Partial<Record<Kind, number>> = a.goals || {};
  const kinds = KINDS.filter(x => (goals[x.k] || 0) > 0);
  const rows = kinds.map(x => ({ ...x, goal: goals[x.k]!, list: counted(c, media, x.k) }));
  const doneAll = rows.every(r => r.list.length >= r.goal);
  const totalGoal = rows.reduce((s, r) => s + r.goal, 0);
  const totalDone = rows.reduce((s, r) => s + Math.min(r.goal, r.list.length), 0);
  const left = daysBetween(today, a.deadline);
  const expired = left < 0;
  const passed = Math.max(1, daysBetween(a.start, today) + 1);
  const length = Math.max(1, daysBetween(a.start, a.deadline) + 1);
  const timeShare = Math.min(100, (passed / length) * 100);
  const progShare = totalGoal ? (totalDone / totalGoal) * 100 : 0;
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [party, setParty] = useState(false);

  // Поздравляем один раз — в момент, когда цель выполнена
  useEffect(() => {
    if (doneAll && rows.length && !a.completed_at) {
      setParty(true);
      updateEntityField(c.id, "completed_at", today).catch(() => {});
    }
  }, [doneAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const state = doneAll ? "won" : expired ? "lost" : progShare + 0.01 >= timeShare ? "ahead" : "behind";
  const badge = state === "won" ? "🏆 Выполнен" : state === "lost" ? "⌛ Время вышло" : state === "ahead" ? "👍 Идёшь по графику" : "⚡ Нужно поднажать";

  return (
    <div className={`ch-card ${state}`}>
      <div className="ch-head">
        <div>
          <div className="ch-name">{c.name}</div>
          <div className="muted time-small">
            {dateRu(a.start)} — {dateRu(a.deadline)}
            {!doneAll && !expired && <> · осталось <b>{left === 0 ? "последний день" : daysWord(left)}</b></>}
          </div>
        </div>
        <span className={`ch-badge ${state}`}>{badge}</span>
      </div>

      <div className="ch-total">
        <div className="ch-total-bar">
          <div className="ch-total-fill" style={{ width: `${progShare}%` }} />
          {!doneAll && !expired && <div className="ch-total-time" style={{ left: `${timeShare}%` }} title="Сколько времени прошло" />}
        </div>
        <span className="ch-total-num">{totalDone} / {totalGoal}</span>
      </div>

      <div className="ch-rows">
        {rows.map(r => {
          const rest = Math.max(0, r.goal - r.list.length);
          const perWeek = left >= 0 && rest > 0 ? (rest / Math.max(1, left + 1)) * 7 : 0;
          return (
            <div key={r.k} className="ch-row" style={{ ["--accent" as any]: r.color }}>
              <span className="ch-row-name">{r.emoji} {r.label}</span>
              <div className="ch-bar"><div style={{ width: `${Math.min(100, (r.list.length / r.goal) * 100)}%` }} /></div>
              <span className="ch-row-num">{r.list.length} / {r.goal}{r.list.length >= r.goal ? " ✓" : ""}</span>
              {rest > 0 && !expired && (
                <span className="ch-row-hint muted">ещё {rest} — {perWeek >= 1 ? `≈ ${Math.round(perWeek * 10) / 10} в неделю` : `≈ 1 в ${Math.round(7 / Math.max(perWeek, 0.01))} дн.`}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="ch-actions">
        {totalDone > 0 && <span className="time-link" onClick={() => setOpen(!open)}>{open ? "Скрыть засчитанное" : "Что засчитано"}</span>}
        {confirmDel ? (
          <span className="ch-del-confirm">Удалить челлендж?
            <button type="button" onClick={async () => { await deleteEntity(c.id); onChanged(); }}>Да</button>
            <button type="button" onClick={() => setConfirmDel(false)}>Нет</button>
          </span>
        ) : <span className="time-link ch-del" onClick={() => setConfirmDel(true)}>Удалить</span>}
      </div>
      {open && (
        <div className="ch-list">
          {rows.flatMap(r => r.list.map(e => <div key={e.id}>{r.emoji} {e.name} <span className="muted">· {dateRu(e.attributes!.done_at)}</span></div>))}
        </div>
      )}

      {party && createPortal(
        <div className="milestone-bg" onClick={() => setParty(false)}>
          <Confetti />
          <div className="milestone-card big" onClick={e => e.stopPropagation()}>
            <div className="milestone-emoji">🏆</div>
            <div className="milestone-title">Челлендж выполнен!</div>
            <div className="milestone-text">«{c.name}»</div>
            <div className="milestone-sub">{rows.map(r => `${r.goal} ${plural(r.goal, r.forms)}`).join(" · ")}{left > 0 ? ` — и ещё ${daysWord(left)} в запасе` : ""}</div>
            <button onClick={() => setParty(false)}>Я молодец 🎉</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function Challenges({ challenges, media, profile, onChanged }: { challenges: Entity[]; media: Entity[]; profile: string; onChanged: () => void }) {
  const [creating, setCreating] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const today = todayStr();
  const sorted = [...challenges].sort((a, b) => String(a.attributes?.deadline).localeCompare(String(b.attributes?.deadline)));
  const isOld = (c: Entity) => c.attributes?.deadline < today;
  const active = sorted.filter(c => !isOld(c));
  const old = sorted.filter(isOld).reverse();

  return (
    <section className="ch-section">
      <div className="ch-section-head">
        <h2 className="now-title" style={{ margin: 0 }}>🏁 Челленджи</h2>
        <button type="button" className="ch-new" onClick={() => setCreating(true)}>＋ Новый челлендж</button>
      </div>
      {active.length === 0 && (
        <div className="muted time-small ch-empty">Поставь себе цель: например, 10 фильмов и 2 книги до конца месяца. Всё, что отметишь пройденным, засчитается само.</div>
      )}
      {active.map(c => <ChallengeCard key={c.id} c={c} media={media} onChanged={onChanged} />)}
      {old.length > 0 && (
        <>
          <span className="time-link" onClick={() => setShowOld(!showOld)}>{showOld ? "Скрыть завершённые" : `Завершённые (${old.length})`}</span>
          {showOld && old.map(c => <ChallengeCard key={c.id} c={c} media={media} onChanged={onChanged} />)}
        </>
      )}
      {creating && <NewChallenge profile={profile} onClose={() => setCreating(false)} onDone={onChanged} />}
    </section>
  );
}
