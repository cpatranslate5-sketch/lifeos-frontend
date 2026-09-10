import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Entity, updateEntityField, createEntity, bulkDeleteEntities } from "../api";
import { todayStr } from "../dateUtils";
import { showToast } from "../toast";
import EntityCard from "./EntityCard";
import MiniCalendar from "./MiniCalendar";

const TAG_TIME: Record<string, number> = { утро: 360, день: 720, вечер: 1080 };
const RED_COLOR = "#F5C6C6";

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
    // Красные карточки — всегда самые первые, безусловно.
    const aRed = a.attributes?.card_color === RED_COLOR;
    const bRed = b.attributes?.card_color === RED_COLOR;
    if (aRed !== bRed) return aRed ? -1 : 1;

    const aDone = isDoneForSort(a, selectedDate);
    const bDone = isDoneForSort(b, selectedDate);
    if (aDone !== bDone) return aDone ? 1 : -1;

    const aRegular = a.name.toLowerCase().includes("регулярно");
    const bRegular = b.name.toLowerCase().includes("регулярно");
    if (aRegular !== bRegular) return aRegular ? -1 : 1;

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [pendingMoveDate, setPendingMoveDate] = useState<string | null>(null);
  const [moveTimeInput, setMoveTimeInput] = useState("");
  const moveButtonRef = useRef<HTMLDivElement>(null);
  const [moveAnchor, setMoveAnchor] = useState<{ top: number; left: number } | null>(null);

  function toggleSelectionMode() {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedEntities = sorted.filter(e => selectedIds.has(e.id));

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Удалить выбранные карточки (${selectedIds.size} шт.) насовсем? Это нельзя отменить.`)) return;
    await bulkDeleteEntities([...selectedIds]);
    showToast("Удалено");
    setSelectedIds(new Set());
    setSelectionMode(false);
    onChanged();
  }

  async function handleBulkSkip() {
    if (selectedIds.size === 0) return;
    for (const e of selectedEntities) {
      if (e.type === "habit") {
        const skipped: string[] = e.attributes?.skipped_dates || [];
        if (!skipped.includes(selectedDate)) {
          await updateEntityField(e.id, "skipped_dates", [...skipped, selectedDate]);
        }
      } else {
        await updateEntityField(e.id, "status", "skipped");
      }
    }
    showToast("Отменено");
    setSelectedIds(new Set());
    setSelectionMode(false);
    onChanged();
  }

  function openMovePicker() {
    if (moveButtonRef.current) {
      const rect = moveButtonRef.current.getBoundingClientRect();
      const estimatedHeight = 300; // с запасом под календарь или окно времени
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < estimatedHeight ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4;
      const left = Math.min(rect.left, window.innerWidth - 236);
      setMoveAnchor({ top, left: Math.max(8, left) });
    }
    setPendingMoveDate(null);
    setMoveTimeInput("");
    setMovePickerOpen(!movePickerOpen);
  }

  function cancelMove() {
    setMovePickerOpen(false);
    setPendingMoveDate(null);
  }

  async function confirmBulkMove() {
    if (!pendingMoveDate) return;
    const targetDate = pendingMoveDate;
    const targetTime = moveTimeInput.trim();
    for (const e of selectedEntities) {
      if (e.type === "habit") {
        const skipped: string[] = e.attributes?.skipped_dates || [];
        if (!skipped.includes(selectedDate)) {
          await updateEntityField(e.id, "skipped_dates", [...skipped, selectedDate]);
        }
        const attrs: Record<string, any> = { date: targetDate };
        if (targetTime) attrs.time = targetTime;
        if (e.attributes?.cover_path) attrs.cover_path = e.attributes.cover_path;
        await createEntity("task", `${e.name} (перенесено)`, attrs, e.space, e.profile);
      } else {
        await updateEntityField(e.id, "date", targetDate);
        if (targetTime) await updateEntityField(e.id, "time", targetTime);
      }
    }
    showToast("Перенесено");
    setMovePickerOpen(false);
    setPendingMoveDate(null);
    setSelectedIds(new Set());
    setSelectionMode(false);
    onChanged();
  }

  return (
    <div>
      <div className="edit-link" style={{ marginBottom: 10, display: "inline-block" }} onClick={toggleSelectionMode}>
        {selectionMode ? "Отменить выбор" : "Выбрать несколько"}
      </div>

      {sorted.map(e => (
        <div key={e.id} className="date-list-row">
          {selectionMode && (
            <input type="checkbox" className="select-check" checked={selectedIds.has(e.id)} onChange={() => toggleSelected(e.id)} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <EntityCard e={e} onChanged={onChanged} selectedDate={selectedDate} layout="sequential" />
          </div>
        </div>
      ))}

      {selectionMode && selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="muted">Выбрано: {selectedIds.size}</span>
          <div ref={moveButtonRef} className="why" onClick={openMovePicker}>Перенести</div>
          <div className="why danger-action" onClick={handleBulkSkip}>Отменить на {selectedDate}</div>
          <div className="why danger-action" onClick={handleBulkDelete}>Удалить</div>
        </div>
      )}

      {movePickerOpen && moveAnchor && createPortal(
        <>
          <div className="picker-overlay" onClick={(ev) => { ev.stopPropagation(); cancelMove(); }} />
          {!pendingMoveDate ? (
            <div style={{ position: "fixed", top: moveAnchor.top, left: moveAnchor.left, zIndex: 9999 }} onClick={(ev) => ev.stopPropagation()}>
              <MiniCalendar minDate={todayStr()} onSelect={setPendingMoveDate} />
            </div>
          ) : (
            <div className="move-time-picker" style={{ position: "fixed", top: moveAnchor.top, left: moveAnchor.left, zIndex: 9999 }} onClick={(ev) => ev.stopPropagation()}>
              <div className="muted" style={{ fontSize: "0.75rem", marginBottom: 6 }}>Перенос {selectedIds.size} карточек на {pendingMoveDate}</div>
              <input type="text" value={moveTimeInput} onChange={(ev) => setMoveTimeInput(ev.target.value)}
                placeholder="Время, напр. 19:00 (необязательно)" maxLength={5}
                style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", padding: 6, marginBottom: 8, width: "100%", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={confirmBulkMove}>Перенести</button>
                <button className="cancel" onClick={cancelMove}>Отмена</button>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </div>
  );
}
