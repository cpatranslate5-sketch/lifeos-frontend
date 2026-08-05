import { useState } from "react";
import { Entity, updateEntityField } from "../api";
import EntityCard from "./EntityCard";

function parseTimeMinutes(t?: string): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function timeOfDayTag(name: string): number | null {
  const n = name.toLowerCase();
  if (n.includes("(утро)")) return 6 * 60;
  if (n.includes("(день)")) return 12 * 60;
  if (n.includes("(вечер)")) return 18 * 60;
  return null;
}

// Manual drag position (attributes.order) wins if set; otherwise sort by
// time-of-day; items with neither go to the bottom in a stable order.
function effectiveKey(e: Entity): number {
  const o = e.attributes?.order;
  if (typeof o === "number") return o;
  const t = parseTimeMinutes(e.attributes?.time);
  if (t !== null) return t;
  const tagged = timeOfDayTag(e.name);
  if (tagged !== null) return tagged;
  return 100000 + new Date(e.created_at).getTime() / 1e10;
}

export default function DateList({ items, selectedDate, onChanged }: { items: Entity[]; selectedDate: string; onChanged: () => void }) {
  const sorted = [...items].sort((a, b) => effectiveKey(a) - effectiveKey(b));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  async function onDrop(targetId: string) {
    setOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const fromIdx = sorted.findIndex(i => i.id === dragId);
    const toIdx = sorted.findIndex(i => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); return; }

    const withoutDragged = sorted.filter(i => i.id !== dragId);
    const insertAt = withoutDragged.findIndex(i => i.id === targetId);
    const prev = insertAt > 0 ? withoutDragged[insertAt - 1] : null;
    const next = withoutDragged[insertAt] ?? null;
    const prevKey = prev ? effectiveKey(prev) : (next ? effectiveKey(next) - 20 : 0);
    const nextKey = next ? effectiveKey(next) : prevKey + 20;
    const newKey = (prevKey + nextKey) / 2;

    setDragId(null);
    await updateEntityField(dragId, "order", newKey);
    onChanged();
  }

  return (
    <>
      {sorted.map(item => (
        <div key={item.id}
          draggable
          onDragStart={() => setDragId(item.id)}
          onDragOver={(ev) => { ev.preventDefault(); setOverId(item.id); }}
          onDragLeave={() => setOverId(o => (o === item.id ? null : o))}
          onDrop={() => onDrop(item.id)}
          className={`drag-wrap ${overId === item.id && dragId && dragId !== item.id ? "drag-over" : ""}`}>
          <EntityCard e={item} onChanged={onChanged} selectedDate={selectedDate} />
        </div>
      ))}
    </>
  );
}
