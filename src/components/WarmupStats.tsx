import { useEffect, useMemo, useRef, useState } from "react";
import { Entity } from "../api";
import { todayStr, addDaysStr, weekdayOf } from "../dateUtils";

// ============================================================
// Статистика разминок: динамика по каждому упражнению.
// Точки — отдельные дни, линия — скользящее среднее (сглаживает
// случайные хорошие/плохие утра, чтобы был виден реальный тренд).
// ============================================================

type Period = "14" | "30" | "90" | "all";
const PERIODS: [Period, string][] = [["14", "2 недели"], ["30", "Месяц"], ["90", "3 месяца"], ["all", "Всё время"]];

interface Point { date: string; value: number; avg: number; extra?: string }

interface Metric {
  key: string;
  title: string;
  unit: string;
  lowerIsBetter: boolean;
  hint: string;
  get: (a: Record<string, any>) => number | null;
  extra?: (a: Record<string, any>) => string | undefined;
  fmt: (v: number) => string;
}

const num = (v: number, digits = 1) => v.toFixed(digits).replace(".", ",");

const METRICS: Metric[] = [
  {
    key: "schulte", title: "Таблица Шульте", unit: "сек", lowerIsBetter: true,
    hint: "время на всю таблицу — чем меньше, тем лучше",
    get: a => typeof a.schulte_sec === "number" ? a.schulte_sec : null,
    extra: a => typeof a.schulte_errors === "number" ? `ошибок: ${a.schulte_errors}` : undefined,
    fmt: v => `${num(v)} с`,
  },
  {
    key: "stroop", title: "Тест Струпа", unit: "сек", lowerIsBetter: true,
    hint: "время на 20 карточек — чем меньше, тем лучше",
    get: a => typeof a.stroop_sec === "number" && a.stroop_sec > 0 ? a.stroop_sec : null,
    extra: a => typeof a.stroop_correct === "number" ? `верно ${a.stroop_correct} из ${a.stroop_total}` : undefined,
    fmt: v => `${num(v)} с`,
  },
  {
    key: "math", title: "Устный счёт", unit: "примеров", lowerIsBetter: false,
    hint: "решено за минуту — чем больше, тем лучше",
    get: a => typeof a.math_correct === "number" ? a.math_correct : null,
    extra: a => typeof a.math_skipped === "number" ? `пропущено: ${a.math_skipped}` : undefined,
    fmt: v => `${num(v, v % 1 === 0 ? 0 : 1)}`,
  },
];

const AVG_WINDOW = 5;     // скользящее среднее по 5 разминкам
const TREND_N = 5;        // "раньше" = первые 5 в периоде, "сейчас" = последние 5

function mean(xs: number[]) { return xs.reduce((s, x) => s + x, 0) / xs.length; }

function shortDate(d: string) {
  const [, m, day] = d.split("-");
  return `${day}.${m}`;
}

function buildPoints(entries: Entity[], m: Metric): Point[] {
  const raw = entries
    .map(e => ({ date: e.attributes.date as string, value: m.get(e.attributes), extra: m.extra?.(e.attributes) }))
    .filter((p): p is { date: string; value: number; extra: string | undefined } => p.value !== null);
  return raw.map((p, i) => {
    const win = raw.slice(Math.max(0, i - AVG_WINDOW + 1), i + 1).map(x => x.value);
    return { ...p, avg: mean(win) };
  });
}

type Trend = { kind: "few"; need: number } | { kind: "flat" | "better" | "worse"; pct: number; before: number; now: number };

function computeTrend(points: Point[], m: Metric): Trend {
  if (points.length < TREND_N + 1) return { kind: "few", need: TREND_N + 1 - points.length };
  const n = Math.min(TREND_N, Math.floor(points.length / 2));
  const before = mean(points.slice(0, n).map(p => p.value));
  const now = mean(points.slice(-n).map(p => p.value));
  const change = (now - before) / before;
  const improvement = m.lowerIsBetter ? -change : change;
  const pct = Math.round(Math.abs(change) * 100);
  if (pct < 3) return { kind: "flat", pct, before, now };
  return { kind: improvement > 0 ? "better" : "worse", pct, before, now };
}

// ---------- Линейный график с точками и скользящим средним ----------
function TrendChart({ points, m, baseline }: { points: Point[]; m: Pick<Metric, "title" | "fmt">; baseline?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 150, padL = 34, padR = 10, padT = 10, padB = 22;
  const vals = [...points.flatMap(p => [p.value, p.avg]), ...(baseline !== undefined ? [baseline] : [])];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.12); hi = hi + span * 0.12;

  const innerW = width - padL - padR, innerH = H - padT - padB;
  const x = (i: number) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * innerH;
  const ticks = [lo, (lo + hi) / 2, hi];
  const avgPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.avg).toFixed(1)}`).join(" ");

  function onMove(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const rel = clientX - rect.left - padL;
    const i = points.length === 1 ? 0 : Math.round((rel / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  const hp = hover !== null ? points[hover] : null;
  const tipLeft = hp ? Math.min(Math.max(x(hover!) - 70, 0), width - 140) : 0;

  return (
    <div className="wstat-chart" ref={wrapRef}
      onMouseMove={e => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
      onTouchStart={e => onMove(e.touches[0].clientX)} onTouchMove={e => onMove(e.touches[0].clientX)}
      onTouchEnd={() => setTimeout(() => setHover(null), 1500)}>
      <svg width={width} height={H} role="img" aria-label={`${m.title}: динамика`}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className="wstat-grid" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="wstat-axis">{num(t, hi - lo < 10 ? 1 : 0)}</text>
          </g>
        ))}
        {points.length > 0 && <>
          <text x={x(0)} y={H - 6} textAnchor={points.length === 1 ? "middle" : "start"} className="wstat-axis">{shortDate(points[0].date)}</text>
          {points.length > 1 && <text x={x(points.length - 1)} y={H - 6} textAnchor="end" className="wstat-axis">{shortDate(points[points.length - 1].date)}</text>}
        </>}
        {baseline !== undefined && <>
          <line x1={padL} x2={width - padR} y1={y(baseline)} y2={y(baseline)} className="wstat-baseline" />
          <text x={width - padR} y={y(baseline) - 4} textAnchor="end" className="wstat-axis">обычный уровень</text>
        </>}
        {hp && <line x1={x(hover!)} x2={x(hover!)} y1={padT} y2={padT + innerH} className="wstat-crosshair" />}
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 3.5} className={`wstat-dot ${hover === i ? "on" : ""}`} />
        ))}
        {points.length > 1 && <path d={avgPath} className="wstat-avg" />}
      </svg>
      {hp && (
        <div className="wstat-tip" style={{ left: tipLeft }}>
          <div className="wstat-tip-date">{hp.date.split("-").reverse().join(".")}</div>
          <div><b>{m.fmt(hp.value)}</b>{hp.extra ? <span className="muted"> · {hp.extra}</span> : null}</div>
          <div className="muted">среднее: {m.fmt(hp.avg)}</div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ entries, m }: { entries: Entity[]; m: Metric }) {
  const points = useMemo(() => buildPoints(entries, m), [entries, m]);
  if (points.length === 0) {
    return (
      <div className="wstat-card">
        <div className="wstat-card-head"><b>{m.title}</b></div>
        <div className="muted">В этом периоде данных нет{m.key !== "schulte" ? " — это упражнение есть только в полной разминке" : ""}.</div>
      </div>
    );
  }
  const trend = computeTrend(points, m);
  const best = m.lowerIsBetter ? Math.min(...points.map(p => p.value)) : Math.max(...points.map(p => p.value));
  const last = points[points.length - 1];

  return (
    <div className="wstat-card">
      <div className="wstat-card-head">
        <div>
          <b>{m.title}</b>
          <div className="muted" style={{ fontSize: "0.72rem" }}>{m.hint}</div>
        </div>
        {trend.kind === "few"
          ? <span className="wstat-badge">нужно ещё {trend.need} {trend.need === 1 ? "разминка" : trend.need < 5 ? "разминки" : "разминок"}</span>
          : <span className={`wstat-badge ${trend.kind}`}>
              {trend.kind === "better" ? `▲ лучше на ${trend.pct}%` : trend.kind === "worse" ? `▼ хуже на ${trend.pct}%` : "● стабильно"}
            </span>}
      </div>
      <div className="wstat-nums">
        <div><span>Последний</span><b>{m.fmt(last.value)}</b></div>
        <div><span>Среднее</span><b>{m.fmt(mean(points.map(p => p.value)))}</b></div>
        <div><span>Лучший</span><b>{m.fmt(best)}</b></div>
      </div>
      <TrendChart points={points} m={m} />
      {trend.kind !== "few" && (
        <div className="muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>
          Первые разминки периода в среднем {m.fmt(trend.before)}, последние — {m.fmt(trend.now)}.
        </div>
      )}
    </div>
  );
}


// ============================================================
// Общая картина: индекс формы (все упражнения одним числом),
// регулярность (календарь + серии) и дни недели.
// ============================================================

const MIN_FOR_MEDIAN = 3;

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// 100 = твой обычный уровень (медиана за всё время по каждому упражнению).
// 110 = в среднем на 10% лучше обычного, 90 = на 10% хуже.
function computeIndex(all: Entity[]): Map<string, { value: number; n: number }> {
  const medians = new Map<string, number>();
  for (const m of METRICS) {
    const vals = all.map(e => m.get(e.attributes)).filter((v): v is number => v !== null && v > 0);
    if (vals.length >= MIN_FOR_MEDIAN) medians.set(m.key, median(vals));
  }
  const res = new Map<string, { value: number; n: number }>();
  for (const e of all) {
    const ratios: number[] = [];
    for (const m of METRICS) {
      const med = medians.get(m.key);
      const v = m.get(e.attributes);
      if (!med || v === null || v <= 0) continue;
      const r = m.lowerIsBetter ? med / v : v / med;
      ratios.push(Math.min(1.5, Math.max(0.5, r)));
    }
    if (ratios.length) res.set(e.attributes.date, { value: mean(ratios) * 100, n: ratios.length });
  }
  return res;
}

function streaks(dates: Set<string>, today: string) {
  let current = 0;
  let d = dates.has(today) ? today : addDaysStr(today, -1);
  while (dates.has(d)) { current++; d = addDaysStr(d, -1); }
  const sorted = [...dates].sort();
  let best = 0, run = 0, prev = "";
  for (const s of sorted) {
    run = prev && addDaysStr(prev, 1) === s ? run + 1 : 1;
    best = Math.max(best, run);
    prev = s;
  }
  return { current, best };
}

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function isFull(a: Record<string, any>) {
  return a.mode === "full" || typeof a.math_correct === "number" || typeof a.stroop_correct === "number";
}

function Overview({ all, entries, days, today }: { all: Entity[]; entries: Entity[]; days: number | null; today: string }) {
  const index = useMemo(() => computeIndex(all), [all]);

  const points: Point[] = useMemo(() => {
    const raw = entries
      .map(e => ({ date: e.attributes.date as string, idx: index.get(e.attributes.date) }))
      .filter((p): p is { date: string; idx: { value: number; n: number } } => !!p.idx);
    return raw.map((p, i) => {
      const win = raw.slice(Math.max(0, i - AVG_WINDOW + 1), i + 1).map(x => x.idx.value);
      return { date: p.date, value: p.idx.value, avg: mean(win), extra: `упражнений: ${p.idx.n}` };
    });
  }, [entries, index]);

  const doneDates = useMemo(() => new Set(all.map(e => e.attributes.date as string)), [all]);
  const byDate = useMemo(() => new Map(all.map(e => [e.attributes.date as string, e])), [all]);
  const { current, best } = streaks(doneDates, today);

  // Календарь: для «всего времени» показываем последние 18 недель.
  const calDays = days ?? 126;
  const start = addDaysStr(today, -(calDays - 1));
  const gridStart = addDaysStr(start, -weekdayOf(start)); // выравниваем по понедельнику
  const firstDate = all.length ? (all[0].attributes.date as string) : today;
  const cells: { date: string; kind: "full" | "short" | "none" | "future" | "before" }[] = [];
  for (let d = gridStart; d <= addDaysStr(today, 6 - weekdayOf(today)); d = addDaysStr(d, 1)) {
    const e = byDate.get(d);
    cells.push({
      date: d,
      // дни до самой первой разминки не считаем пропусками
      kind: d > today ? "future" : d < start || d < firstDate ? "before" : e ? (isFull(e.attributes) ? "full" : "short") : "none",
    });
  }
  const weeks = Math.ceil(cells.length / 7);
  const inRange = cells.filter(c => c.kind !== "future" && c.kind !== "before").length;
  const doneInRange = cells.filter(c => c.kind === "full" || c.kind === "short").length;
  const pctDone = inRange ? Math.round((doneInRange / inRange) * 100) : 0;

  // Дни недели: средний индекс, если по дню хотя бы 2 разминки.
  const wd = WD.map((_, i) => {
    const vals = points.filter(p => weekdayOf(p.date) === i).map(p => p.value);
    return vals.length >= 2 ? mean(vals) : null;
  });
  const wdVals = wd.filter((v): v is number => v !== null);
  const showWd = wdVals.length >= 3;
  const wdBest = showWd ? wd.indexOf(Math.max(...wdVals)) : -1;
  const wdWorst = showWd ? wd.indexOf(Math.min(...wdVals)) : -1;

  const trend = points.length ? computeTrend(points, { lowerIsBetter: false } as Metric) : null;
  const last = points[points.length - 1];
  const fmtIdx = (v: number) => `${Math.round(v)}`;
  const level = (v: number) => v >= 105 ? "лучше обычного" : v <= 95 ? "ниже обычного" : "обычный уровень";

  return (
    <div className="wstat-card wstat-overview">
      <div className="wstat-card-head">
        <div>
          <b>Общая картина</b>
          <div className="muted" style={{ fontSize: "0.72rem" }}>все упражнения одним числом · 100 — твой обычный уровень</div>
        </div>
        {trend && (trend.kind === "few"
          ? <span className="wstat-badge">нужно ещё {trend.need} {trend.need === 1 ? "разминка" : trend.need < 5 ? "разминки" : "разминок"}</span>
          : <span className={`wstat-badge ${trend.kind}`}>
              {trend.kind === "better" ? `▲ форма растёт: +${trend.pct}%` : trend.kind === "worse" ? `▼ форма снизилась: −${trend.pct}%` : "● стабильно"}
            </span>)}
      </div>

      {points.length > 0 ? <>
        <div className="wstat-nums">
          <div><span>Последняя</span><b>{fmtIdx(last.value)}</b><small className="muted">{level(last.value)}</small></div>
          <div><span>Среднее за период</span><b>{fmtIdx(mean(points.map(p => p.value)))}</b></div>
          <div><span>Лучшее утро</span><b>{fmtIdx(Math.max(...points.map(p => p.value)))}</b></div>
        </div>
        <TrendChart points={points} m={{ title: "Индекс формы", fmt: fmtIdx }} baseline={100} />
      </> : <div className="muted" style={{ marginBottom: 8 }}>Индекс появится, когда наберётся хотя бы {MIN_FOR_MEDIAN} разминки.</div>}

      <div className="wstat-subhead">Регулярность</div>
      <div className="wstat-nums">
        <div><span>Серия сейчас</span><b>{current} {current === 1 ? "день" : current >= 2 && current <= 4 ? "дня" : "дней"}</b></div>
        <div><span>Рекорд серии</span><b>{best}</b></div>
        <div><span>Дней с разминкой</span><b>{pctDone}%</b></div>
      </div>
      <div className="wstat-cal-wrap">
        <div className="wstat-cal-labels">{WD.map((w, i) => <span key={w}>{i % 2 === 0 ? w : ""}</span>)}</div>
        <div className="wstat-cal" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 20px))` }}>
          {cells.map(c => (
            <span key={c.date} className={`wstat-cell ${c.kind} ${c.date === today ? "today" : ""}`}
              title={c.kind === "future" || c.kind === "before" ? "" : `${c.date.split("-").reverse().join(".")} — ${c.kind === "full" ? "полная" : c.kind === "short" ? "короткая" : "без разминки"}`} />
          ))}
        </div>
      </div>
      <div className="wstat-legend">
        <span><i className="wstat-cell full" /> полная</span>
        <span><i className="wstat-cell short" /> короткая</span>
        <span><i className="wstat-cell none" /> пропуск</span>
      </div>

      {showWd && <>
        <div className="wstat-subhead">По дням недели</div>
        <div className="wstat-wd">
          {wd.map((v, i) => (
            <div key={i} className={`wstat-wd-col ${i === wdBest ? "best" : ""} ${i === wdWorst ? "worst" : ""}`}>
              <div className="wstat-wd-bar-wrap">
                {v !== null && <div className="wstat-wd-bar" style={{ height: `${Math.max(8, Math.min(100, (v - 70) / 0.6))}%` }} />}
              </div>
              <b>{v !== null ? fmtIdx(v) : "—"}</b>
              <span>{WD[i]}</span>
            </div>
          ))}
        </div>
        <div className="muted" style={{ fontSize: "0.72rem", marginTop: 6 }}>
          Лучше всего голова работает {["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу", "в воскресенье"][wdBest]}, тяжелее всего — {["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу", "в воскресенье"][wdWorst]}.
        </div>
      </>}
    </div>
  );
}

export default function WarmupStats({ items }: { items: Entity[] }) {
  const [period, setPeriod] = useState<Period>("30");
  const [showAll, setShowAll] = useState(false);
  const today = todayStr();

  const all = useMemo(() =>
    items.filter(e => e.type === "warmup" && e.attributes?.date)
      .sort((a, b) => a.attributes.date.localeCompare(b.attributes.date)),
    [items]);

  const entries = useMemo(() => {
    if (period === "all") return all;
    const from = addDaysStr(today, -Number(period) + 1);
    return all.filter(e => e.attributes.date >= from);
  }, [all, period, today]);

  if (all.length === 0) {
    return <div className="muted" style={{ marginTop: 8 }}>Статистика появится после первой разминки.</div>;
  }

  const days = period === "all" ? null : Number(period);
  const list = [...all].reverse();

  return (
    <div>
      <div className="wstat-periods">
        {PERIODS.map(([k, l]) => (
          <span key={k} className={`wstat-period ${period === k ? "on" : ""}`} onClick={() => setPeriod(k)}>{l}</span>
        ))}
      </div>

      <div className="wstat-summary">
        <div><b>{entries.length}</b><span>разминок{days ? ` за ${days} дн.` : " всего"}</span></div>
        <div><b>{entries.filter(e => e.attributes.mode === "full" || typeof e.attributes.math_correct === "number" || typeof e.attributes.stroop_correct === "number").length}</b><span>полных</span></div>
        <div><b>{all.length}</b><span>всего за всё время</span></div>
      </div>

      <Overview all={all} entries={entries} days={days} today={today} />

      <div className="wstat-section-label">По упражнениям</div>
      {METRICS.map(m => <MetricCard key={m.key} entries={entries} m={m} />)}

      <div className="muted" style={{ fontSize: "0.72rem", margin: "4px 2px 12px", lineHeight: 1.45 }}>
        Точки — отдельные дни, линия — среднее по последним {AVG_WINDOW} разминкам. Одно плохое утро ничего не значит: смотри на линию.
        Тренд сравнивает первые и последние разминки выбранного периода.
      </div>

      <div className="diary-date-label" style={{ cursor: "pointer" }} onClick={() => setShowAll(!showAll)}>
        Все разминки ({all.length}) {showAll ? "▲" : "▼"}
      </div>
      {showAll && (
        <div className="warmup-history">
          {list.map(e => {
            const a = e.attributes;
            return (
              <div key={e.id} className="warmup-history-row">
                <span className="muted">{a.date.split("-").reverse().join(".")}</span>
                <span>{typeof a.schulte_sec === "number" ? `Шульте ${num(a.schulte_sec)} с` : "—"}</span>
                <span className="muted">{typeof a.stroop_correct === "number" ? `Струп ${a.stroop_correct}/${a.stroop_total}${a.stroop_sec ? `, ${num(a.stroop_sec)} с` : ""}` : ""}</span>
                <span className="muted">{typeof a.math_correct === "number" ? `Счёт ${a.math_correct}` : ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
