import { Entity } from "../api";
import EntityCard from "./EntityCard";

const TAG_TIME: Record<string, number> = { утро: 360, день: 720, вечер: 1080 };

function timeToMinutes(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
}

function effectiveKey(e: Entity): number {
  const explicit = timeToMinutes(e.attributes?.time);
  if (explicit !== null) return explicit;
  const name = (e.name || "").toLowerCase();
  for (const tag in TAG_TIME) {
    if (name.includes(tag)) return TAG_TIME[tag];
  }
  return 1440;
}

function isDoneForSort(e: Entity, selectedDate: string): boolean {
  if (e.type === "habit") {
    return (e.attributes?.done_dates || []).includes(selectedDate);
  }
  return !!e.attributes?.done;
}

function sortItems(items: Entity[], selectedDate: string): Entity[] {
  return [...items].sort((a, b) => {
    const aDone = isDoneForSort(a, selectedDate);
    const bDone = isDoneForSort(b, selectedDate);
    if (aDone !== bDone) return aDone ? 1 : -1;

    const aProc = !!a.attributes?.in_process;
    const bProc = !!b.attributes?.in_process;
    if (aProc !== bProc) return aProc ? -1 : 1;

    const ak = effectiveKey(a), bk = effectiveKey(b);
    if (ak !== bk) return ak - bk;
    return a.created_at.localeCompare(b.created_at);
  });
}

export default function DateList({ items, selectedDate, onChanged }: { items: Entity[]; selectedDate: string; onChanged: () => void }) {
  const sorted = sortItems(items, selectedDate);

  return (
    <div>
      {sorted.map(e => (
        <EntityCard key={e.id} e={e} onChanged={onChanged} selectedDate={selectedDate} layout="sequential" />
      ))}
    </div>
  );
}
