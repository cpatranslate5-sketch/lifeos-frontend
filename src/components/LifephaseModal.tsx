import { useState } from "react";
import { Lifephase, setLifephase } from "../api";

export default function LifephaseModal({ current, onClose, onSaved, profile }: { current: Lifephase | null; onClose: () => void; onSaved: () => void; profile: string }) {
  const [focus, setFocus] = useState(current?.focus || "");
  const [priorities, setPriorities] = useState((current?.priorities || []).join("\n"));
  const [constraints, setConstraints] = useState((current?.constraints || []).join("\n"));

  async function save() {
    await setLifephase({
      focus,
      priorities: priorities.split("\n").filter(Boolean),
      constraints: constraints.split("\n").filter(Boolean),
    }, profile);
    onSaved();
    onClose();
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Текущий фокус (LifePhase)</div>
        <label className="muted">Фокус</label>
        <input value={focus} onChange={e => setFocus(e.target.value)} placeholder="например: стабилизация быта и рост в работе" />
        <label className="muted">Приоритеты (по одному на строку, 2-5)</label>
        <textarea rows={3} value={priorities} onChange={e => setPriorities(e.target.value)} />
        <label className="muted">Ограничения (по одному на строку)</label>
        <textarea rows={2} value={constraints} onChange={e => setConstraints(e.target.value)} />
        <button onClick={save}>Сохранить</button>
        <button className="cancel" onClick={onClose}>Отмена</button>
      </div>
    </div>
  );
}
