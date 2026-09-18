import { useEffect, useState } from "react";
import { Entity, fetchEntities } from "../api";
import { todayStr, addDaysStr, weekdayOf } from "../dateUtils";
import { habitOccursOn, computeStreak } from "../habitUtils";

function mondayOf(dateStr: string): string {
  const wd = weekdayOf(dateStr); // 0=Пн..6=Вс
  return addDaysStr(dateStr, -wd);
}

const statBox: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10,
  padding: "10px 14px", marginBottom: 8,
};
const statNum: React.CSSProperties = { fontSize: "1.3rem", fontWeight: 700, color: "var(--project)" };

export default function WeeklyReport({ profile, onClose }: { profile: string; onClose: () => void }) {
  const [entities, setEntities] = useState<Entity[] | null>(null);

  useEffect(() => {
    fetchEntities(undefined, "life", profile).then(setEntities);
  }, [profile]);

  const today = todayStr();
  const monday = mondayOf(today);
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) weekDates.push(addDaysStr(monday, i));
  const sunday = weekDates[6];

  let content: JSX.Element;

  if (!entities) {
    content = <div className="muted">Считаю итоги…</div>;
  } else {
    const habits = entities.filter(e => e.type === "habit");
    let scheduled = 0, done = 0;
    const habitStats: { name: string; streak: number }[] = [];
    for (const h of habits) {
      let hs = 0, hd = 0;
      for (const d of weekDates) {
        if (d > today) continue; // ещё не наступившие дни этой недели не считаем
        if (habitOccursOn(h, d)) {
          hs++;
          if ((h.attributes?.done_dates || []).includes(d)) hd++;
        }
      }
      if (hs > 0) {
        scheduled += hs;
        done += hd;
        habitStats.push({ name: h.name, streak: computeStreak(h, today) });
      }
    }
    habitStats.sort((a, b) => b.streak - a.streak);
    const bestHabit = habitStats[0];

    const watched = entities.filter(e =>
      ["movie", "show"].includes(e.type) && e.attributes?.done &&
      e.updated_at.slice(0, 10) >= monday && e.updated_at.slice(0, 10) <= sunday
    );

    const tasksDone = entities.filter(e =>
      e.type === "task" && e.attributes?.done &&
      e.attributes?.date >= monday && e.attributes?.date <= sunday
    );

    content = (
      <>
        <div style={statBox}>
          <div style={statNum}>{scheduled > 0 ? `${done}/${scheduled}` : "—"}</div>
          <div className="muted">привычек выполнено на этой неделе</div>
        </div>

        {bestHabit && bestHabit.streak >= 2 && (
          <div style={statBox}>
            <div style={statNum}>🔥 {bestHabit.streak}</div>
            <div className="muted">лучший текущий стрик — «{bestHabit.name}»</div>
          </div>
        )}

        <div style={statBox}>
          <div style={statNum}>{tasksDone.length}</div>
          <div className="muted">задач выполнено на этой неделе</div>
        </div>

        <div style={statBox}>
          <div style={statNum}>{watched.length}</div>
          <div className="muted">фильмов/сериалов посмотрено</div>
        </div>

        {watched.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {watched.map(w => <div key={w.id} className="field">🎬 {w.name}</div>)}
          </div>
        )}

        {scheduled === 0 && tasksDone.length === 0 && watched.length === 0 && (
          <div className="muted">На этой неделе пока пусто — данные появятся по ходу недели.</div>
        )}
      </>
    );
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 380 }}>
        <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 2 }}>📊 Итоги недели</div>
        <div className="muted" style={{ marginBottom: 14 }}>{monday} — {sunday}</div>
        {content}
        <button className="cancel" style={{ marginTop: 14 }} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
