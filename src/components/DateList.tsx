import { useRef, useState } from "react";
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
// time-of-day (explicit time, then утро/день/вечер name tags on the same
// minute scale); items with neither go to the bottom in a stable order.
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
  const draggingRef = useRef<string | null>(null);

  function findRowUnder(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const row = el?.closest("[data-drag-id]") as HTMLElement | null;
    return row?.dataset.dragId ?? null;
  }

  async function commitDrop(sourceId: string, targetId: string) {
    if (!targetId || sourceId === targetId) return;
    const fromIdx = sorted.findIndex(i => i.id === sourceId);
    const toIdx = sorted.findIndex(i => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const withoutDragged = sorted.filter(i => i.id !== sourceId);
    const insertAt = withoutDragged.findIndex(i => i.id === targetId);
    const prev = insertAt > 0 ? withoutDragged[insertAt - 1] : null;
    const next = withoutDragged[insertAt] ?? null;
    const prevKey = prev ? effectiveKey(prev) : (next ? effectiveKey(next) - 20 : 0);
    const nextKey = next ? effectiveKey(next) : prevKey + 20;
    const newKey = (prevKey + nextKey) / 2;

    await updateEntityField(sourceId, "order", newKey);
    onChanged();
  }

  function onPointerDown(id: string, ev: React.PointerEvent) {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    draggingRef.current = id;
    setDragId(id);
  }

  function onPointerMove(ev: React.PointerEvent) {
    if (!draggingRef.current) return;
    ev.preventDefault();
    const under = findRowUnder(ev.clientX, ev.clientY);
    setOverId(under && under !== draggingRef.current ? under : null);
  }

  async function onPointerUp() {
    const sourceId = draggingRef.current;
    const targetId = overId;
    draggingRef.current = null;
    setDragId(null);
    setOverId(null);
    if (sourceId && targetId) await commitDrop(sourceId, targetId);
  }

  return (
    <>
      {sorted.map(item => (
        <div key={item.id} data-drag-id={item.id}
          className={`drag-wrap ${overId === item.id ? "drag-over" : ""} ${dragId === item.id ? "dragging" : ""}`}>
          <div className="drag-handle"
            onPointerDown={(ev) => onPointerDown(item.id, ev)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}>⠿</div>
          <div className="drag-content">
            <EntityCard e={item} onChanged={onChanged} selectedDate={selectedDate} />
          </div>
        </div>
      ))}
    </>
  );
}
