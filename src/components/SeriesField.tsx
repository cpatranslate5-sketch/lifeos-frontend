import { useMemo, useState } from "react";
import { Entity, updateEntityField } from "../api";
import { seriesName } from "../series";
import { useSeriesCatalog, seriesOfType, removeFromSeries } from "../seriesActions";
import SeriesModal from "./SeriesModal";

// Поле «Серия» на карточке, которая уже в серии: название и номер части.
// По нажатию — номер части, «перенести в другую серию», «убрать из серии».
// (Карточки без серии добавляются кнопкой «Добавить в серию» внизу карточки.)
export default function SeriesField({ e, onChanged }: { e: Entity; onChanged: () => void }) {
  const catalog = useSeriesCatalog();
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const cur = seriesName(e);
  const curOrder = Number(e.attributes?.series_order) || 0;
  const members = useMemo(
    () => seriesOfType(catalog, e.type).find(s => s.name.toLowerCase() === (cur || "").toLowerCase())?.members || [e],
    [catalog, e, cur]);

  if (!cur) return null;

  async function setOrder(v: string) {
    const o = parseFloat(v.replace(",", ".")) || 0;
    if (o === curOrder) return;
    await updateEntityField(e.id, "series_order", o || null);
    await updateEntityField(e.id, "series_source", "manual");
    onChanged();
  }
  async function leave() {
    setBusy(true);
    try { await removeFromSeries(e, members); setOpen(false); onChanged(); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="field media-criterion" onClick={() => setOpen(!open)}>
        <strong>Серия:</strong> {cur}{curOrder ? ` · часть ${curOrder}` : ""}
        <span className="edit-pencil" onClick={ev => { ev.stopPropagation(); setOpen(!open); }} title="Изменить">✎</span>
      </div>
      {open && (
        <div className="series-picker" onClick={ev => ev.stopPropagation()}>
          <div className="series-picker-current">
            <span>Номер части</span>
            <input className="series-order-input" defaultValue={curOrder || ""} inputMode="decimal"
              onBlur={ev => setOrder(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
            <button type="button" className="series-chip" disabled={busy} onClick={() => setMoving(true)}>Перенести в другую серию</button>
            <button type="button" className="series-chip danger" disabled={busy} onClick={leave}>Убрать из серии</button>
          </div>
        </div>
      )}
      {moving && <SeriesModal mode="add" type={e.type} card={e} onClose={() => setMoving(false)} onDone={() => { setOpen(false); onChanged(); }} />}
    </>
  );
}
