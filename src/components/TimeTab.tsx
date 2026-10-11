import { useEffect, useMemo, useRef, useState } from "react";
import { Entity, createEntity, updateEntityField, fillDurations } from "../api";
import { todayStr, addDaysStr } from "../dateUtils";
import { showToast } from "../toast";
import DurationField from "./DurationField";
import {
  MEDIA_TYPES, MEDIA_META, MediaType, MediaBudget, BUDGET_TYPE, readBudget, computeTotals,
  fmtHours, fmtMinutes, fmtDays, rememberPagesPerHour, TypeTotals, plural, isPending, itemMinutes, isEstimate,
} from "../mediaTime";

// ============================================================
// «⏳ Время»: сколько уйдёт на всё непросмотренное/непрочитанное,
// если реально тратить заданное количество минут в день.
// Разделы идут параллельно (книга вечером, сериал за ужином),
// поэтому общий срок — это самый долгий из разделов.
// ============================================================

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function fmtFinishDate(days: number): string {
  const d = addDaysStr(todayStr(), Math.ceil(days));
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS_GEN[m - 1]} ${y}`;
}

function daysFor(t: TypeTotals, perDay: number): number | null {
  if (t.totalMin <= 0) return 0;
  if (perDay <= 0) return null;
  return t.totalMin / perDay;
}

const PRESETS = [15, 30, 60, 120];

export default function TimeTab({ items, onChanged, profile, space }: { items: Entity[]; onChanged: () => void; profile: string; space: string }) {
  const { entity, budget: saved } = readBudget(items);
  const [budget, setBudget] = useState<MediaBudget>(saved);
  const [filling, setFilling] = useState(false);
  const [showList, setShowList] = useState<"missing" | "ai" | null>(null);
  const loadedFor = useRef<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  // Подхватываем сохранённые настройки, когда карточка настроек загрузилась.
  useEffect(() => {
    const key = entity?.id ?? "none";
    if (loadedFor.current !== key) { loadedFor.current = key; setBudget(saved); }
  }, [entity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { rememberPagesPerHour(budget.pages_per_hour); }, [budget.pages_per_hour]);

  function change<K extends keyof MediaBudget>(k: K, v: number) {
    const next = { ...budget, [k]: v };
    setBudget(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        if (entity) await updateEntityField(entity.id, k, v);
        else { await createEntity(BUDGET_TYPE, "Время на медиатеку", next, "life", profile); onChanged(); }
      } catch { showToast("Не удалось сохранить настройку"); }
    }, 600);
  }

  const totals = useMemo(
    () => MEDIA_TYPES.map(t => computeTotals(items, t, budget.pages_per_hour)),
    [items, budget.pages_per_hour]);

  const totalMin = totals.reduce((s, t) => s + t.totalMin, 0);
  const totalPending = totals.reduce((s, t) => s + t.pending, 0);
  const missing = totals.reduce((s, t) => s + (t.pending - t.withDuration), 0);
  const aiCount = totals.reduce((s, t) => s + t.aiCount, 0);
  const perDayTotal = MEDIA_TYPES.reduce((s, t) => s + (totals.find(x => x.type === t)!.pending ? budget[t] : 0), 0);
  const spans = totals.map(t => ({ t, days: daysFor(t, budget[t.type]) }));
  const unbudgeted = spans.filter(s => s.days === null && s.t.totalMin > 0);
  const finiteDays = spans.map(s => s.days).filter((d): d is number => d !== null);
  const overallDays = finiteDays.length ? Math.max(...finiteDays) : 0;
  const slowest = spans.filter(s => s.days !== null && s.days === overallDays && overallDays > 0)[0];

  const typeOrder = (e: Entity) => MEDIA_TYPES.indexOf(e.type as MediaType);
  const pendingMedia = items.filter(e => MEDIA_TYPES.includes(e.type as MediaType) && isPending(e));
  const missingList = pendingMedia.filter(e => itemMinutes(e, budget.pages_per_hour) === null)
    .sort((a, b) => typeOrder(a) - typeOrder(b) || a.name.localeCompare(b.name, "ru"));
  const aiList = pendingMedia.filter(e => itemMinutes(e, budget.pages_per_hour) !== null && isEstimate(e))
    .sort((a, b) => typeOrder(a) - typeOrder(b) || a.name.localeCompare(b.name, "ru"));
  const shownList = showList === "missing" ? missingList : showList === "ai" ? aiList : [];

  async function runFill() {
    setFilling(true);
    try {
      const spaceForFill = space === "general" ? "life" : space;
      const r = await fillDurations(profile, spaceForFill);
      onChanged();
      showToast(r.checked === 0 ? "У всех карточек уже есть длительность"
        : `Заполнено: ${r.from_catalog + r.from_ai} из ${r.checked}` + (r.from_ai ? ` (оценка Claude: ${r.from_ai})` : ""));
    } catch {
      showToast("Не удалось заполнить — попробуйте ещё раз");
    } finally {
      setFilling(false);
    }
  }

  return (
    <div className="view time-tab">
      <h1>Время на медиатеку</h1>

      <div className="time-hero">
        <div className="time-hero-label">Всё непросмотренное и непрочитанное</div>
        <div className="time-hero-big">{fmtHours(totalMin)}</div>
        <div className="time-hero-sub">{totalPending} {plural(totalPending, "позиция", "позиции", "позиций")} · это {fmtDays(totalMin / 60 / 24)} без сна и перерывов</div>
        {totalMin > 0 && (
          <div className="time-hero-result">
            {finiteDays.length === 0 ? (
              <>Время в день не задано — поставь минуты в разделах ниже.</>
            ) : (
              <>
                Если тратить <b>{fmtMinutes(perDayTotal)} в день</b>, всё закончишь через <b>{fmtDays(overallDays)}</b>
                {overallDays > 0 && <> — примерно к <b>{fmtFinishDate(overallDays)}</b></>}.
                {slowest && finiteDays.length > 1 && <div className="muted" style={{ marginTop: 4 }}>Дольше всего — {MEDIA_META[slowest.t.type].label.toLowerCase()}: остальное закончится раньше.</div>}
              </>
            )}
            {unbudgeted.length > 0 && (
              <div className="muted" style={{ marginTop: 4 }}>
                Не учтены (0 минут в день): {unbudgeted.map(s => MEDIA_META[s.t.type].label.toLowerCase()).join(", ")}.
              </div>
            )}
          </div>
        )}
      </div>

      {(missing > 0 || aiCount > 0) && (
        <div className="time-note">
          {missing > 0 && (
            <div>
              У <b>{missing}</b> {plural(missing, "карточки", "карточек", "карточек")} нет длительности — пока считаю их по среднему в разделе.{" "}
              <span className="time-link" onClick={() => setShowList(showList === "missing" ? null : "missing")}>{showList === "missing" ? "Скрыть" : "Показать"}</span>
            </div>
          )}
          {aiCount > 0 && (
            <div className="muted">
              ≈ {aiCount} — оценки Claude, их можно поправить.{" "}
              <span className="time-link" onClick={() => setShowList(showList === "ai" ? null : "ai")}>{showList === "ai" ? "Скрыть" : "Показать и поправить"}</span>
            </div>
          )}
          {shownList.length > 0 && (
            <div className="time-list">
              {shownList.map((e, i) => (
                <div key={e.id}>
                  {(i === 0 || shownList[i - 1].type !== e.type) && (
                    <div className="time-list-group">{MEDIA_META[e.type as MediaType].emoji} {MEDIA_META[e.type as MediaType].label}</div>
                  )}
                  <div className="time-list-row">
                    <span className="time-list-name">{e.name}</span>
                    <DurationField e={e} onChanged={onChanged} />
                  </div>
                </div>
              ))}
              <div className="muted time-small" style={{ marginTop: 6 }}>Нажми на цифру или ✎, чтобы вписать своё значение — оно перестанет считаться оценкой.</div>
            </div>
          )}
          {missing > 0 && (
            <button type="button" className="time-fill-btn" disabled={filling} onClick={runFill}>
              {filling ? "Ищу длительность… это может занять минуту" : "Заполнить длительность автоматически"}
            </button>
          )}
        </div>
      )}

      <div className="time-grid">
        {totals.map(t => {
          const meta = MEDIA_META[t.type];
          const perDay = budget[t.type];
          const days = daysFor(t, perDay);
          return (
            <div key={t.type} className="time-card" style={{ ["--accent" as any]: meta.color }}>
              <div className="time-card-head">
                <b>{meta.emoji} {meta.label}</b>
                <span className="muted">{t.pending} не {t.type === "book" ? "прочитано" : t.type === "game" ? "пройдено" : "просмотрено"}{t.inProgress ? ` · ${t.inProgress} в процессе` : ""}</span>
              </div>

              {t.pending === 0 ? (
                <div className="muted">Здесь всё {t.type === "book" ? "прочитано" : t.type === "game" ? "пройдено" : "просмотрено"} 🎉</div>
              ) : <>
                <div className="time-card-total">{fmtHours(t.totalMin)}</div>
                {t.withDuration < t.pending && (
                  <div className="muted time-small">из них ≈ {fmtHours(t.estimatedMin)} — по среднему для {t.pending - t.withDuration} без длительности</div>
                )}

                <div className="time-budget">
                  <div className="time-budget-row">
                    <span>В день</span>
                    <b>{perDay === 0 ? "не трачу" : fmtMinutes(perDay)}</b>
                  </div>
                  <input type="range" min={0} max={240} step={5} value={perDay}
                    onChange={ev => change(t.type, Number(ev.target.value))} />
                  <div className="time-presets">
                    {PRESETS.map(p => (
                      <span key={p} className={perDay === p ? "on" : ""} onClick={() => change(t.type, p)}>{fmtMinutes(p)}</span>
                    ))}
                  </div>
                </div>

                <div className="time-result">
                  {days === null ? <span className="muted">При 0 минут в день — никогда</span>
                    : <>≈ <b>{fmtDays(days)}</b><span className="muted"> · до {fmtFinishDate(days)}</span></>}
                </div>

                {t.type === "book" && (
                  <div className="time-speed">
                    <span className="muted">Скорость чтения</span>
                    <input type="number" min={5} max={200} value={budget.pages_per_hour}
                      onChange={ev => { const v = Number(ev.target.value); if (v > 0) change("pages_per_hour", v); }} />
                    <span className="muted">стр/час</span>
                  </div>
                )}

                {t.longest.length > 0 && (
                  <div className="time-longest">
                    <div className="muted time-small">Самое длинное:</div>
                    {t.longest.map(x => (
                      <div key={x.e.id} className="time-longest-row">
                        <span>{x.e.name}</span>
                        <span className="muted">{x.e.attributes?.duration_source === "ai" ? "≈ " : ""}{fmtMinutes(x.min)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>}
            </div>
          );
        })}
      </div>

      <div className="muted time-small" style={{ margin: "6px 2px 16px", lineHeight: 1.45 }}>
        Считается всё, что ещё не отмечено как просмотренное/прочитанное/пройденное (включая «в процессе» — целиком).
        Разделы идут параллельно, поэтому общий срок — по самому долгому из них.
      </div>
    </div>
  );
}
