import { useState } from "react";
import { createEntity } from "../api";
import { addDaysStr } from "../dateUtils";

interface Props {
  date: string;
  onAdded: () => void;
  space: string; // "life" | "work" | "general"
  profile: string;
}

export default function QuickTaskAdd({ date, onAdded, space, profile }: Props) {
  const [val, setVal] = useState("");
  const [time, setTime] = useState("");
  const [remindDayBefore, setRemindDayBefore] = useState(false);
  const [askSpacePrompt, setAskSpacePrompt] = useState(false);
  const askSpace = space === "general";

  async function create(targetSpace: string) {
    const name = val.trim();
    const attrs: Record<string, any> = { date };
    if (time) attrs.time = time;
    await createEntity("task", name, attrs, targetSpace, profile);
    if (remindDayBefore) {
      const reminderDate = addDaysStr(date, -1);
      await createEntity("task", `Напоминание на завтра: «${name}»`, { date: reminderDate }, targetSpace, profile);
    }
    setVal(""); setTime(""); setRemindDayBefore(false); setAskSpacePrompt(false);
    onAdded();
  }

  function submit() {
    if (!val.trim()) return;
    if (askSpace) { setAskSpacePrompt(true); return; }
    create(space);
  }

  return (
    <div>
      <div className="addrow">
        <input value={val} placeholder="Добавить задачу на этот день…" onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} style={{ flex: 2 }} />
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "0 8px", color: "var(--text)", fontSize: "0.82rem", width: 100 }} />
        <button onClick={submit}>+</button>
      </div>
      <label className={`status-chip ${remindDayBefore ? "on" : ""}`} style={{ marginBottom: 12, display: "inline-flex" }}>
        <input type="checkbox" checked={remindDayBefore} onChange={e => setRemindDayBefore(e.target.checked)} />
        Напомнить за сутки
      </label>

      {askSpacePrompt && (
        <div className="modal-bg" onClick={() => setAskSpacePrompt(false)}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div style={{ marginBottom: 12 }}>Куда добавить задачу?</div>
            <button onClick={() => create("life")}>Жизнь</button>
            <button onClick={() => create("work")}>Работа</button>
            <button className="cancel" onClick={() => setAskSpacePrompt(false)}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
