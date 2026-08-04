import { useEffect, useState } from "react";
import Chat from "./components/Chat";
import EntityCard from "./components/EntityCard";
import ShelfTab from "./components/ShelfTab";
import LifephaseModal from "./components/LifephaseModal";
import Reflection from "./components/Reflection";
import { getToken, setToken, checkHealth, fetchEntities, getLifephase, Entity, Lifephase } from "./api";
import { todayStr, addDaysStr, weekdayOf } from "./dateUtils";

const TABS = [
  ["chat", "Чат"], ["yesterday", "Вчера"], ["today", "Сегодня"], ["tomorrow", "Завтра"],
  ["date", "Дата"], ["movies", "Кино"], ["shows", "Сериалы"], ["books", "Книги"],
  ["games", "Игры"], ["leisure", "Досуг"], ["household", "Быт"], ["reflection", "Рефлексия"],
] as const;

function itemsForDate(entities: Entity[], dateStr: string, isToday: boolean): Entity[] {
  const wd = weekdayOf(dateStr);
  return entities.filter(e => {
    if (e.attributes?.status === "skipped") return false;
    if (e.type === "event" || e.type === "task") {
      return e.attributes?.date === dateStr || (!e.attributes?.date && isToday);
    }
    if (e.type === "habit") {
      return e.attributes?.recurring && e.attributes?.weekday === wd &&
        !(e.attributes?.skipped_dates || []).includes(dateStr);
    }
    return false;
  });
}

function TokenGate({ onReady }: { onReady: () => void }) {
  const [tokenInput, setTokenInput] = useState("");
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  useEffect(() => { checkHealth().then(setApiUp); }, []);
  return (
    <div className="token-gate">
      <h1>Life OS</h1>
      <p>Введите личный токен доступа (см. backend/.env, APP_AUTH_TOKEN).</p>
      <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Токен доступа" />
      <button onClick={() => { setToken(tokenInput.trim()); onReady(); }} disabled={!tokenInput.trim()}>Войти</button>
      {apiUp === false && <p className="error-banner">Не удаётся связаться с сервером — проверьте, что backend запущен.</p>}
    </div>
  );
}

export default function App() {
  const [hasToken, setHasToken] = useState(!!getToken());
  const [tab, setTab] = useState("chat");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [lifephase, setLifephaseState] = useState<Lifephase | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showLPModal, setShowLPModal] = useState(false);

  const todayValue = todayStr();
  const tomorrowValue = addDaysStr(todayValue, 1);
  const yesterdayValue = addDaysStr(todayValue, -1);

  async function refresh() {
    const [ents, lp] = await Promise.all([fetchEntities(), getLifephase()]);
    setEntities(ents);
    setLifephaseState(lp);
  }

  useEffect(() => { if (hasToken) refresh(); }, [hasToken]);

  if (!hasToken) return <TokenGate onReady={() => setHasToken(true)} />;

  const movies = entities.filter(e => e.type === "movie");
  const shows = entities.filter(e => e.type === "show");
  const books = entities.filter(e => e.type === "book");
  const games = entities.filter(e => e.type === "game");
  const leisureItems = entities.filter(e => e.type === "leisure");
  const household = entities.filter(e => e.type === "task" && e.attributes?.category === "household");

  return (
    <div className="app">
      <div className="tabs">
        {TABS.map(([k, l]) => (
          <div key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</div>
        ))}
      </div>

      {tab === "chat" && <Chat onDataChanged={refresh} />}

      {tab === "yesterday" && (
        <div className="view">
          <h1>Вчера <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 400 }}>({yesterdayValue})</span></h1>
          {itemsForDate(entities, yesterdayValue, false).length === 0 && <div className="muted">На вчера ничего не найдено.</div>}
          {itemsForDate(entities, yesterdayValue, false).map(t => <EntityCard key={t.id} e={t} onChanged={refresh} selectedDate={yesterdayValue} />)}
        </div>
      )}

      {tab === "today" && (
        <div className="view">
          <h1>Сегодня</h1>
          <div className="lifephase-box">
            {lifephase ? (
              <>
                <div><strong>Фокус:</strong> {lifephase.focus}</div>
                {lifephase.priorities?.length > 0 && <ul className="lp-list">{lifephase.priorities.map((p, i) => <li key={i}>{p}</li>)}</ul>}
                {lifephase.constraints?.length > 0 && <div className="muted" style={{ marginTop: 6 }}>Ограничения: {lifephase.constraints.join(", ")}</div>}
              </>
            ) : <div className="muted">Текущий фокус не задан.</div>}
            <div className="edit-link" onClick={() => setShowLPModal(true)}>изменить фокус</div>
          </div>
          <h1 style={{ fontSize: "1.05rem" }}>Задачи и события</h1>
          {itemsForDate(entities, todayValue, true).length === 0 && <div className="muted">Пока пусто — появится из чата.</div>}
          {itemsForDate(entities, todayValue, true).map(t => <EntityCard key={t.id} e={t} onChanged={refresh} selectedDate={todayValue} />)}
        </div>
      )}

      {tab === "tomorrow" && (
        <div className="view">
          <h1>Завтра <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 400 }}>({tomorrowValue})</span></h1>
          {itemsForDate(entities, tomorrowValue, false).length === 0 && <div className="muted">На завтра пока ничего не найдено.</div>}
          {itemsForDate(entities, tomorrowValue, false).map(t => <EntityCard key={t.id} e={t} onChanged={refresh} selectedDate={tomorrowValue} />)}
        </div>
      )}

      {tab === "date" && (
        <div className="view">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>{selectedDate === todayValue ? "Сегодня" : (selectedDate === tomorrowValue ? "Завтра" : "Выбранный день")}</h1>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", padding: "5px 8px", fontSize: "0.8rem" }} />
            {selectedDate !== todayValue && <span className="edit-link" onClick={() => setSelectedDate(todayValue)}>к сегодня</span>}
          </div>
          {itemsForDate(entities, selectedDate, selectedDate === todayValue).length === 0 && <div className="muted">На {selectedDate} ничего не найдено.</div>}
          {itemsForDate(entities, selectedDate, selectedDate === todayValue).map(t => <EntityCard key={t.id} e={t} onChanged={refresh} selectedDate={selectedDate} />)}
        </div>
      )}

      {tab === "movies" && <ShelfTab title="Кино" placeholder="Название фильма…" type="movie" items={movies} onChanged={refresh} />}
      {tab === "shows" && <ShelfTab title="Сериалы" placeholder="Название сериала…" type="show" items={shows} onChanged={refresh} />}
      {tab === "books" && <ShelfTab title="Книги" placeholder="Название книги…" type="book" items={books} onChanged={refresh} />}
      {tab === "games" && <ShelfTab title="Игры" placeholder="Название игры…" type="game" items={games} onChanged={refresh} />}
      {tab === "leisure" && <ShelfTab title="Досуг" placeholder="Игра, футбол, поездка…" type="leisure" items={leisureItems} onChanged={refresh} />}
      {tab === "household" && <ShelfTab title="Быт" placeholder="Дело по дому…" type="task" items={household} onChanged={refresh} extraAttrs={{ category: "household" }} />}
      {tab === "reflection" && <Reflection />}

      {showLPModal && <LifephaseModal current={lifephase} onClose={() => setShowLPModal(false)} onSaved={refresh} />}
    </div>
  );
}
