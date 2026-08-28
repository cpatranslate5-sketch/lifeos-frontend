import { useState } from "react";
import { createEntity } from "../api";

interface Props {
  date: string;
  onAdded: () => void;
  space: string; // "life" | "work" | "general"
  profile: string;
}

export default function QuickTaskAdd({ date, onAdded, space, profile }: Props) {
  const [val, setVal] = useState("");
  const [time, setTime] = useState("");
  const [askSpacePrompt, setAskSpacePrompt] = useState(false);
  const askSpace = space === "general";

  async function create(targetSpace: string) {
    const attrs: Record<string, any> = { date };
    if (time) attrs.time = time;
    await createEntity("task", val.trim(), attrs, targetSpace, profile);
    setVal(""); setTime(""); setAskSpacePrompt(false);
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
