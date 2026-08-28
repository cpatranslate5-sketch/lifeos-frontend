import { useEffect, useState } from "react";
import { Entity, fetchEntities } from "../api";
import { todayStr } from "../dateUtils";

interface Notice {
  id: string;
  text: string;
}

function pad(n: number): string { return String(n).padStart(2, "0"); }

function computeNotices(tasks: Entity[]): Notice[] {
  const today = todayStr();
  const now = new Date();
  const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const notices: Notice[] = [];

  for (const t of tasks) {
    if (t.attributes?.done) continue;
    const date = t.attributes?.date;
    if (!date) continue;

    if (date < today) {
      notices.push({ id: t.id, text: `Не закрыта задача «${t.name}» — была на ${date}` });
    } else if (date === today && t.attributes?.time && t.attributes.time < nowHM) {
      notices.push({ id: t.id, text: `Просрочена задача «${t.name}» — время было ${t.attributes.time}` });
    }
  }
  return notices;
}

export default function NotificationBell({ profile }: { profile: string }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);

  async function refresh() {
    try {
      const tasks = await fetchEntities("task", undefined, profile);
      setNotices(computeNotices(tasks));
    } catch {
      // silent — notifications are a nice-to-have, not critical
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000); // проверяем раз в минуту
    return () => clearInterval(timer);
  }, [profile]);

  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) { if (ev.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="theme-toggle" style={{ position: "relative" }} onClick={() => setOpen(!open)} title="Уведомления">
      🔔
      {notices.length > 0 && <span className="bell-badge">{notices.length}</span>}
      {open && (
        <>
          <div className="picker-overlay" onClick={(ev) => { ev.stopPropagation(); setOpen(false); }} />
          <div className="bell-dropdown" onClick={(ev) => ev.stopPropagation()}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Уведомления</div>
            {notices.length === 0 && <div className="muted" style={{ fontSize: "0.8rem" }}>Пока всё закрыто вовремя.</div>}
            {notices.map(n => <div key={n.id} className="field" style={{ marginBottom: 6 }}>{n.text}</div>)}
          </div>
        </>
      )}
    </div>
  );
}
