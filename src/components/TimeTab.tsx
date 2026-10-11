import { useEffect, useMemo, useRef, useState } from "react";
import { Entity, createEntity, updateEntityField, fillDurations } from "../api";
import { todayStr, addDaysStr } from "../dateUtils";
import { showToast } from "../toast";
import DurationField from "./DurationField";
import SeasonsField from "./SeasonsField";
import ReadingTest from "./ReadingTest";
import {
  MEDIA_TYPES, MEDIA_META, MediaType, MediaBudget, BUDGET_TYPE, readBudget, computeTotals,
  fmtHours, fmtMinutes, fmtDays, rememberPagesPerHour, TypeTotals, plural, isPending, itemMinutes, isEstimate,
  seasonInfo,
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

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const round5 = (v: number) => Math.max(0, Math.round(v / 5) * 5);

const PRESETS = [15, 30, 60, 120];
const MAX_TOTAL = 16 * 60;

type ListKind = "missing" | "ai" | "ongoing" | null;

export default function TimeTab({ items, onChanged, profile, space }: { items: Entity[]; onChanged: () => void; profile: string; space: string }) {
  const { entity, budget: saved } = readBudget(items);
  const [budget, setBudget] = useState<MediaBudget>(saved);
  const [filling, setFilling] = useState(false);
  const [showList, setShowList] = useState<ListKind>(null);
  const [testOpen, setTestOpen] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const pendingSave = useRef<Partial<MediaBudget>>({});
  const entityRef = useRef<Entity | null>(entity);
  entityRef.current = entity;

  // Подхватываем сохранённые настройки, когда карточка настроек загрузилась.
  useEffect(() => {
    const key = entity?.id ?? "none";
    if (loadedFor.current !== key) { loadedFor.current = key; setBudget(saved); }
  }, [entity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { rememberPagesPerHour(budget.pages_per_hour); }, [budget.pages_per_hour]);

  function changeMany(patch: Partial<MediaBudget>) {
    const next = { ...budget, ...patch };
    setBudget(next);
    pendingSave.current = { ...pendingSave.current, ...patch };
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const toSave = pendingSave.current;
      pendingSave.current = {};
      try {
        const ent = entityRef.current;
        if (ent) { for (const [k, v] of Object.entries(toSave)) await updateEntityField(ent.id, k, v); }
        else { await createEntity(BUDGET_TYPE, "Время на медиатеку", next, "life", profile); onChanged(); }
      } catch { showToast("Не удалось сохранить настройку"); }
    }, 600);
  }
  const change = <K extends keyof MediaBudget>(k: K, v: number) => changeMany({ [k]: v } as Partial<MediaBudget>);

  const includeFuture = budget.include_future !== 0;
  const totals = useMemo(
    () => MEDIA_TYPES.map(t => computeTotals(items, t, budget.pages_per_hour, includeFuture)),
    [items, budget.pages_per_hour, includeFuture]);

  const totalMin = totals.reduce((s, t) => s + t.totalMin, 0);
  const doneMin = totals.reduce((s, t) => s + t.doneMin, 0);
  const contentMin = doneMin + totalMin;
  const totalPending = totals.reduce((s, t) => s + t.pending, 0);
  const missing = totals.reduce((s, t) => s + (t.pending - t.withDuration), 0);
  const aiCount = totals.reduce((s, t) => s + t.aiCount, 0);
  const activeTypes = MEDIA_TYPES.filter(t => totals.find(x => x.type === t)!.pending > 0);
  const perDayTotal = activeTypes.reduce((s, t) => s + budget[t], 0);
  const spans = totals.map(t => ({ t, days: daysFor(t, budget[t.type]) }));
  const unbudgeted = spans.filter(s => s.days === null && s.t.totalMin > 0);
  const finiteDays = spans.map(s => s.days).filter((d): d is number => d !== null);
  const overallDays = finiteDays.length ? Math.max(...finiteDays) : 0;
  const slowest = spans.filter(s => s.days !== null && s.days === overallDays && overallDays > 0)[0];

  // Общее время в день меняем стрелками — разделы масштабируются пропорционально.
  function setTotalPerDay(target: number) {
    target = Math.max(0, Math.min(MAX_TOTAL, target));
    if (!activeTypes.length) return;
    const cur = perDayTotal;
    const patch: Partial<MediaBudget> = {};
    if (cur <= 0) {
      const each = round5(target / activeTypes.length);
      activeTypes.forEach(t => { patch[t] = each; });
    } else {
      activeTypes.forEach(t => { patch[t] = round5((budget[t] * target) / cur); });
    }
    // подгоняем округление, чтобы сумма совпала с целью
    const sum = activeTypes.reduce((s, t) => s + (patch[t] as number), 0);
    const diff = round5(target) - sum;
    if (diff !== 0) {
      const biggest = [...activeTypes].sort((a, b) => (patch[b] as number) - (patch[a] as number))[0];
      patch[biggest] = Math.max(0, (patch[biggest] as number) + diff);
    }
    changeMany(patch);
  }

  const typeOrder = (e: Entity) => MEDIA_TYPES.indexOf(e.type as MediaType);
  const byTypeName = (a: Entity, b: Entity) => typeOrder(a) - typeOrder(b) || a.name.localeCompare(b.name, "ru");
  const pendingMedia = items.filter(e => MEDIA_TYPES.includes(e.type as MediaType) && isPending(e));
  const missingList = pendingMedia.filter(e => itemMinutes(e, budget.pages_per_hour) === null).sort(byTypeName);
  const aiList = pendingMedia.filter(e => itemMinutes(e, budget.pages_per_hour) !== null && isEstimate(e)).sort(byTypeName);
  const ongoingList = pendingMedia.filter(e => e.type === "show" && seasonInfo(e).ongoing).sort(byTypeName);
  const shownList = showList === "missing" ? missingList : showList === "ai" ? aiList : showList === "ongoing" ? ongoingList : [];
  const toggleList = (k: ListKind) => setShowList(showList === k ? null : k);

  async function runFill() {
    setFilling(true);
    try {
      const spaceForFill = space === "general" ? "life" : space;
      const r = await fillDurations(profile, spaceForFill, true);
      onChanged();
      showToast(r.checked === 0 ? "У всех карточек уже есть длительность"
        : `Заполнено: ${r.from_catalog + r.from_ai}` + (r.from_ai ? ` (оценка Claude: ${r.from_ai})` : "") + (r.not_filled ? ` · не нашлось: ${r.not_filled}` : ""));
    } catch {
      showToast("Не удалось заполнить — попробуйте ещё раз");
    } finally {
      setFilling(false);
    }
  }

  const perH = Math.floor(perDayTotal / 60), perM = perDayTotal % 60;
  const doneShare = pct(doneMin, contentMin);

  return (
    <div className="view time-tab">
      <h1>Время на медиатеку</h1>

      <div className="time-hero">
        <div className="time-hero-stats">
          <div><span>Всего в медиатеке</span><b>{fmtHours(contentMin)}</b></div>
          <div><span>Просмотрено и прочитано</span><b>{fmtHours(doneMin)}</b><small>{doneShare}%</small></div>
          <div className="main"><span>Осталось</span><b>{fmtHours(totalMin)}</b><small>{100 - doneShare}%</small></div>
        </div>
        {contentMin > 0 && (
          <div className="time-progress" title={`Пройдено ${doneShare}%`}>
            <div style={{ width: `${doneShare}%` }} />
          </div>
        )}
        <div className="time-hero-sub">
          Осталось {totalPending} {plural(totalPending, "позиция", "позиции", "позиций")} — это {fmtDays(totalMin / 60 / 24)} без сна и перерывов
        </div>

        {totalMin > 0 && (
          <div className="time-hero-result">
            <span>Если тратить</span>
            <span className="time-stepper">
              <button type="button" onClick={() => setTotalPerDay(perDayTotal - 60)} aria-label="минус час">−</button>
              <b>{perH} ч</b>
              <button type="button" onClick={() => setTotalPerDay(perDayTotal + 60)} aria-label="плюс час">+</button>
            </span>
            <span className="time-stepper">
              <button type="button" onClick={() => setTotalPerDay(perDayTotal - 5)} aria-label="минус 5 минут">−</button>
              <b>{perM} мин</b>
              <button type="button" onClick={() => setTotalPerDay(perDayTotal + 5)} aria-label="плюс 5 минут">+</button>
            </span>
            <span>в день,</span>{" "}
            {finiteDays.length === 0 || perDayTotal === 0 ? (
              <span>— никогда не закончишь 🙂 Добавь времени стрелками.</span>
            ) : (
              <span>
                всё закончишь через <b>{fmtDays(overallDays)}</b>
                {overallDays > 0 && <> — примерно к <b>{fmtFinishDate(overallDays)}</b></>}.
              </span>
            )}
            <div className="muted time-small" style={{ marginTop: 6, width: "100%" }}>
              Стрелки меняют время всех разделов сразу, сохраняя пропорции. Точнее — ползунками в разделах ниже.
              {slowest && finiteDays.length > 1 && <> Дольше всего — {MEDIA_META[slowest.t.type].label.toLowerCase()}.</>}
              {unbudgeted.length > 0 && <> Не учтены (0 минут в день): {unbudgeted.map(s => MEDIA_META[s.t.type].label.toLowerCase()).join(", ")}.</>}
            </div>
          </div>
        )}
      </div>

      {(missing > 0 || aiCount > 0) && (
        <div className="time-note">
          {missing > 0 && <div>У <b>{missing}</b> {plural(missing, "карточки", "карточек", "карточек")} нет длительности — пока считаю их по среднему в разделе.</div>}
          {aiCount > 0 && (
            <div className="muted">
              ≈ {aiCount} — оценки Claude, их можно поправить.{" "}
              <span className="time-link" onClick={() => toggleList("ai")}>{showList === "ai" ? "Скрыть" : "Показать и поправить"}</span>
            </div>
          )}
          <div className="time-note-actions">
            {missing > 0 && (
              <button type="button" className="time-fill-btn" disabled={filling} onClick={runFill}>
                {filling ? "Ищу длительность… это может занять минуту" : "Заполнить длительность автоматически"}
              </button>
            )}
            {missing > 0 && (
              <button type="button" className="time-fill-btn secondary" onClick={() => toggleList("missing")}>
                {showList === "missing" ? "Скрыть незаполненные" : "Показать незаполненные карточки"}
              </button>
            )}
          </div>
          {(showList === "missing" || showList === "ai") && <EntityList list={shownList} onChanged={onChanged} />}
        </div>
      )}

      <div className="time-grid">
        {totals.map(t => {
          const meta = MEDIA_META[t.type];
          const perDay = budget[t.type];
          const days = daysFor(t, perDay);
          const doneWord = t.type === "book" ? "прочитано" : t.type === "game" ? "пройдено" : "просмотрено";
          return (
            <div key={t.type} className="time-card" style={{ ["--accent" as any]: meta.color }}>
              <div className="time-card-head">
                <b>{meta.emoji} {meta.label}</b>
                <span className="muted">{t.pending} не {doneWord}{t.inProgress ? ` · ${t.inProgress} в процессе` : ""}</span>
              </div>

              {t.pending === 0 ? (
                <div className="muted">Здесь всё {doneWord} 🎉</div>
              ) : <>
                <div className="time-card-total">
                  {fmtHours(t.totalMin)}
                  <span className="time-share">{pct(t.totalMin, totalMin)}% от всего оставшегося</span>
                </div>
                <div className="muted time-small">
                  {doneWord[0].toUpperCase() + doneWord.slice(1)} {fmtHours(t.doneMin)} из {fmtHours(t.contentMin)} ({pct(t.doneMin, t.contentMin)}%)
                </div>
                {t.withDuration < t.pending && (
                  <div className="muted time-small">в т. ч. ≈ {fmtHours(t.estimatedMin)} — по среднему для {t.pending - t.withDuration} без длительности</div>
                )}

                {t.type === "show" && t.ongoing > 0 && (
                  <div className="time-ongoing">
                    <label>
                      <input type="checkbox" checked={includeFuture} onChange={ev => change("include_future", ev.target.checked ? 1 : 0)} />
                      Учитывать будущие сезоны{t.futureMin > 0 ? ` (+${fmtHours(t.futureMin)})` : ""}
                    </label>
                    <div className="muted time-small">
                      {t.ongoing} {plural(t.ongoing, "сериал ещё выходит", "сериала ещё выходят", "сериалов ещё выходят")}.
                      Укажи на карточке, сколько сезонов будет всего и сколько уже посмотрел.{" "}
                      <span className="time-link" onClick={() => toggleList("ongoing")}>{showList === "ongoing" ? "Скрыть" : "Показать"}</span>
                    </div>
                    {showList === "ongoing" && <EntityList list={ongoingList} onChanged={onChanged} seasons />}
                  </div>
                )}

                <div className="time-budget">
                  <div className="time-budget-row">
                    <span>В день</span>
                    <b>{perDay === 0 ? "не трачу" : fmtMinutes(perDay)}</b>
                  </div>
                  <input type="range" min={0} max={240} step={5} value={Math.min(240, perDay)}
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
                    <input type="number" min={5} max={300} value={budget.pages_per_hour}
                      onChange={ev => { const v = Number(ev.target.value); if (v > 0) change("pages_per_hour", v); }} />
                    <span className="muted">стр/час</span>
                    <span className="time-link" onClick={() => setTestOpen(true)}>Пройти тест</span>
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
        Осталось — всё, что ещё не отмечено как просмотренное/прочитанное/пройденное. У сериалов вычитаются уже просмотренные сезоны
        и, если включено, добавляются будущие. Разделы идут параллельно, поэтому общий срок — по самому долгому из них.
      </div>

      {testOpen && (
        <ReadingTest onClose={() => setTestOpen(false)}
          onResult={v => { change("pages_per_hour", v); showToast(`Скорость чтения: ${v} стр/час`); }} />
      )}
    </div>
  );
}

function EntityList({ list, onChanged, seasons }: { list: Entity[]; onChanged: () => void; seasons?: boolean }) {
  if (!list.length) return null;
  return (
    <div className="time-list">
      {list.map((e, i) => (
        <div key={e.id}>
          {!seasons && (i === 0 || list[i - 1].type !== e.type) && (
            <div className="time-list-group">{MEDIA_META[e.type as MediaType].emoji} {MEDIA_META[e.type as MediaType].label}</div>
          )}
          <div className={`time-list-row ${seasons ? "column" : ""}`}>
            <span className="time-list-name">{e.name}</span>
            {seasons ? <><DurationField e={e} onChanged={onChanged} /><SeasonsField e={e} onChanged={onChanged} /></>
              : <DurationField e={e} onChanged={onChanged} />}
          </div>
        </div>
      ))}
      <div className="muted time-small" style={{ marginTop: 6 }}>Нажми на цифру или ✎, чтобы вписать своё значение — оно перестанет считаться оценкой.</div>
    </div>
  );
}
