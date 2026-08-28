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
  const [chosenSpace, setChosenSpace] = useState<"life" | "work">("life");
  const askSpace = space === "general";
  const targetSpace = askSpace ? chosenSpace : space;

  async function submit() {
    if (!val.trim()) return;
    const attrs: Record<string, any> = { date };
    if (time) attrs.time = time;
    await createEntity("task", val.trim(), attrs, targetSpace, profile);
    setVal(""); setTime("");
    onAdded();
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
      {askSpace && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <label className={`status-chip ${chosenSpace === "life" ? "on" : ""}`}>
            <input type="radio" name="quick-space" checked={chosenSpace === "life"} onChange={() => setChosenSpace("life")} style={{ display: "none" }} />
            Жизнь
          </label>
          <label className={`status-chip ${chosenSpace === "work" ? "on" : ""}`}>
            <input type="radio" name="quick-space" checked={chosenSpace === "work"} onChange={() => setChosenSpace("work")} style={{ display: "none" }} />
            Работа
          </label>
        </div>
      )}
    </div>
  );
}
