// ============================================================
// Время на медиатеку: длительность карточек и расчёт «сколько
// дней/лет уйдёт на всё непросмотренное при N минут в день».
//
// Хранение на карточке:
//   duration_min   — минуты (фильм; сериал целиком; игра)
//   pages          — страницы (книга), в часы переводятся по скорости чтения
//   duration_source — "tmdb" | "openlibrary" | "ai" | "manual"
// Настройки (минуты в день, скорость чтения) — отдельная карточка
// типа "media_budget" в папке, чтобы они были одинаковы на всех устройствах.
// ============================================================
import { Entity } from "./api";

export type MediaType = "movie" | "show" | "book" | "game";
export const MEDIA_TYPES: MediaType[] = ["movie", "show", "book", "game"];

export const MEDIA_META: Record<MediaType, { label: string; emoji: string; verb: string; color: string }> = {
  movie: { label: "Кино", emoji: "🎬", verb: "посмотреть", color: "var(--movie)" },
  show: { label: "Сериалы", emoji: "📺", verb: "посмотреть", color: "var(--show)" },
  book: { label: "Книги", emoji: "📚", verb: "прочитать", color: "var(--book)" },
  game: { label: "Игры", emoji: "🎮", verb: "пройти", color: "var(--game)" },
};

export const BUDGET_TYPE = "media_budget";

export interface MediaBudget {
  movie: number; show: number; book: number; game: number; // минут в день
  pages_per_hour: number;
  include_future: number; // 1 — учитывать будущие сезоны выходящих сериалов
}

export const DEFAULT_BUDGET: MediaBudget = { movie: 30, show: 45, book: 30, game: 30, pages_per_hour: 30, include_future: 1 };

export function readBudget(items: Entity[]): { entity: Entity | null; budget: MediaBudget } {
  const entity = items.find(e => e.type === BUDGET_TYPE) || null;
  const a = entity?.attributes || {};
  const budget = { ...DEFAULT_BUDGET };
  for (const k of Object.keys(DEFAULT_BUDGET) as (keyof MediaBudget)[]) {
    if (typeof a[k] === "number" && a[k] >= 0) budget[k] = a[k];
  }
  return { entity, budget };
}

/** Ещё не просмотрено / не прочитано / не пройдено. */
export function isPending(e: Entity): boolean {
  return !e.attributes?.done && e.attributes?.status !== "skipped";
}

// ---------- Сериалы: сезоны ----------
// duration_min у сериала — все ВЫШЕДШИЕ серии. Дополнительно (необязательно):
//   seasons_released — сколько сезонов вышло (из TMDB или вручную)
//   seasons_watched  — сколько сезонов уже просмотрено
//   seasons_total    — сколько сезонов будет всего (если известно / по ожиданиям)
//   show_ongoing     — сериал ещё выходит
export interface SeasonInfo { released: number | null; watched: number; total: number | null; ongoing: boolean; perSeason: number | null }

export function seasonInfo(e: Entity): SeasonInfo {
  const a = e.attributes || {};
  const released = a.seasons_released > 0 ? a.seasons_released : null;
  const watched = a.seasons_watched > 0 ? a.seasons_watched : 0;
  const total = a.seasons_total > 0 ? a.seasons_total : null;
  const perSeason = released && a.duration_min > 0 ? a.duration_min / released : null;
  return { released, watched, total, ongoing: !!a.show_ongoing || (!!total && !!released && total > released), perSeason };
}

/** Сколько минут будущих (ещё не вышедших) сезонов, если известно, сколько их будет. */
export function futureMinutes(e: Entity): number {
  if (e.type !== "show") return 0;
  const s = seasonInfo(e);
  if (!s.perSeason || !s.total || !s.released || s.total <= s.released) return 0;
  return s.perSeason * (s.total - s.released);
}

/** Сколько минут уже просмотрено у сериала «в процессе». */
export function watchedMinutes(e: Entity): number {
  if (e.type !== "show") return 0;
  const s = seasonInfo(e);
  if (!s.perSeason || !s.watched) return 0;
  return s.perSeason * Math.min(s.watched, s.released || s.watched);
}

/** Минуты на карточку (весь вышедший объём), или null, если длительность не указана. */
export function itemMinutes(e: Entity, pagesPerHour: number): number | null {
  const a = e.attributes || {};
  if (e.type === "book") {
    if (typeof a.pages === "number" && a.pages > 0) return (a.pages / Math.max(1, pagesPerHour)) * 60;
    if (typeof a.duration_min === "number" && a.duration_min > 0) return a.duration_min;
    return null;
  }
  return typeof a.duration_min === "number" && a.duration_min > 0 ? a.duration_min : null;
}

export function isEstimate(e: Entity): boolean {
  return e.attributes?.duration_source === "ai";
}

/** «45 мин», «2 ч 15 мин», «143 ч». */
export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h >= 20 || r === 0) return `${Math.round(m / 60)} ч`;
  return `${h} ч ${r} мин`;
}

/** Большие суммы: «1 240 ч». */
export function fmtHours(min: number): string {
  const h = min / 60;
  if (h < 1) return fmtMinutes(min);
  return `${Math.round(h).toLocaleString("ru-RU")} ч`;
}

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** «18 дней», «4 месяца», «2 года 3 месяца». */
export function fmtDays(days: number): string {
  const d = Math.ceil(days);
  if (d <= 0) return "0 дней";
  if (d < 60) return `${d} ${plural(d, "день", "дня", "дней")}`;
  const totalMonths = Math.round(d / 30.44);
  if (totalMonths < 12) return `${totalMonths} ${plural(totalMonths, "месяц", "месяца", "месяцев")}`;
  const y = Math.floor(totalMonths / 12), mo = totalMonths % 12;
  return `${y} ${plural(y, "год", "года", "лет")}` + (mo ? ` ${mo} ${plural(mo, "месяц", "месяца", "месяцев")}` : "");
}

export interface TypeTotals {
  type: MediaType;
  pending: number;          // всего непросмотренного
  count: number;            // всего позиций в разделе
  doneCount: number;        // из них просмотрено/прочитано/пройдено
  withDuration: number;     // из них с длительностью
  knownMin: number;         // осталось по известным длительностям
  estimatedMin: number;     // плюс оценка для карточек без длительности (по среднему)
  futureMin: number;        // будущие сезоны (входят в totalMin, если включены)
  totalMin: number;         // всего осталось
  doneMin: number;          // уже просмотрено/прочитано (включая просмотренные сезоны)
  contentMin: number;       // весь контент раздела = doneMin + totalMin
  aiCount: number;          // сколько длительностей — оценка Claude
  inProgress: number;
  ongoing: number;          // сериалы, которые ещё выходят
  longest: { e: Entity; min: number }[];
}

export function computeTotals(items: Entity[], type: MediaType, pagesPerHour: number, includeFuture = true): TypeTotals {
  const all = items.filter(e => e.type === type);
  const pending = all.filter(isPending);
  const done = all.filter(e => e.attributes?.done);
  const withMin = all.map(e => ({ e, min: itemMinutes(e, pagesPerHour) }));
  const knownAll = withMin.filter((x): x is { e: Entity; min: number } => x.min !== null);
  const avg = knownAll.length ? knownAll.reduce((s, x) => s + x.min, 0) / knownAll.length : 0;
  const future = (e: Entity) => (includeFuture ? futureMinutes(e) : 0);

  // Осталось: вышедшее − просмотренные сезоны + (по желанию) будущие сезоны.
  const remaining = pending.map(e => {
    const m = itemMinutes(e, pagesPerHour);
    return { e, min: m === null ? null : Math.max(0, m - watchedMinutes(e)) + future(e) };
  });
  const known = remaining.filter((x): x is { e: Entity; min: number } => x.min !== null);
  const knownMin = known.reduce((s, x) => s + x.min, 0);
  const missing = pending.length - known.length;
  const estimatedMin = missing * avg;

  const doneMin = done.reduce((s, e) => s + (itemMinutes(e, pagesPerHour) ?? avg), 0)
    + pending.reduce((s, e) => s + watchedMinutes(e), 0);

  return {
    type,
    pending: pending.length,
    count: all.length,
    doneCount: done.length,
    withDuration: known.length,
    knownMin,
    estimatedMin,
    futureMin: pending.reduce((s, e) => s + future(e), 0),
    totalMin: knownMin + estimatedMin,
    doneMin,
    contentMin: doneMin + knownMin + estimatedMin,
    aiCount: known.filter(x => isEstimate(x.e)).length,
    inProgress: pending.filter(e => e.attributes?.status === "in_progress").length,
    ongoing: pending.filter(e => e.type === "show" && seasonInfo(e).ongoing).length,
    longest: [...known].sort((a, b) => b.min - a.min).slice(0, 3),
  };
}

// Скорость чтения нужна и на карточке книги (там нет доступа к настройкам),
// поэтому вкладка «Время» запоминает её в браузере.
const PPH_KEY = "lifeos_pages_per_hour";
export function cachedPagesPerHour(): number {
  try { const v = Number(localStorage.getItem(PPH_KEY)); return v > 0 ? v : DEFAULT_BUDGET.pages_per_hour; } catch { return DEFAULT_BUDGET.pages_per_hour; }
}
export function rememberPagesPerHour(v: number) {
  try { localStorage.setItem(PPH_KEY, String(v)); } catch { /* не критично */ }
}
