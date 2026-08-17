import { useEffect, useState } from "react";
import { getReflection, downloadExport } from "../api";
import { TYPES } from "../types";

export default function Reflection({ profile }: { profile: string }) {
  const [data, setData] = useState<{ activity_by_type: Record<string, number>; stalled: string[] } | null>(null);

  useEffect(() => { getReflection(profile).then(setData); }, [profile]);

  return (
    <div className="view">
      <h1>Рефлексия</h1>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>Активность за 7 дней</div>
        {!data || Object.keys(data.activity_by_type).length === 0
          ? <div className="muted">Пока нет данных за период.</div>
          : Object.entries(data.activity_by_type).map(([t, n]) => (
            <div key={t} className="field">{TYPES[t]?.label || t}: {n} изменени{n === 1 ? "е" : "й"}</div>
          ))}
      </div>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>Без активности 7+ дней</div>
        {!data || data.stalled.length === 0
          ? <div className="muted">Таких нет.</div>
          : data.stalled.map((s, i) => <div key={i} className="field">{s}</div>)}
      </div>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>Экспорт</div>
        <button onClick={() => downloadExport("json")} style={{ background: "var(--project)", border: "none", borderRadius: 8, padding: "8px 14px", color: "#14171F", fontWeight: 600, cursor: "pointer" }}>Скачать JSON</button>
      </div>
    </div>
  );
}
