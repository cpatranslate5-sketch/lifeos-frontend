import { useEffect, useRef, useState } from "react";
import { Entity, createEntity, updateEntityField } from "../api";
import { todayStr, addDaysStr } from "../dateUtils";
import { showToast } from "../toast";
import { MEDIA_TYPES, MEDIA_META, MediaType, MediaBudget, BUDGET_TYPE, fmtMinutes } from "../mediaTime";

// ============================================================
// Дневник времени: сколько минут по факту ушло на кино, сериалы,
// книги и игры за день — рядом с планом из настроек.
// Хранится в той же карточке настроек (media_budget):
//   log       — { "2026-10-12": { movie: 45, book: 30 }, ... }
//   log_timer — { type, start } — запущенный секундомер (виден на всех устройствах)
// ============================================================

type DayLog = Partial<Record<MediaType, number>>;
type Log = Record<string, DayLog>;
type Timer = { type: MediaType; start: number } | null;

const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function dayLabel(d: string): string {
  const t = todayStr();
  if (d === t) return "Сегодня";
  if (d === addDaysStr(t, -1)) return "Вчера";
  const [y, m, day] = d.split("-").map(Number);
  const wd = WD[new Date(y, m - 1, day).getDay()];
  return `${day} ${MONTHS[m - 1]}, ${wd}`;
}
const sumDay = (d: DayLog | undefined) => MEDIA_TYPES.reduce((s, t) => s + (d?.[t] || 0), 0);

export default function TimeLog({ entity, budget, profile, onChanged }: {
  entity: Entity | null; budget: MediaBudget; profile: string; onChanged: () => void;
}) {
  const [log, setLog] = useState<Log>(() => (entity?.attributes?.log as Log) || {});
  const [timer, setTimer] = useState<Timer>(() => (entity?.attributes?.log_timer as Timer) || null);
  const [day, setDay] = useState(todayStr());
  const [, tick] = useState(0);
  const saveTimer = useRef<number | undefined>(undefined);
  const dirty = useRef(false);
  const entityRef = useRef(entity);
  entityRef.current = entity;

  // Подхватываем данные с сервера, если локально нет несохранённых правок
  useEffect(() => {
    if (dirty.current) return;
    setLog((entity?.attributes?.log as Log) || {});
    setTimer((entity?.attributes?.log_timer as Timer) || null);
  }, [entity?.attributes?.log, entity?.attributes?.log_timer]);

  // Секундомер тикает раз в 15 секунд
  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => tick(x => x + 1), 15000);
    return () => window.clearInterval(id);
  }, [timer]);

  async function save(field: "log" | "log_timer", value: unknown) {
    try {
      const ent = entityRef.current;
      if (ent) await updateEntityField(ent.id, field, value);
      else { await createEntity(BUDGET_TYPE, "Время на медиатеку", { ...budget, [field]: value }, "life", profile); onChanged(); }
    } catch { showToast("Не сохранилось — проверь интернет"); }
  }

  function setMinutes(d: string, t: MediaType, minutes: number) {
    const v = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
    const next: Log = { ...log, [d]: { ...(log[d] || {}), [t]: v } };
    if (!v) delete next[d][t];
    if (!Object.keys(next[d]).length) delete next[d];
    setLog(next);
    dirty.current = true;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => { await save("log", next); dirty.current = false; }, 700);
  }

  function startTimer(t: MediaType) {
    if (timer) stopTimer();
    const tm = { type: t, start: Date.now() };
    setTimer(tm);
    save("log_timer", tm);
    showToast(`Засекаю время: ${MEDIA_META[t].label.toLowerCase()}`);
  }

  function stopTimer() {
    if (!timer) return;
    const mins = Math.round((Date.now() - timer.start) / 60000);
    const d = todayStr();
    if (mins > 0) {
      setMinutes(d, timer.type, (log[d]?.[timer.type] || 0) + mins);
      showToast(`+${fmtMinutes(mins)} — ${MEDIA_META[timer.type].label.toLowerCase()}`);
    }
    setTimer(null);
    save("log_timer", null);
  }

  const today = todayStr();
  const dayLog = log[day] || {};
  const planTotal = MEDIA_TYPES.reduce((s, t) => s + budget[t], 0);
  const factTotal = sumDay(dayLog);
  const week = Array.from({ length: 7 }, (_, i) => addDaysStr(today, i - 6));
  const weekMax = Math.max(planTotal, ...week.map(d => sumDay(log[d])), 1);
  const timerMin = timer ? Math.floor((Date.now() - timer.start) / 60000) : 0;

  return (
    <div className="tlog">
      <div className="tlog-head">
        <h2>Дневник времени</h2>
        <div className="tlog-day">
          <button type="button" onClick={() => setDay(addDaysStr(day, -1))} aria-label="предыдущий день">‹</button>
          <b>{dayLabel(day)}</b>
          <button type="button" onClick={() => setDay(addDaysStr(day, 1))} disabled={day >= today} aria-label="следующий день">›</button>
        </div>
      </div>

      <div className="tlog-summary">
        Потрачено <b>{fmtMinutes(factTotal)}</b> из плана {fmtMinutes(planTotal)}
        {planTotal > 0 && <span className={`tlog-pill ${factTotal >= planTotal ? "ok" : ""}`}>{Math.round((factTotal / planTotal) * 100)}%</span>}
      </div>

      {timer && (
        <div className="tlog-timer">
          <span className="tlog-dot" /> {MEDIA_META[timer.type].emoji} {MEDIA_META[timer.type].label}: идёт {fmtMinutes(timerMin)}
          <button type="button" onClick={stopTimer}>■ Стоп и записать</button>
        </div>
      )}

      <div className="tlog-rows">
        {MEDIA_TYPES.map(t => {
          const meta = MEDIA_META[t];
          const fact = dayLog[t] || 0;
          const plan = budget[t];
          const w = plan > 0 ? Math.min(100, (fact / plan) * 100) : fact > 0 ? 100 : 0;
          return (
            <div key={t} className="tlog-row" style={{ ["--accent" as any]: meta.color }}>
              <div className="tlog-name">{meta.emoji} {meta.label}</div>
              <div className="tlog-bar"><div style={{ width: `${w}%` }} /></div>
              <div className="tlog-val">
                <input type="number" min={0} step={5} value={fact || ""} placeholder="0"
                  onChange={ev => setMinutes(day, t, Number(ev.target.value) || 0)} aria-label={`${meta.label}, минут`} />
                <span className="muted"> / {plan ? fmtMinutes(plan) : "—"}</span>
              </div>
              <div className="tlog-btns">
                {[15, 30, 60].map(v => (
                  <button type="button" key={v} onClick={() => setMinutes(day, t, fact + v)}>+{v === 60 ? "1 ч" : v}</button>
                ))}
                {day === today && (timer?.type === t
                  ? <button type="button" className="tlog-stop" onClick={stopTimer}>■</button>
                  : <button type="button" className="tlog-start" onClick={() => startTimer(t)} title="Засечь время">▶</button>)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="tlog-week">
        <div className="muted time-small">Последние 7 дней · линия — план на день</div>
        <div className="tlog-chart">
          {week.map(d => {
            const dl = log[d] || {};
            const tot = sumDay(dl);
            return (
              <div key={d} className={`tlog-col ${d === day ? "on" : ""}`} onClick={() => setDay(d)} title={`${dayLabel(d)}: ${fmtMinutes(tot)}`}>
                <div className="tlog-stack">
                  {planTotal > 0 && <div className="tlog-plan" style={{ bottom: `${(planTotal / weekMax) * 100}%` }} />}
                  {MEDIA_TYPES.map(t => dl[t] ? <div key={t} style={{ height: `${(dl[t]! / weekMax) * 100}%`, background: MEDIA_META[t].color }} /> : null)}
                </div>
                <div className="tlog-cap">{tot ? fmtMinutes(tot) : "—"}</div>
                <div className="muted tlog-cap">{d === today ? "сег" : WD[new Date(d + "T12:00").getDay()]}</div>
              </div>
            );
          })}
        </div>
        <div className="tlog-weeksum">
          {MEDIA_TYPES.map(t => {
            const fact = week.reduce((s, d) => s + (log[d]?.[t] || 0), 0);
            return <span key={t}>{MEDIA_META[t].emoji} {fmtMinutes(fact)}<span className="muted"> / {fmtMinutes(budget[t] * 7)}</span></span>;
          })}
        </div>
      </div>
    </div>
  );
}
