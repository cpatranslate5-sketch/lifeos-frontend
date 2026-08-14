import { useState } from "react";
import { createEntity } from "../api";

export default function QuickTaskAdd({ date, onAdded, space }: { date: string; onAdded: () => void; space: string }) {
  const [val, setVal] = useState("");
  const [time, setTime] = useState("");

  async function submit() {
    if (!val.trim()) return;
    const attrs: Record<string, any> = { date };
    if (time) attrs.time = time;
    await createEntity("task", val.trim(), attrs, space);
    setVal(""); setTime("");
    onAdded();
  }

  return (
    <div className="addrow">
      <input value={val} placeholder="Добавить задачу на этот день…" onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); }} style={{ flex: 2 }} />
      <input type="time" value={time} onChange={e => setTime(e.target.value)}
        style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "0 8px", color: "var(--text)", fontSize: "0.82rem", width: 100 }} />
      <button onClick={submit}>+</button>
    </div>
  );
}
