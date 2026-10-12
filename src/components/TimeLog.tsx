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
type Plan = Record<MediaType, number>;
// История плана: каждая запись — какой план действовал начиная с момента `at`.
// План дня = последняя запись, сделанная ДО 00:00 этого дня.
type PlanHist = { at: string; b: Plan }[];

const planOf = (b: MediaBudget): Plan => ({ movie: b.movie, show: b.show, book: b.book, game: b.game });
const samePlan = (a: Plan, b: Plan) => MEDIA_TYPES.every(t => a[t] === b[t]);

function planForDay(hist: PlanHist, d: string, current: Plan): Plan {
  const midnight = new Date(d + "T00:00:00").getTime();
  let found: Plan | null = null;
  for (const h of hist) { if (new Date(h.at).getTime() <= midnight) found = h.b; }
  return found || hist[0]?.b || current;
}

function mondayOf(d: string): string {
  const wd = new Date(d + "T12:00").getDay(); // 0 = вс
  return addDaysStr(d, wd === 0 ? -6 : 1 - wd);
}

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

function shortDate(d: string) { const [, m, day] = d.split("-").map(Number); return `${day} ${MONTHS[m - 1]}`; }

export default function TimeLog({ entity, budget, profile, onChanged }: {
  entity: Entity | null; budget: MediaBudget; profile: string; onChanged: () => void;
}) {
  const [log, setLog] = useState<Log>(() => (entity?.attributes?.log as Log) || {});
  const [timer, setTimer] = useState<Timer>(() => (entity?.attributes?.log_timer as Timer) || null);
  const [day, setDay] = useState(todayStr());
  const [weekStart, setWeekStart] = useState(mondayOf(todayStr()));
  const [hist, setHist] = useState<PlanHist>(() => (entity?.attributes?.plan_hist as PlanHist) || []);
  const histTimer = useRef<number | undefined>(undefined);
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

  useEffect(() => {
    const h = entity?.attributes?.plan_hist as PlanHist | undefined;
    if (h && h.length >= hist.length) setHist(h);
  }, [entity?.attributes?.plan_hist]); // eslint-disable-line react-hooks/exhaustive-deps

  // Запоминаем план, когда он меняется (с паузой, чтобы ползунок не плодил записи).
  // Самая первая запись действует «всегда», чтобы у прошлых дней тоже был план.
  const cur = planOf(budget);
  useEffect(() => {
    window.clearTimeout(histTimer.current);
    histTimer.current = window.setTimeout(() => {
      const last = hist[hist.length - 1];
      if (last && samePlan(last.b, cur)) return;
      const entry = { at: hist.length ? new Date().toISOString() : "2000-01-01T00:00:00.000Z", b: cur };
      const next = [...hist, entry].slice(-300);
      setHist(next);
      if (entityRef.current) save("plan_hist", next);
    }, 3000);
    return () => window.clearTimeout(histTimer.current);
  }, [budget.movie, budget.show, budget.book, budget.game, hist.length, !!entity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Секундомер тикает раз в 15 секунд
  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => tick(x => x + 1), 15000);
    return () => window.clearInterval(id);
  }, [timer]);

  async function save(field: "log" | "log_timer" | "plan_hist", value: unknown) {
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
  const week = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i));
  const isCurrentWeek = weekStart === mondayOf(today);
  // день, за который записываем: выбранный, если он в этой неделе и не в будущем
  const entryDay = week.includes(day) && day <= today ? day : (isCurrentWeek ? today : week[6]);
  const dayLog = log[entryDay] || {};
  const dayPlans: Record<string, Plan> = Object.fromEntries(week.map(d => [d, planForDay(hist, d, cur)]));
  const weekPlan = Object.fromEntries(MEDIA_TYPES.map(t => [t, week.reduce((s, d) => s + dayPlans[d][t], 0)])) as Plan;
  const weekFact = Object.fromEntries(MEDIA_TYPES.map(t => [t, week.reduce((s, d) => s + (log[d]?.[t] || 0), 0)])) as Plan;
  const weekPlanTotal = MEDIA_TYPES.reduce((s, t) => s + weekPlan[t], 0);
  const weekFactTotal = MEDIA_TYPES.reduce((s, t) => s + weekFact[t], 0);
  const planToDate = week.filter(d => d <= today).reduce((s, d) => s + MEDIA_TYPES.reduce((x, t) => x + dayPlans[d][t], 0), 0);
  const weekMax = Math.max(...week.map(d => Math.max(sumDay(log[d]), MEDIA_TYPES.reduce((x, t) => x + dayPlans[d][t], 0))), 1);
  const timerMin = timer ? Math.floor((Date.now() - timer.start) / 60000) : 0;
  const pctTotal = weekPlanTotal > 0 ? Math.round((weekFactTotal / weekPlanTotal) * 100) : null;
  const diffStr = (d: number) => d === 0 ? "ровно по плану" : d > 0 ? `+${fmtMinutes(d)}` : `−${fmtMinutes(-d)}`;

  return (
    <div className="tlog">
      <div className="tlog-head">
        <h2>Дневник времени</h2>
        <div className="tlog-day">
          <button type="button" onClick={() => setWeekStart(addDaysStr(weekStart, -7))} aria-label="прошлая неделя">‹</button>
          <b>{isCurrentWeek ? "Эта неделя" : `${shortDate(weekStart)} — ${shortDate(addDaysStr(weekStart, 6))}`}</b>
          <button type="button" onClick={() => setWeekStart(addDaysStr(weekStart, 7))} disabled={isCurrentWeek} aria-label="следующая неделя">›</button>
        </div>
      </div>

      <div className="tlog-summary">
        За неделю <b>{fmtMinutes(weekFactTotal)}</b> из плана {fmtMinutes(weekPlanTotal)}
        {pctTotal !== null && <span className={`tlog-pill ${pctTotal >= 100 ? "ok" : ""}`}>{pctTotal}%</span>}
        {isCurrentWeek && <span className="muted">{shortDate(weekStart)} — {shortDate(addDaysStr(weekStart, 6))}</span>}
      </div>
      {isCurrentWeek && planToDate > 0 && (
        <div className="muted time-small" style={{ margin: "-6px 0 12px" }}>
          По плану к концу сегодня — {fmtMinutes(planToDate)}
          {weekFactTotal >= planToDate ? " · идёшь по графику 👍" : ` · отстаёшь на ${fmtMinutes(planToDate - weekFactTotal)}`}
        </div>
      )}

      {timer && (
        <div className="tlog-timer">
          <span className="tlog-dot" /> {MEDIA_META[timer.type].emoji} {MEDIA_META[timer.type].label}: идёт {fmtMinutes(timerMin)}
          <button type="button" onClick={stopTimer}>■ Стоп и записать</button>
        </div>
      )}

      <div className="tlog-rows">
        {MEDIA_TYPES.map(t => {
          const meta = MEDIA_META[t];
          const fact = weekFact[t];
          const plan = weekPlan[t];
          const dayFact = dayLog[t] || 0;
          const w = plan > 0 ? Math.min(100, (fact / plan) * 100) : fact > 0 ? 100 : 0;
          return (
            <div key={t} className="tlog-row tlog-row-week" style={{ ["--accent" as any]: meta.color }}>
              <div className="tlog-name">{meta.emoji} {meta.label}</div>
              <div className="tlog-bar"><div style={{ width: `${w}%` }} /></div>
              <div className="tlog-val">
                <b>{fact ? fmtMinutes(fact) : "0"}</b><span className="muted"> / {plan ? fmtMinutes(plan) : "—"}</span>
              </div>
              <div className="tlog-btns">
                {[15, 30, 60].map(v => (
                  <button type="button" key={v} onClick={() => setMinutes(entryDay, t, dayFact + v)}>+{v === 60 ? "1 ч" : v}</button>
                ))}
                {isCurrentWeek && entryDay === today && (timer?.type === t
                  ? <button type="button" className="tlog-stop" onClick={stopTimer}>■</button>
                  : <button type="button" className="tlog-start" onClick={() => startTimer(t)} title="Засечь время">▶</button>)}
              </div>
              <div className="tlog-sub muted">
                {plan > 0 && <span>{Math.round((fact / plan) * 100)}% · {diffStr(fact - plan)}</span>}
                <span className="tlog-dayedit">
                  {dayLabel(entryDay).toLowerCase()}:
                  <input type="number" min={0} step={5} value={dayFact || ""} placeholder="0"
                    onChange={ev => setMinutes(entryDay, t, Number(ev.target.value) || 0)} aria-label={`${meta.label}, минут за ${dayLabel(entryDay)}`} /> мин
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tlog-week">
        <div className="muted time-small">Нажми на день, чтобы записать или поправить время за него · пунктир — план дня</div>
        <div className="tlog-chart">
          {week.map(d => {
            const dl = log[d] || {};
            const tot = sumDay(dl);
            const pl = MEDIA_TYPES.reduce((s, t) => s + dayPlans[d][t], 0);
            const future = d > today;
            return (
              <div key={d} className={`tlog-col ${d === entryDay ? "on" : ""} ${future ? "future" : ""}`} onClick={() => !future && setDay(d)} title={`${dayLabel(d)}: ${fmtMinutes(tot)} из ${fmtMinutes(pl)}`}>
                <div className="tlog-stack">
                  {pl > 0 && <div className="tlog-plan" style={{ bottom: `${Math.min(100, (pl / weekMax) * 100)}%` }} />}
                  {MEDIA_TYPES.map(t => dl[t] ? <div key={t} style={{ height: `${(dl[t]! / weekMax) * 100}%`, background: MEDIA_META[t].color }} /> : null)}
                </div>
                <div className="tlog-cap">{tot ? fmtMinutes(tot) : "—"}</div>
                <div className="muted tlog-cap">{d === today ? "сег" : WD[new Date(d + "T12:00").getDay()]}</div>
              </div>
            );
          })}
        </div>
        <div className="muted time-small" style={{ marginTop: 8 }}>План недели — сумма планов каждого дня на 00:00. Если меняешь время в день, новый план начнёт считаться с завтрашнего дня.</div>
      </div>
    </div>
  );
}
