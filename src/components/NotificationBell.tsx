import { useEffect, useState } from "react";
import { Entity, fetchEntities } from "../api";
import { todayStr } from "../dateUtils";

interface Notice {
  key: string;
  name: string;
  suffix: string;
  date: string;
}

const DISMISSED_KEY = "lifeos_dismissed_notices";

function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch { return new Set(); }
}
function addDismissed(key: string) {
  const s = getDismissed();
  s.add(key);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
}

function pad(n: number): string { return String(n).padStart(2, "0"); }

function computeNotices(tasks: Entity[]): Notice[] {
  const today = todayStr();
  const now = new Date();
  const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dismissed = getDismissed();
  const notices: Notice[] = [];

  for (const t of tasks) {
    if (t.attributes?.done) continue;
    const date = t.attributes?.date;
    if (!date) continue;

    let key: string | null = null;
    let suffix = "";
    if (date < today) {
      key = `${t.id}:overdue:${date}`;
      suffix = ` — не закрыта, была на ${date}`;
    } else if (date === today && t.attributes?.time && t.attributes.time < nowHM) {
      key = `${t.id}:late:${date}:${t.attributes.time}`;
      suffix = ` — просрочено, время было ${t.attributes.time}`;
    }
    if (key && !dismissed.has(key)) {
      notices.push({ key, name: t.name, suffix, date });
    }
  }
  return notices;
}

export default function NotificationBell({ profile, onNavigate, refreshTrigger }: { profile: string; onNavigate: (date: string) => void; refreshTrigger?: number }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);

  async function refresh() {
    try {
      const life = await fetchEntities("task", "life", profile);
      const work = await fetchEntities("task", "work", profile);
      setNotices(computeNotices([...life, ...work]));
    } catch {
      // silent — notifications are a nice-to-have, not critical
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [profile]);

  useEffect(() => {
    if (refreshTrigger !== undefined) refresh();
  }, [refreshTrigger]);

  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) { if (ev.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function goTo(n: Notice) {
    setOpen(false);
    onNavigate(n.date);
  }

  function dismiss(ev: React.MouseEvent, n: Notice) {
    ev.stopPropagation();
    addDismissed(n.key);
    setNotices(prev => prev.filter(x => x.key !== n.key));
  }

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
            {notices.map(n => (
              <div key={n.key} className="bell-notice">
                <span className="bell-notice-link" onClick={() => goTo(n)}>«{n.name}»</span>
                <span className="bell-notice-suffix">{n.suffix}</span>
                <span className="bell-notice-dismiss" onClick={(ev) => dismiss(ev, n)} title="Удалить уведомление">✕</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
