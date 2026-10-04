import { useEffect, useMemo, useRef, useState } from "react";
import { Entity, createEntity, updateEntityField } from "../api";
import { todayStr } from "../dateUtils";
import { showToast } from "../toast";

// ============================================================
// Утренняя разминка для головы: Шульте → Струп → устный счёт.
// Результат дня сохраняется карточкой type="warmup" (одна на день),
// чтобы видеть свою "норму" и замечать тяжёлые дни.
// Никаких серий/стриков: пропуск — это просто обычный день.
// ============================================================

type Step = "intro" | "schulte" | "stroop" | "math" | "done";
type Mode = "full" | "short";

export interface WarmupResult {
  mode: Mode;
  schulte_sec?: number;
  schulte_errors?: number;
  stroop_correct?: number;
  stroop_total?: number;
  stroop_sec?: number;
  math_correct?: number;
  math_skipped?: number;
}

const NOTE_ITEMS = [
  { id: "water", text: "Стакан воды", hint: "сразу после пробуждения" },
  { id: "light", text: "Свет", hint: "открыть шторы или выйти на улицу на пару минут" },
  { id: "move", text: "3–5 минут движения", hint: "зарядка, турник или бой с тенью — лучший разогрев для головы" },
  { id: "nofeed", text: "Без ленты и мессенджеров", hint: "до разминки и первого рабочего дела" },
  { id: "main", text: "Записать главное дело дня", hint: "что именно сделать и какой нужен результат" },
  { id: "easy", text: "Начать с лёгкой рабочей задачи", hint: "за сложное — через 15–20 минут" },
];

function checklistKey(date: string) { return `lifeos_warmup_checklist_${date}`; }
function loadChecklist(date: string): string[] {
  try { return JSON.parse(localStorage.getItem(checklistKey(date)) || "[]"); } catch { return []; }
}
function saveChecklist(date: string, ids: string[]) {
  try { localStorage.setItem(checklistKey(date), JSON.stringify(ids)); } catch { /* not critical */ }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function fmtSec(sec: number): string {
  return `${sec.toFixed(1).replace(".", ",")} с`;
}

// ---------- 1. Таблица Шульте ----------
function Schulte({ onFinish }: { onFinish: (sec: number, errors: number) => void }) {
  const N = 25;
  const [cells] = useState(() => shuffle(Array.from({ length: N }, (_, i) => i + 1)));
  const [next, setNext] = useState(1);
  const [errors, setErrors] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (startAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [startAt]);

  function tap(n: number) {
    const start = startAt ?? Date.now();
    if (startAt === null) setStartAt(start);
    if (n === next) {
      if (n === N) { onFinish((Date.now() - start) / 1000, errors); return; }
      setNext(n + 1);
    } else if (n > next) {
      setErrors(e => e + 1);
      setWrong(n);
      setTimeout(() => setWrong(w => (w === n ? null : w)), 250);
    }
  }

  const elapsed = startAt ? (now - startAt) / 1000 : 0;
  return (
    <div className="warmup-stage">
      <div className="warmup-stage-head">
        <span className="suggestion-label">Шаг 1 · Таблица Шульте</span>
        <span className="warmup-timer">{fmtSec(elapsed)}</span>
      </div>
      <div className="muted" style={{ marginBottom: 10 }}>
        Нажимай числа по порядку от 1 до 25. Смотри в центр таблицы и ищи взглядом, не водя глазами по строкам. Таймер стартует с первого нажатия.
      </div>
      <div className="warmup-next">Найди: <b>{next}</b></div>
      <div className="schulte-grid">
        {cells.map(n => (
          <button key={n} type="button"
            className={`schulte-cell ${n < next ? "found" : ""} ${wrong === n ? "wrong" : ""}`}
            onClick={() => tap(n)}>{n}</button>
        ))}
      </div>
    </div>
  );
}

// ---------- 2. Тест Струпа ----------
const COLORS = [
  { id: "red", word: "КРАСНЫЙ", btn: "Красный", hex: "#E5533D" },
  { id: "blue", word: "СИНИЙ", btn: "Синий", hex: "#4C7FE8" },
  { id: "green", word: "ЗЕЛЁНЫЙ", btn: "Зелёный", hex: "#3FAE5E" },
  { id: "yellow", word: "ЖЁЛТЫЙ", btn: "Жёлтый", hex: "#E8C23A" },
];
const STROOP_TOTAL = 20;

function makeStroopTrial() {
  const word = COLORS[Math.floor(Math.random() * COLORS.length)];
  // ~75% несовпадений: именно они и разгоняют контроль внимания
  let ink = word;
  if (Math.random() < 0.75) {
    const others = COLORS.filter(c => c.id !== word.id);
    ink = others[Math.floor(Math.random() * others.length)];
  }
  return { word, ink };
}

function Stroop({ onFinish, onSkip }: { onFinish: (correct: number, total: number, sec: number) => void; onSkip: () => void }) {
  const [trial, setTrial] = useState(makeStroopTrial);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const startRef = useRef<number | null>(null);
  const btnOrder = useMemo(() => shuffle(COLORS), []);

  function answer(id: string) {
    if (startRef.current === null) startRef.current = Date.now();
    const ok = id === trial.ink.id;
    const newCorrect = correct + (ok ? 1 : 0);
    setFlash(ok ? "ok" : "bad");
    setTimeout(() => setFlash(null), 180);
    if (index + 1 >= STROOP_TOTAL) {
      onFinish(newCorrect, STROOP_TOTAL, (Date.now() - (startRef.current ?? Date.now())) / 1000);
      return;
    }
    setCorrect(newCorrect);
    setIndex(index + 1);
    let t = makeStroopTrial();
    while (t.word.id === trial.word.id && t.ink.id === trial.ink.id) t = makeStroopTrial();
    setTrial(t);
  }

  return (
    <div className="warmup-stage">
      <div className="warmup-stage-head">
        <span className="suggestion-label">Шаг 2 · Тест Струпа</span>
        <span className="warmup-timer">{index + 1} / {STROOP_TOTAL}</span>
      </div>
      <div className="muted" style={{ marginBottom: 10 }}>
        Выбирай <b>цвет, которым написано слово</b>, а не само слово. Быстро, но без спешки.
      </div>
      <div className={`stroop-box ${flash ?? ""}`}>
        <span style={{ color: trial.ink.hex }}>{trial.word.word}</span>
      </div>
      <div className="stroop-buttons">
        {btnOrder.map(c => (
          <button key={c.id} type="button" className="stroop-btn" onClick={() => answer(c.id)}>{c.btn}</button>
        ))}
      </div>
      <div className="warmup-skip" onClick={onSkip}>Пропустить шаг</div>
    </div>
  );
}

// ---------- 3. Устный счёт ----------
const MATH_SECONDS = 60;

function makeProblem(): { text: string; answer: number } {
  const kind = Math.floor(Math.random() * 4);
  const r = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  if (kind === 0) { const a = r(12, 89), b = r(3, 49); return { text: `${a} + ${b}`, answer: a + b }; }
  if (kind === 1) { const a = r(30, 99), b = r(3, a - 5); return { text: `${a} − ${b}`, answer: a - b }; }
  if (kind === 2) { const a = r(3, 9), b = r(3, 9); return { text: `${a} × ${b}`, answer: a * b }; }
  const b = r(3, 9), q = r(3, 9);
  return { text: `${b * q} ÷ ${b}`, answer: q };
}

function MentalMath({ onFinish, onSkip }: { onFinish: (correct: number, skipped: number) => void; onSkip: () => void }) {
  const [problem, setProblem] = useState(makeProblem);
  const [value, setValue] = useState("");
  const [correct, setCorrect] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const finishedRef = useRef(false);
  const correctRef = useRef(0);
  const skippedRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [startAt]);

  const left = startAt ? Math.max(0, MATH_SECONDS - (now - startAt) / 1000) : MATH_SECONDS;

  useEffect(() => {
    if (startAt !== null && left <= 0 && !finishedRef.current) {
      finishedRef.current = true;
      onFinish(correctRef.current, skippedRef.current);
    }
  }, [left, startAt]);

  function nextProblem() {
    let p = makeProblem();
    while (p.text === problem.text) p = makeProblem();
    setProblem(p);
    setValue("");
    inputRef.current?.focus();
  }

  function onChange(v: string) {
    const clean = v.replace(/[^0-9]/g, "");
    if (startAt === null && clean) setStartAt(Date.now());
    setValue(clean);
    if (clean && Number(clean) === problem.answer) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
      nextProblem();
    }
  }

  function skip() {
    if (startAt === null) setStartAt(Date.now());
    skippedRef.current += 1;
    setSkipped(skippedRef.current);
    nextProblem();
  }

  return (
    <div className="warmup-stage">
      <div className="warmup-stage-head">
        <span className="suggestion-label">Шаг 3 · Устный счёт</span>
        <span className="warmup-timer">{Math.ceil(left)} с</span>
      </div>
      <div className="muted" style={{ marginBottom: 10 }}>
        Минута на лёгкие примеры. Ответ засчитывается сам, как только введёшь верное число. Время пойдёт с первого ввода.
      </div>
      <div className="math-problem">{problem.text} = ?</div>
      <div className="addrow" style={{ maxWidth: 320, margin: "0 auto 10px" }}>
        <input ref={inputRef} autoFocus inputMode="numeric" value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && value) skip(); }} placeholder="Ответ" style={{ textAlign: "center", fontSize: "1.1rem" }} />
        <button type="button" className="btn-add-plus" onClick={skip} title="Не знаю — дальше">→</button>
      </div>
      <div className="muted" style={{ textAlign: "center" }}>Решено: {correct} · пропущено: {skipped}</div>
      <div className="warmup-skip" onClick={onSkip}>Пропустить шаг</div>
    </div>
  );
}

// ---------- Памятка: что сделать помимо сайта ----------
function MorningNote() {
  const today = todayStr();
  const [checked, setChecked] = useState<string[]>(() => loadChecklist(today));
  function toggle(id: string) {
    const next = checked.includes(id) ? checked.filter(x => x !== id) : [...checked, id];
    setChecked(next);
    saveChecklist(today, next);
  }
  return (
    <div className="warmup-note">
      <div className="suggestion-label">Обязательно помимо разминки на сайте</div>
      {NOTE_ITEMS.map(item => (
        <label key={item.id} className={`warmup-note-item ${checked.includes(item.id) ? "checked" : ""}`}>
          <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggle(item.id)} />
          <span><b>{item.text}</b> <span className="muted">— {item.hint}</span></span>
        </label>
      ))}
      <div className="warmup-note-footer">
        <b>Плохой день?</b> Минимальная версия: стакан воды, одна таблица Шульте и записать главное дело. Две минуты — и цепочка не рвётся.
        Разминка нужна, чтобы включиться, а не устать: за рекордами не гонимся.
      </div>
    </div>
  );
}

// ---------- Основная вкладка ----------
export default function WarmupTab({ items, onChanged, profile }: { items: Entity[]; onChanged: () => void; profile: string }) {
  const today = todayStr();
  const [step, setStep] = useState<Step>("intro");
  const [mode, setMode] = useState<Mode>("full");
  const [result, setResult] = useState<WarmupResult>({ mode: "full" });
  const [mainTask, setMainTask] = useState("");
  const [taskAdded, setTaskAdded] = useState(false);
  const [saving, setSaving] = useState(false);

  const history = useMemo(() =>
    items.filter(e => e.type === "warmup" && e.attributes?.date)
      .sort((a, b) => b.attributes.date.localeCompare(a.attributes.date)),
    [items]);
  const todayEntry = history.find(e => e.attributes.date === today);
  const pastSchulte = history.filter(e => e.attributes.date !== today && typeof e.attributes.schulte_sec === "number")
    .slice(0, 14).map(e => e.attributes.schulte_sec as number);
  const usualSchulte = median(pastSchulte);

  function start(m: Mode) {
    setMode(m);
    setResult({ mode: m });
    setTaskAdded(false);
    setMainTask("");
    setStep("schulte");
  }

  async function save(r: WarmupResult) {
    setSaving(true);
    try {
      const attrs: Record<string, any> = { ...r, date: today };
      if (todayEntry) {
        for (const [k, v] of Object.entries(attrs)) {
          if (v !== undefined) await updateEntityField(todayEntry.id, k, v);
        }
      } else {
        await createEntity("warmup", `Разминка ${today}`, attrs, "life", profile);
      }
      onChanged();
    } catch {
      showToast("Не удалось сохранить результат разминки");
    } finally {
      setSaving(false);
    }
  }

  function finishAll(r: WarmupResult) {
    setResult(r);
    setStep("done");
    save(r);
  }

  async function addMainTask() {
    const t = mainTask.trim();
    if (!t) return;
    await createEntity("task", t, { date: today }, "life", profile);
    setTaskAdded(true);
    showToast("Главное дело добавлено в задачи на сегодня");
    onChanged();
  }

  let verdict: string | null = null;
  if (step === "done" && typeof result.schulte_sec === "number" && usualSchulte && pastSchulte.length >= 3) {
    const ratio = result.schulte_sec / usualSchulte;
    if (ratio > 1.2) verdict = "Сегодня голова тяжелее обычного. Ничего страшного: сложные задачи лучше поставить чуть позже, а начать с простых.";
    else if (ratio < 0.9) verdict = "Сегодня ты в хорошей форме — можно браться за сложное пораньше.";
    else verdict = "Обычный рабочий уровень — в норме.";
  }

  return (
    <div className="view">
      <h1>Разминка</h1>

      {step === "intro" && (
        <>
          <div className="warmup-hero">
            <div className="suggestion-label">Утренний вход в рабочий режим</div>
            <div className="warmup-hero-text">
              Таблица Шульте → тест Струпа → минута устного счёта. Около 5 минут, чтобы не бросаться в бой с холодной головой.
            </div>
            {todayEntry && (
              <div className="muted" style={{ marginBottom: 10 }}>
                Сегодня уже сделано{typeof todayEntry.attributes.schulte_sec === "number" ? ` · Шульте ${fmtSec(todayEntry.attributes.schulte_sec)}` : ""}. Можно пройти ещё раз — результат дня обновится.
              </div>
            )}
            <div className="warmup-start-row">
              <button type="button" className="warmup-start" onClick={() => start("full")}>Начать разминку · ~5 мин</button>
              <button type="button" className="warmup-start secondary" onClick={() => start("short")}>Короткая · 1 мин</button>
            </div>
          </div>
          <MorningNote />
        </>
      )}

      {step === "schulte" && (
        <Schulte onFinish={(sec, errors) => {
          const r = { ...result, schulte_sec: Math.round(sec * 10) / 10, schulte_errors: errors };
          if (mode === "short") finishAll(r); else { setResult(r); setStep("stroop"); }
        }} />
      )}

      {step === "stroop" && (
        <Stroop
          onFinish={(c, t, sec) => { setResult(r => ({ ...r, stroop_correct: c, stroop_total: t, stroop_sec: Math.round(sec * 10) / 10 })); setStep("math"); }}
          onSkip={() => setStep("math")} />
      )}

      {step === "math" && (
        <MentalMath
          onFinish={(c, s) => finishAll({ ...result, math_correct: c, math_skipped: s })}
          onSkip={() => finishAll(result)} />
      )}

      {step === "done" && (
        <div className="warmup-stage">
          <div className="suggestion-label">Готово{saving ? " · сохраняю…" : ""}</div>
          <div className="warmup-results">
            {typeof result.schulte_sec === "number" && (
              <div className="warmup-stat"><span>Шульте</span><b>{fmtSec(result.schulte_sec)}</b>
                {usualSchulte && <small>обычно {fmtSec(usualSchulte)}</small>}</div>
            )}
            {typeof result.stroop_correct === "number" && (
              <div className="warmup-stat"><span>Струп</span><b>{result.stroop_correct}/{result.stroop_total}</b>
                <small>{fmtSec(result.stroop_sec || 0)}</small></div>
            )}
            {typeof result.math_correct === "number" && (
              <div className="warmup-stat"><span>Счёт за минуту</span><b>{result.math_correct}</b>
                <small>пропущено {result.math_skipped}</small></div>
            )}
          </div>
          {verdict && <div className="warmup-verdict">{verdict}</div>}

          <div className="suggestion-label" style={{ marginTop: 16 }}>Последний шаг — главное дело на сегодня</div>
          {taskAdded ? (
            <div className="muted">✓ Добавлено в задачи на сегодня. Хорошего дня!</div>
          ) : (
            <div className="addrow">
              <input value={mainTask} onChange={e => setMainTask(e.target.value)} placeholder="Что сделать и какой нужен результат…"
                onKeyDown={e => { if (e.key === "Enter") addMainTask(); }} />
              <button type="button" className="btn-add-plus" onClick={addMainTask}>+</button>
            </div>
          )}
          <div className="warmup-skip" onClick={() => setStep("intro")}>← К памятке</div>
        </div>
      )}

      {history.length > 0 && step === "intro" && (
        <>
          <div className="diary-date-label">Последние разминки</div>
          <div className="warmup-history">
            {history.slice(0, 14).map(e => {
              const a = e.attributes;
              return (
                <div key={e.id} className="warmup-history-row">
                  <span className="muted">{a.date.split("-").reverse().join(".")}</span>
                  <span>{typeof a.schulte_sec === "number" ? `Шульте ${fmtSec(a.schulte_sec)}` : "—"}</span>
                  <span className="muted">{typeof a.stroop_correct === "number" ? `Струп ${a.stroop_correct}/${a.stroop_total}` : ""}</span>
                  <span className="muted">{typeof a.math_correct === "number" ? `Счёт ${a.math_correct}` : ""}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Маленькая плашка на экране "Сегодня": зовёт на разминку или показывает, что она сделана.
export function WarmupBanner({ items, onOpen }: { items: Entity[]; onOpen: () => void }) {
  const today = todayStr();
  const done = items.find(e => e.type === "warmup" && e.attributes?.date === today);
  return (
    <div className={`warmup-banner ${done ? "done" : ""}`} onClick={onOpen}>
      <span>🧠</span>
      {done
        ? <span>Разминка сделана{typeof done.attributes.schulte_sec === "number" ? ` · Шульте ${fmtSec(done.attributes.schulte_sec)}` : ""}</span>
        : <span><b>Утренняя разминка</b> <span className="muted">· 5 минут, чтобы войти в рабочий режим</span></span>}
      <span className="warmup-banner-go">{done ? "Открыть" : "Начать →"}</span>
    </div>
  );
}
