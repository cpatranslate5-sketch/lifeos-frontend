import { useState } from "react";
import { Entity, updateEntityField } from "../api";

// Поле «Серия» на карточке: название серии и номер части. Ручная правка
// помечается как manual, и автоматический поиск серий её больше не трогает.
export default function SeriesField({ e, onChanged }: { e: Entity; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [order, setOrder] = useState("");
  const cur = (e.attributes?.series as string) || "";
  const curOrder = Number(e.attributes?.series_order) || 0;

  function open() { setName(cur); setOrder(curOrder ? String(curOrder) : ""); setEditing(true); }
  async function save() {
    const n = name.trim();
    const o = parseFloat(order.replace(",", ".")) || 0;
    setEditing(false);
    if (n === cur && o === curOrder) return;
    await updateEntityField(e.id, "series", n || null);
    await updateEntityField(e.id, "series_order", n ? o : null);
    await updateEntityField(e.id, "series_source", "manual");
    onChanged();
  }

  if (editing) {
    return (
      <div className="field media-criterion series-edit" onClick={ev => ev.stopPropagation()}>
        <strong>Серия:</strong>
        <input autoFocus value={name} onChange={ev => setName(ev.target.value)} placeholder="напр. Гарри Поттер (пусто — не серия)"
          onKeyDown={ev => { if (ev.key === "Enter") save(); if (ev.key === "Escape") setEditing(false); }} />
        <input value={order} onChange={ev => setOrder(ev.target.value.replace(/[^0-9.,]/g, ""))} placeholder="№" inputMode="decimal" className="series-order-input"
          onKeyDown={ev => { if (ev.key === "Enter") save(); if (ev.key === "Escape") setEditing(false); }} />
        <button type="button" onClick={save}>OK</button>
      </div>
    );
  }
  return (
    <div className="field media-criterion" onClick={open}>
      <strong>Серия:</strong> {cur ? <>{cur}{curOrder ? ` · часть ${curOrder}` : ""}</> : "нет"}
      <span className="edit-pencil" onClick={ev => { ev.stopPropagation(); open(); }} title="Изменить">✎</span>
    </div>
  );
}
