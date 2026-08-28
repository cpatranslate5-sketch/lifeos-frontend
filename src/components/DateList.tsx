import { useState } from "react";
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
  return 1440; // no signal — sort after everything with a real time, by creation order via id string below
}

// МЕТКА ДЛЯ ПРОВЕРКИ: sort-fix-v3 — если видите эту строку на GitHub, файл обновился
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
    if (aDone !== bDone) return aDone ? 1 : -1; // done always sinks to the bottom

    const aProc = !!a.attributes?.in_process;
    const bProc = !!b.attributes?.in_process;
    if (aProc !== bProc) return aProc ? -1 : 1; // "в процессе" floats above the rest

    const ak = effectiveKey(a), bk = effectiveKey(b);
    if (ak !== bk) return ak - bk;
    return a.created_at.localeCompare(b.created_at);
  });
}

export default function DateList({ items, selectedDate, onChanged }: { items: Entity[]; selectedDate: string; onChanged: () => void }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
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

  async function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) { setDraggingId(null); return; }
    const ids = sorted.map(e => e.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggingId(null); return; }
    const reordered = [...ids];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggingId);
    for (let i = 0; i < reordered.length; i++) {
      await updateEntityField(reordered[i], "order", i);
    }
    setDraggingId(null);
    onChanged();
  }

  return (
    <div>
      {hasManualOrder && <div className="edit-link" style={{ marginBottom: 10, display: "inline-block" }} onClick={resetOrder}>сбросить ручной порядок и вернуть сортировку по времени/пометкам</div>}
      {sorted.map(e => (
        <div key={e.id} className="date-list-row" onDragOver={(ev) => ev.preventDefault()} onDrop={() => handleDrop(e.id)}>
          <div className="drag-handle" draggable
            onDragStart={(ev) => {
              ev.dataTransfer.setData("text/plain", e.id);
              const row = (ev.currentTarget as HTMLElement).closest(".date-list-row") as HTMLElement | null;
              if (row) ev.dataTransfer.setDragImage(row, 20, 20);
              setDraggingId(e.id);
            }}
            title="Перетащить для ручной сортировки">⠿</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <EntityCard e={e} onChanged={onChanged} selectedDate={selectedDate} layout="sequential" />
          </div>
        </div>
      ))}
    </div>
  );
}
