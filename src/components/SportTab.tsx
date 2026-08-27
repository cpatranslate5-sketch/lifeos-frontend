import { useState } from "react";
import { Entity, createEntity, markSport } from "../api";
import { todayStr } from "../dateUtils";
import EntityCard from "./EntityCard";
import { showToast } from "../toast";

export default function SportTab({ items, onChanged, profile }: { items: Entity[]; onChanged: () => void; profile: string }) {
  const [name, setName] = useState("");
  const [dateVal, setDateVal] = useState("");
  const [showMigrate, setShowMigrate] = useState(false);
  const [migrateKeyword, setMigrateKeyword] = useState("");
  const today = todayStr();

  async function submit() {
    if (!name.trim() || !dateVal) return;
    await createEntity("event", name.trim(), { date: dateVal, category: "sport" }, "life", profile);
    setName(""); setDateVal("");
    onChanged();
  }

  async function doMigrate() {
    if (!migrateKeyword.trim()) { setShowMigrate(false); return; }
    const res = await markSport(migrateKeyword.trim(), profile);
    showToast(res.updated > 0 ? `Перенесено: ${res.updated}` : "Совпадений не найдено");
    setShowMigrate(false);
    setMigrateKeyword("");
    onChanged();
  }

  const upcoming = items.filter(e => e.attributes?.date >= today).sort((a, b) => a.attributes.date.localeCompare(b.attributes.date));
  const past = items.filter(e => e.attributes?.date < today).sort((a, b) => b.attributes.date.localeCompare(a.attributes.date));

  return (
    <div className="view">
      <h1>Спорт</h1>

      <div className="addrow">
        <input value={name} placeholder="Название события…" onChange={e => setName(e.target.value)}
          style={{ flex: 2 }} onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "0 10px", color: "var(--text)", fontSize: "0.82rem" }} />
        <button onClick={submit}>+</button>
      </div>

      <div className="edit-link" style={{ marginBottom: 14, display: "inline-block" }} onClick={() => setShowMigrate(!showMigrate)}>
        {showMigrate ? "Скрыть" : "Перенести уже созданные события сюда"}
      </div>

      {showMigrate && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="muted" style={{ marginBottom: 6 }}>Все события (из "Дата"/"Сегодня" и т.п.) с этим текстом в названии станут "спортом" и появятся здесь.</div>
          <input autoFocus value={migrateKeyword} onChange={e => setMigrateKeyword(e.target.value)}
            placeholder="Например: Манчестер Юнайтед" onKeyDown={e => { if (e.key === "Enter") doMigrate(); }} style={{ marginBottom: 8 }} />
          <button onClick={doMigrate}>Перенести</button>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && <div className="muted">Пока пусто.</div>}

      {upcoming.map(e => <EntityCard key={e.id} e={e} onChanged={onChanged} profile={profile} />)}

      {past.length > 0 && (
        <>
          <div className="diary-date-label">Прошедшие</div>
          {past.map(e => <EntityCard key={e.id} e={e} onChanged={onChanged} profile={profile} />)}
        </>
      )}
    </div>
  );
}
