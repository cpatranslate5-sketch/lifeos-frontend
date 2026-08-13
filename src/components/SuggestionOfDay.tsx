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

export default function SuggestionOfDay({ entities }: { entities: Entity[] }) {
  const candidates = entities.filter(e =>
    ["movie", "show", "book", "game"].includes(e.type) && !e.attributes?.done
  );
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id)); // stable order regardless of fetch order
  const idx = dailyIndex(todayStr(), sorted.length);
  const pick = sorted[idx];
  const verb = VERBS[pick.type] || "заняться";

  return (
    <div className="suggestion-of-day">
      <span className="suggestion-label">Предложение дня</span>
      <div>{verb} «{pick.name}»</div>
    </div>
  );
}
