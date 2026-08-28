import { Entity, updateEntityField } from "../api";
import EntityCard from "./EntityCard";

const TAG_TIME: Record<string, number> = { утро: 360, день: 720, вечер: 1080 };

function timeToMinutes(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
}

function effectiveKey(e: Entity): number {
  if (typeof e.attributes?.order === "number") return e.attributes.order - 100000; // manual order wins, sorts first
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
  const hasManualOrder = items.some(e => typeof e.attributes?.order === "number");

  async function resetOrder() {
    for (const e of items) {
      if (typeof e.attributes?.order === "number") {
        await updateEntityField(e.id, "order", null);
      }
    }
    onChanged();
  }

  async function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    for (let i = 0; i < reordered.length; i++) {
      await updateEntityField(reordered[i].id, "order", i);
    }
    onChanged();
  }

  return (
    <div>
      {hasManualOrder && <div className="edit-link" style={{ marginBottom: 10, display: "inline-block" }} onClick={resetOrder}>сбросить ручной порядок и вернуть сортировку по времени/пометкам</div>}
      {sorted.map((e, i) => (
        <div key={e.id} className="date-list-row">
          <div className="order-handle">
            <span className={`order-arrow ${i === 0 ? "disabled" : ""}`} onClick={() => i > 0 && move(i, -1)} title="Переместить выше">▲</span>
            <span className={`order-arrow ${i === sorted.length - 1 ? "disabled" : ""}`} onClick={() => i < sorted.length - 1 && move(i, 1)} title="Переместить ниже">▼</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <EntityCard e={e} onChanged={onChanged} selectedDate={selectedDate} layout="sequential" />
          </div>
        </div>
      ))}
    </div>
  );
}
