// ============================================================
// Серии/франшизы: несколько карточек одной серии (все «Гарри Поттеры»)
// показываются одной папкой, а в статистике считаются как ОДНО
// произведение — чтобы 8 фильмов не делали Рэдклиффа «любимым актёром».
//
// На карточке:  series — название серии, series_order — номер части,
//               series_source — "ai" | "manual".
// ============================================================
import { Entity } from "./api";

export type Unit =
  | { kind: "single"; e: Entity }
  | { kind: "series"; key: string; name: string; members: Entity[] };

export function seriesName(e: Entity): string | null {
  const s = e.attributes?.series;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

function memberOrder(a: Entity, b: Entity) {
  const oa = Number(a.attributes?.series_order) || 0, ob = Number(b.attributes?.series_order) || 0;
  if (oa !== ob) return oa - ob;
  const ya = Number(a.attributes?.year) || 0, yb = Number(b.attributes?.year) || 0;
  if (ya !== yb) return ya - yb;
  return a.name.localeCompare(b.name, "ru");
}

/** Собирает список в «единицы»: одиночные карточки и папки серий.
 *  Порядок — по первому появлению в исходном (уже отсортированном) списке.
 *  Серия показывается папкой, даже если в ней пока одна часть. */
export function groupUnits(items: Entity[]): Unit[] {
  const buckets = new Map<string, Entity[]>();
  for (const e of items) {
    const n = seriesName(e);
    if (!n) continue;
    const key = e.type + "|" + n.toLowerCase();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  }
  const seen = new Set<string>();
  const units: Unit[] = [];
  for (const e of items) {
    const n = seriesName(e);
    const key = n ? e.type + "|" + n.toLowerCase() : "";
    if (n) {
      if (seen.has(key)) continue;
      seen.add(key);
      units.push({ kind: "series", key, name: n, members: [...buckets.get(key)!].sort(memberOrder) });
    } else {
      units.push({ kind: "single", e });
    }
  }
  return units;
}

export const unitMembers = (u: Unit): Entity[] => (u.kind === "single" ? [u.e] : u.members);

/** Средняя оценка по оценённым частям (или оценка одиночной карточки). */
export function unitRating(u: Unit): number | null {
  const r = unitMembers(u).map(e => Number(e.attributes?.rating) || 0).filter(x => x > 0);
  return r.length ? r.reduce((s, x) => s + x, 0) / r.length : null;
}

export type UnitStatus = "in_progress" | "waiting" | "want" | "done";
export function unitStatus(u: Unit): UnitStatus {
  const m = unitMembers(u);
  if (m.some(e => e.attributes?.status === "in_progress")) return "in_progress";
  if (m.every(e => e.attributes?.done)) return "done";
  if (m.some(e => e.attributes?.done)) return "in_progress"; // серия начата
  if (m.some(e => e.attributes?.status === "waiting_season")) return "waiting";
  return "want";
}
export const unitSortKey = (u: Unit) => ({ in_progress: 0, waiting: 1, want: 2, done: 3 }[unitStatus(u)]);

/** Топ значений, где каждая серия считается один раз (значения её частей объединяются). */
export function topCountsByUnit(items: Entity[], valuesOf: (e: Entity) => string[], n = 5): [string, number][] {
  const counts = new Map<string, number>();
  for (const u of groupUnits(items)) {
    const vals = new Set(unitMembers(u).flatMap(valuesOf).filter(Boolean));
    vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ── Поиск: совпадение по названию карточки ИЛИ по названию её серии ──
// Латинские буквы-двойники (a, c, e, o, p…) приводим к кириллице, ё → е,
// чтобы «Гарри Поттер», набранный с ошибочной раскладкой, тоже находился.
const LOOKALIKES: Record<string, string> = {
  a: "а", b: "в", c: "с", e: "е", h: "н", k: "к", m: "м", o: "о", p: "р", t: "т", x: "х", y: "у",
};
export function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").split("").map(ch => LOOKALIKES[ch] || ch).join("");
}
export function matchesSearch(e: Entity, term: string): boolean {
  const q = normalizeSearch(term.trim());
  if (!q) return true;
  if (normalizeSearch(e.name).includes(q)) return true;
  const s = seriesName(e);
  return !!s && normalizeSearch(s).includes(q);
}
