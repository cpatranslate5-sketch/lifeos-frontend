import { useState } from "react";
import { Entity } from "../api";
import { todayStr } from "../dateUtils";

function dailyIndex(dateStr: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  return Math.abs(hash) % length;
}

const VERBS: Record<string, string> = {
  movie: "посмотреть", show: "посмотреть", book: "почитать", game: "поиграть в",
};

function offsetKey(dateStr: string): string {
  return `lifeos_suggestion_offset_${dateStr}`;
}

export default function SuggestionOfDay({ entities }: { entities: Entity[] }) {
  const today = todayStr();
  const [offset, setOffset] = useState(() => Number(localStorage.getItem(offsetKey(today)) || 0));

  const candidates = entities.filter(e =>
    ["movie", "show", "book", "game"].includes(e.type) && e.attributes?.status === "in_progress" && !e.attributes?.done
  );
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id)); // stable order regardless of fetch order
  const idx = (dailyIndex(today, sorted.length) + offset) % sorted.length;
  const pick = sorted[idx];
  const verb = VERBS[pick.type] || "заняться";

  function refresh() {
    const next = offset + 1;
    setOffset(next);
    localStorage.setItem(offsetKey(today), String(next));
  }

  return (
    <div className="suggestion-of-day">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="suggestion-label">Предложение дня</span>
        {sorted.length > 1 && (
          <span className="suggestion-refresh" onClick={refresh} title="Другое предложение">🔄</span>
        )}
      </div>
      <div>{verb} «{pick.name}»</div>
    </div>
  );
}
