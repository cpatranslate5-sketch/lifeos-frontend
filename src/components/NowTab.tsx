import { Entity } from "../api";
import EntityCard from "./EntityCard";
import { SeriesCatalog } from "../seriesActions";

// Вкладка «Сейчас»: всё, что отмечено как «смотрю / читаю / играю сейчас»,
// сразу по всем медиа-разделам. Отдельно — сериалы, где ждёшь новый сезон.
const SECTIONS: [string, string, string][] = [
  ["movie", "Кино", "Смотрю"],
  ["show", "Сериалы", "Смотрю"],
  ["book", "Книги", "Читаю"],
  ["game", "Игры", "Играю"],
];

const isNow = (e: Entity) => e.attributes?.status === "in_progress" && !e.attributes?.done;
const isWaiting = (e: Entity) => e.attributes?.status === "waiting_season" && !e.attributes?.done;

export default function NowTab({ items, onChanged, profile }: { items: Entity[]; onChanged: () => void; profile?: string }) {
  const now = items.filter(isNow);
  const waiting = items.filter(e => e.type === "show" && isWaiting(e));

  return (
    <div className="view">
      <h1>▶ Сейчас</h1>
      <div className="muted now-summary">
        {now.length === 0
          ? "Пока ничего не отмечено. В карточке фильма, сериала, книги или игры нажми «Хочу — отметить как «сейчас»», и она появится здесь."
          : SECTIONS.map(([t, label]) => { const n = now.filter(e => e.type === t).length; return n ? `${label.toLowerCase()}: ${n}` : null; })
              .filter(Boolean).join(" · ")}
      </div>

      {SECTIONS.map(([t, label, verb]) => {
        const list = now.filter(e => e.type === t);
        if (!list.length) return null;
        return (
          <SeriesCatalog.Provider key={t} value={items.filter(e => e.type === t)}>
            <section className="now-section">
              <h2 className="now-title">{label} <span className="muted">· {verb.toLowerCase()} сейчас {list.length}</span></h2>
              {list.map(e => <EntityCard key={e.id} e={e} onChanged={onChanged} profile={profile} />)}
            </section>
          </SeriesCatalog.Provider>
        );
      })}

      {waiting.length > 0 && (
        <SeriesCatalog.Provider value={items.filter(e => e.type === "show")}>
          <section className="now-section">
            <h2 className="now-title">🔔 Жду новый сезон <span className="muted">· {waiting.length}</span></h2>
            {waiting.map(e => <EntityCard key={e.id} e={e} onChanged={onChanged} profile={profile} />)}
          </section>
        </SeriesCatalog.Provider>
      )}
    </div>
  );
}
