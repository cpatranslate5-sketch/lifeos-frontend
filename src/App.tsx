import { useEffect, useState } from "react";
import Chat from "./components/Chat";
import DateList from "./components/DateList";
import ShelfTab from "./components/ShelfTab";
import LifephaseModal from "./components/LifephaseModal";
import Reflection from "./components/Reflection";
import QuickTaskAdd from "./components/QuickTaskAdd";
import LongTerm from "./components/LongTerm";
import Manage from "./components/Manage";
import DatesTab from "./components/DatesTab";
import { getToken, setToken, checkHealth, fetchEntities, getLifephase, createEntity, Entity, Lifephase } from "./api";
import { todayStr, addDaysStr, weekdayOf } from "./dateUtils";

const LIFE_TABS = [
  ["chat", "Чат"], ["yesterday", "Вчера"], ["today", "Сегодня"], ["tomorrow", "Завтра"],
  ["date", "Дата"], ["dates", "События"], ["movies", "Кино"], ["shows", "Сериалы"], ["books", "Книги"],
  ["games", "Игры"], ["leisure", "Досуг"], ["household", "Быт"], ["reflection", "Рефлексия"],
  ["manage", "Управление"],
] as const;

const WORK_TABS = [
  ["chat", "Чат"], ["yesterday", "Вчера"], ["today", "Сегодня"], ["tomorrow", "Завтра"],
  ["date", "Дата"], ["orders", "Заказы"], ["longterm", "Долгосрочное"], ["manage", "Управление"],
] as const;

const GENERAL_TABS = [
  ["yesterday", "Вчера"], ["today", "Сегодня"], ["tomorrow", "Завтра"], ["date", "Дата"],
] as const;

function itemsForDate(entities: Entity[], dateStr: string, isToday: boolean): Entity[] {
  const wd = weekdayOf(dateStr);
  return entities.filter(e => {
    if (e.attributes?.status === "skipped") return false;
    if (e.type === "event") {
      return e.attributes?.date === dateStr || (!e.attributes?.date && isToday);
    }
    if (e.type === "task") {
      if (e.attributes?.category === "household") {
        return e.attributes?.date === dateStr;
      }
      return e.attributes?.date === dateStr || (!e.attributes?.date && isToday);
    }
    if (e.type === "habit") {
      if (!e.attributes?.recurring) return false;
      if ((e.attributes?.skipped_dates || []).includes(dateStr)) return false;
      if (e.attributes?.until && dateStr > e.attributes.until) return false;
      if (e.attributes?.daily) return true;
      if (e.attributes?.workdays) return wd >= 0 && wd <= 4;
      return Number(e.attributes?.weekday) === wd;
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
  const [space, setSpace] = useState<"life" | "work" | "general">("life");
  const [tab, setTab] = useState("chat");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [lifephase, setLifephaseState] = useState<Lifephase | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showLPModal, setShowLPModal] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("lifeos_theme") as "dark" | "light") || "dark");

  useEffect(() => {
    document.body.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("lifeos_theme", theme);
  }, [theme]);

  const todayValue = todayStr();
  const tomorrowValue = addDaysStr(todayValue, 1);
  const yesterdayValue = addDaysStr(todayValue, -1);
  const TABS = space === "life" ? LIFE_TABS : space === "work" ? WORK_TABS : GENERAL_TABS;

  async function generateAnniversaryReminders(ents: Entity[]) {
    const today = todayStr();
    const [, tm, td] = today.split("-").map(Number);
    const in7 = addDaysStr(today, 7);
    const [, wm, wd] = in7.split("-").map(Number);

    const anniversaries = ents.filter(e => e.type === "anniversary");
    const existingMarkers = new Set(
      ents.filter(e => e.type === "task" && e.attributes?.reminder_marker).map(e => e.attributes.reminder_marker)
    );

    for (const a of anniversaries) {
      const m = a.attributes?.month, d = a.attributes?.day;
      if (!m || !d) continue;
      if (m === tm && d === td) {
        const marker = `${a.id}:${today}:on`;
        if (!existingMarkers.has(marker)) {
          await createEntity("task", `День рождения ${a.name}`, { date: today, reminder_marker: marker }, "life");
        }
      }
      if (m === wm && d === wd) {
        const marker = `${a.id}:${today}:week_before`;
        if (!existingMarkers.has(marker)) {
          await createEntity("task", `Через неделю День Рождения ${a.name}`, { date: today, reminder_marker: marker }, "life");
        }
      }
    }
  }

  async function refresh() {
    const [ents, lp] = await Promise.all([
      fetchEntities(undefined, space === "general" ? undefined : space),
      space === "life" ? getLifephase() : Promise.resolve(null),
    ]);
    if (space === "life") {
      await generateAnniversaryReminders(ents);
      const ents2 = await fetchEntities(undefined, space);
      setEntities(ents2);
    } else {
      setEntities(ents);
    }
    setLifephaseState(lp);
  }

  useEffect(() => { if (hasToken) refresh(); }, [hasToken, space]);

  function switchSpace(next: "life" | "work" | "general") {
    setSpace(next);
    setTab(next === "general" ? "today" : "chat");
  }

  if (!hasToken) return <TokenGate onReady={() => setHasToken(true)} />;

  const movies = entities.filter(e => e.type === "movie");
  const shows = entities.filter(e => e.type === "show");
  const books = entities.filter(e => e.type === "book");
  const games = entities.filter(e => e.type === "game");
  const leisureItems = entities.filter(e => e.type === "leisure");
  const household = entities.filter(e => e.type === "task" && e.attributes?.category === "household");
  const longTermItems = entities.filter(e => e.type === "project" || e.type === "goal");
  const orders = entities.filter(e => e.type === "order");
  const anniversaries = entities.filter(e => e.type === "anniversary");

  return (
    <div className="app">
      <div className="space-switch">
        <div className={`space-btn ${space === "life" ? "on" : ""}`} onClick={() => switchSpace("life")}>Жизнь</div>
        <div className={`space-btn ${space === "work" ? "on" : ""}`} onClick={() => switchSpace("work")}>Работа</div>
        <div className={`space-btn ${space === "general" ? "on" : ""}`} onClick={() => switchSpace("general")}>Общее</div>
        <div className="theme-toggle" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Сменить тему">
          {theme === "dark" ? "☀️" : "🌙"}
        </div>
      </div>
      <div className="tabs">
        {TABS.map(([k, l]) => (
          <div key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</div>
        ))}
      </div>

      {tab === "chat" && <Chat onDataChanged={refresh} space={space} />}

      {tab === "yesterday" && (
        <div className="view">
          <h1>Вчера <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 400 }}>({yesterdayValue})</span></h1>
          {space !== "general" && <QuickTaskAdd date={yesterdayValue} onAdded={refresh} space={space} />}
          {itemsForDate(entities, yesterdayValue, false).length === 0 && <div className="muted">На вчера ничего не найдено.</div>}
          <DateList items={itemsForDate(entities, yesterdayValue, false)} selectedDate={yesterdayValue} onChanged={refresh} />
        </div>
      )}

      {tab === "today" && (
        <div className="view">
          <h1>Сегодня</h1>
          {space === "life" && (
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
          )}
          <h1 style={{ fontSize: "1.05rem" }}>Задачи и события</h1>
          {space !== "general" && <QuickTaskAdd date={todayValue} onAdded={refresh} space={space} />}
          {itemsForDate(entities, todayValue, true).length === 0 && <div className="muted">Пока пусто — появится из чата.</div>}
          <DateList items={itemsForDate(entities, todayValue, true)} selectedDate={todayValue} onChanged={refresh} />
        </div>
      )}

      {tab === "tomorrow" && (
        <div className="view">
          <h1>Завтра <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 400 }}>({tomorrowValue})</span></h1>
          {space !== "general" && <QuickTaskAdd date={tomorrowValue} onAdded={refresh} space={space} />}
          {itemsForDate(entities, tomorrowValue, false).length === 0 && <div className="muted">На завтра пока ничего не найдено.</div>}
          <DateList items={itemsForDate(entities, tomorrowValue, false)} selectedDate={tomorrowValue} onChanged={refresh} />
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
          {space !== "general" && <QuickTaskAdd date={selectedDate} onAdded={refresh} space={space} />}
          {itemsForDate(entities, selectedDate, selectedDate === todayValue).length === 0 && <div className="muted">На {selectedDate} ничего не найдено.</div>}
          <DateList items={itemsForDate(entities, selectedDate, selectedDate === todayValue)} selectedDate={selectedDate} onChanged={refresh} />
        </div>
      )}

      {tab === "longterm" && <LongTerm items={longTermItems} space={space} onChanged={refresh} />}
      {tab === "orders" && <ShelfTab title="Заказы" placeholder="Номер/название заказа…" type="order" items={orders} onChanged={refresh} space={space} />}

      {tab === "movies" && <ShelfTab title="Кино" placeholder="Название фильма…" type="movie" items={movies} onChanged={refresh} />}
      {tab === "shows" && <ShelfTab title="Сериалы" placeholder="Название сериала…" type="show" items={shows} onChanged={refresh} />}
      {tab === "books" && <ShelfTab title="Книги" placeholder="Название книги…" type="book" items={books} onChanged={refresh} />}
      {tab === "games" && <ShelfTab title="Игры" placeholder="Название игры…" type="game" items={games} onChanged={refresh} />}
      {tab === "leisure" && <ShelfTab title="Досуг" placeholder="Игра, футбол, поездка…" type="leisure" items={leisureItems} onChanged={refresh} />}
      {tab === "household" && <ShelfTab title="Быт" placeholder="Дело по дому…" type="task" items={household} onChanged={refresh} extraAttrs={{ category: "household" }} />}
      {tab === "dates" && <DatesTab items={anniversaries} onChanged={refresh} />}
      {tab === "reflection" && <Reflection />}
      {tab === "manage" && <Manage entities={entities} onChanged={refresh} />}

      {showLPModal && <LifephaseModal current={lifephase} onClose={() => setShowLPModal(false)} onSaved={refresh} />}
    </div>
  );
}
