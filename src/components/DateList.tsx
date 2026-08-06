import { useEffect, useRef, useState } from "react";
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

function effectiveKey(e: Entity): number {
  const o = e.attributes?.order;
  if (typeof o === "number") return o;
  const t = parseTimeMinutes(e.attributes?.time);
  if (t !== null) return t;
  const tagged = timeOfDayTag(e.name);
  if (tagged !== null) return tagged;
  return 100000 + new Date(e.created_at).getTime() / 1e10;
}

function isDoneFor(e: Entity, selectedDate: string): boolean {
  if (e.type === "habit") {
    return (e.attributes?.done_dates || []).includes(selectedDate);
  }
  return !!e.attributes?.done;
}

export default function DateList({ items, selectedDate, onChanged }: { items: Entity[]; selectedDate: string; onChanged: () => void }) {
  const sorted = [...items].sort((a, b) => {
    const da = isDoneFor(a, selectedDate) ? 1 : 0;
    const db = isDoneFor(b, selectedDate) ? 1 : 0;
    if (da !== db) return da - db;
    return effectiveKey(a) - effectiveKey(b);
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const overIdRef = useRef<string | null>(null);
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  function findRowUnder(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const row = el?.closest("[data-drag-id]") as HTMLElement | null;
    return row?.dataset.dragId ?? null;
  }

  async function commitDrop(sourceId: string, targetId: string) {
    const list = sortedRef.current;
    if (!targetId || sourceId === targetId) return;
    const fromIdx = list.findIndex(i => i.id === sourceId);
    const toIdx = list.findIndex(i => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const movingDown = toIdx > fromIdx;

    const withoutDragged = list.filter(i => i.id !== sourceId);
    const targetIdx = withoutDragged.findIndex(i => i.id === targetId);
    const insertAt = movingDown ? targetIdx + 1 : targetIdx;
    const reordered = [...withoutDragged];
    reordered.splice(insertAt, 0, list[fromIdx]);

    // Reassign sequential order to the whole visible list rather than just
    // computing a midpoint for the moved item — a midpoint between two
    // neighbors that happen to share the same effective key (e.g. several
    // items with the same (день) tag and no explicit order yet) collapses
    // to that same value and produces no visible change. Full reassignment
    // has no such collision case.
    await Promise.all(reordered.map((it, idx) => updateEntityField(it.id, "order", idx * 10)));
    onChanged();
  }

  useEffect(() => {
    if (!dragId) return;

    function handleMove(ev: PointerEvent) {
      ev.preventDefault();
      const under = findRowUnder(ev.clientX, ev.clientY);
      const next = under && under !== dragIdRef.current ? under : null;
      overIdRef.current = next;
      setOverId(next);
    }
    function handleUp() {
      const source = dragIdRef.current;
      const target = overIdRef.current;
      dragIdRef.current = null;
      overIdRef.current = null;
      setDragId(null);
      setOverId(null);
      if (source && target) commitDrop(source, target);
    }

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragId]);

  function startDrag(id: string, ev: React.PointerEvent) {
    ev.preventDefault();
    dragIdRef.current = id;
    setDragId(id);
  }

  return (
    <>
      {sorted.map(item => (
        <div key={item.id} data-drag-id={item.id}
          className={`drag-wrap ${overId === item.id ? "drag-over" : ""} ${dragId === item.id ? "dragging" : ""}`}>
          <div className="drag-handle" onPointerDown={(ev) => startDrag(item.id, ev)}>⠿</div>
          <div className="drag-content">
            <EntityCard e={item} onChanged={onChanged} selectedDate={selectedDate} />
          </div>
        </div>
      ))}
    </>
  );
}
