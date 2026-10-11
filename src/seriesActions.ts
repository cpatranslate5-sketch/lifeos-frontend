// ============================================================
// Ручная работа с сериями: добавить карточку в серию, убрать,
// объединить две карточки в новую серию, переименовать серию.
// Номера частей пересчитываются сами (по году выхода), руками
// их можно поправить в поле «Серия» на карточке.
// ============================================================
import { createContext, useContext } from "react";
import { Entity, updateEntityField } from "./api";
import { seriesName } from "./series";

/** Все карточки текущей вкладки — чтобы в выборе серии были видны остальные. */
export const SeriesCatalog = createContext<Entity[]>([]);
export const useSeriesCatalog = () => useContext(SeriesCatalog);

export const normTitle = (s: string) =>
  s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();

export type SeriesInfo = { name: string; members: Entity[] };

/** Серии нужного типа в каталоге (по названию, без учёта регистра). */
export function seriesOfType(items: Entity[], type: string): SeriesInfo[] {
  const map = new Map<string, SeriesInfo>();
  for (const e of items) {
    if (e.type !== type) continue;
    const n = seriesName(e);
    if (!n) continue;
    const k = n.toLowerCase();
    if (!map.has(k)) map.set(k, { name: n, members: [] });
    map.get(k)!.members.push(e);
  }
  return [...map.values()];
}

/** Насколько два названия похожи: число общих значимых слов. */
export function similarity(a: string, b: string): number {
  const wa = new Set(normTitle(a).split(" ").filter(w => w.length > 2));
  let n = 0;
  for (const w of new Set(normTitle(b).split(" ").filter(w => w.length > 2))) if (wa.has(w)) n++;
  return n;
}

/** Совпадает ли название с тем, что ввели в поиск. */
export function matches(title: string, q: string): boolean {
  const nq = normTitle(q);
  if (!nq) return true;
  const nt = normTitle(title);
  return nq.split(" ").every(w => nt.includes(w));
}

const year = (e: Entity) => Number(e.attributes?.year) || 0;
const order = (e: Entity) => Number(e.attributes?.series_order) || 0;

/** Ставит карточки в серию и заново нумерует все части по порядку. */
async function writeSeries(name: string, existing: Entity[], added: Entity[]) {
  const list = [...existing].sort((a, b) => (order(a) - order(b)) || (year(a) - year(b)));
  for (const e of [...added].sort((a, b) => year(a) - year(b))) {
    // новая часть встаёт после последней части, вышедшей не позже неё
    let pos = list.length;
    if (year(e)) {
      pos = 0;
      list.forEach((m, i) => { if (!year(m) || year(m) <= year(e)) pos = i + 1; });
    }
    list.splice(pos, 0, e);
  }
  const addedIds = new Set(added.map(e => e.id));
  await Promise.all(list.map(async (e, i) => {
    if (addedIds.has(e.id)) {
      await updateEntityField(e.id, "series", name);
      await updateEntityField(e.id, "series_source", "manual");
    }
    if (order(e) !== i + 1 || addedIds.has(e.id)) await updateEntityField(e.id, "series_order", i + 1);
  }));
}

/** Добавить карточки в существующую серию (или начать новую). */
export async function addToSeries(name: string, members: Entity[], cards: Entity[]) {
  const ids = new Set(cards.map(c => c.id));
  await writeSeries(name.trim(), members.filter(m => !ids.has(m.id)), cards);
}

/** Убрать карточку из серии; оставшиеся части перенумеровываются. */
export async function removeFromSeries(e: Entity, members: Entity[]) {
  await updateEntityField(e.id, "series", null);
  await updateEntityField(e.id, "series_order", null);
  await updateEntityField(e.id, "series_source", "manual");
  const rest = members.filter(m => m.id !== e.id).sort((a, b) => (order(a) - order(b)) || (year(a) - year(b)));
  await Promise.all(rest.map((m, i) => (order(m) !== i + 1 ? updateEntityField(m.id, "series_order", i + 1) : null)));
}

/** Переименовать серию у всех частей. */
export async function renameSeries(members: Entity[], name: string) {
  const n = name.trim();
  if (!n) return;
  await Promise.all(members.map(async m => {
    await updateEntityField(m.id, "series", n);
    await updateEntityField(m.id, "series_source", "manual");
  }));
}

/** Название для новой серии из двух карточек: общее начало названий
 *  («Гарри Поттер и …» + «Гарри Поттер и …» → «Гарри Поттер»),
 *  иначе — название более ранней карточки до двоеточия/цифры. */
export function suggestSeriesName(a: Entity, b: Entity): string {
  const [first, second] = year(a) <= year(b) ? [a, b] : [b, a];
  const wa = first.name.split(/\s+/), wb = second.name.split(/\s+/);
  const common: string[] = [];
  for (let i = 0; i < Math.min(wa.length, wb.length); i++) {
    if (normTitle(wa[i]) !== normTitle(wb[i])) break;
    common.push(wa[i]);
  }
  // хвостовые короткие слова и знаки («и», «:», «—») убираем
  while (common.length && (normTitle(common[common.length - 1]).length <= 2 || /^[—–:-]+$/.test(common[common.length - 1]))) common.pop();
  let name = common.join(" ").replace(/[:.,—–-]+$/, "").trim();
  if (name.length < 3) name = first.name.split(/[:.(]|\s[—–-]\s|\s\d/)[0].trim();
  return name || first.name;
}

/** Перенести карточки в серию name (новую или существующую). Если какие-то из них
 *  были в других сериях — те серии перенумеровываются без них. */
export async function putIntoSeries(name: string, cards: Entity[], catalog: Entity[]) {
  const n = name.trim();
  if (!n || !cards.length) return;
  const type = cards[0].type;
  const ids = new Set(cards.map(c => c.id));
  const target = seriesOfType(catalog, type).find(s => s.name.toLowerCase() === n.toLowerCase());
  const finalName = target ? target.name : n;
  // старые серии, из которых карточки уходят
  const oldNames = new Set(cards.map(c => seriesName(c)).filter((x): x is string => !!x && x.toLowerCase() !== n.toLowerCase()));
  await addToSeries(finalName, target ? target.members : [], cards.filter(c => !target || !target.members.some(m => m.id === c.id)));
  for (const old of oldNames) {
    const rest = catalog.filter(x => x.type === type && !ids.has(x.id) && seriesName(x)?.toLowerCase() === old.toLowerCase())
      .sort((a, b) => (order(a) - order(b)) || (year(a) - year(b)));
    await Promise.all(rest.map((m, i) => (order(m) !== i + 1 ? updateEntityField(m.id, "series_order", i + 1) : null)));
  }
}

/** Название по умолчанию для серии из одной карточки: до двоеточия / номера части. */
export function baseTitle(name: string): string {
  return name.split(/[:.(]|\s[—–-]\s|\s\d+\s*$|\s(I|II|III|IV|V|VI)\s*$/)[0].trim() || name;
}
