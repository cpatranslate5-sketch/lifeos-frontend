import { useState } from "react";
import { createEntity } from "../api";

export default function QuickTaskAdd({ date, onAdded }: { date: string; onAdded: () => void }) {
  const [val, setVal] = useState("");

  async function submit() {
    if (!val.trim()) return;
    await createEntity("task", val.trim(), { date });
    setVal("");
    onAdded();
  }

  return (
    <div className="addrow">
      <input value={val} placeholder="Добавить задачу на этот день…" onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); }} />
      <button onClick={submit}>+</button>
    </div>
  );
}
