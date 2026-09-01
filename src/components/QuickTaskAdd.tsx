import { useRef, useState } from "react";
import { createEntity, uploadEntityCover } from "../api";
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
  const [confirmPrompt, setConfirmPrompt] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const askSpace = space === "general";

  function pickCover(file: File | null | undefined) {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function handleCoverPaste(ev: React.ClipboardEvent) {
    const items = ev.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        ev.preventDefault();
        pickCover(items[i].getAsFile());
        return;
      }
    }
  }

  async function create(targetSpace: string) {
    const name = val.trim();
    const attrs: Record<string, any> = { date };
    if (time) attrs.time = time;
    const created = await createEntity("task", name, attrs, targetSpace, profile);
    if (coverFile) await uploadEntityCover(created.id, coverFile);
    if (remindDayBefore) {
      const reminderDate = addDaysStr(date, -1);
      await createEntity("task", `Напоминание на завтра: «${name}»`, { date: reminderDate }, targetSpace, profile);
    }
    setVal(""); setTime(""); setRemindDayBefore(false); setConfirmPrompt(false);
    setCoverFile(null); setCoverPreview(null);
    onAdded();
  }

  function submit() {
    if (!val.trim()) return;
    setConfirmPrompt(true);
  }

  return (
    <div>
      <div className="addrow">
        <input value={val} placeholder="Добавить задачу на этот день…" onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} style={{ flex: 2 }} />
        <input type="text" value={time} onChange={e => setTime(e.target.value)} placeholder="19:00" maxLength={5}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, padding: "0 8px", color: "var(--text)", fontSize: "0.82rem", width: 100 }} />
        <button className="btn-add-plus" onClick={submit}>+</button>
      </div>

      {confirmPrompt && (
        <div className="modal-bg" onClick={() => setConfirmPrompt(false)}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div style={{ marginBottom: 12 }}>{askSpace ? "Куда добавить задачу?" : "Добавить задачу?"}</div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <div className="cover-thumb" tabIndex={0} onPaste={handleCoverPaste} title="Нажмите сюда и вставьте (Ctrl+V) картинку">
                <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(ev) => pickCover(ev.target.files?.[0])} />
                {coverPreview ? <img src={coverPreview} alt="" /> : <span className="cover-placeholder">🖼️</span>}
                <div className="cover-pick-btn" title="Выбрать файл с компьютера"
                  onClick={(ev) => { ev.stopPropagation(); coverInputRef.current?.click(); }}>📁</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className={`status-chip ${remindDayBefore ? "on" : ""}`} style={{ display: "inline-flex" }}>
                <input type="checkbox" checked={remindDayBefore} onChange={e => setRemindDayBefore(e.target.checked)} />
                Напомнить за сутки
              </label>
            </div>
            <div>
              {askSpace ? (
                <>
                  <button onClick={() => create("life")}>Жизнь</button>
                  <button onClick={() => create("work")}>Работа</button>
                </>
              ) : (
                <button onClick={() => create(space)}>Добавить</button>
              )}
              <button className="cancel" onClick={() => setConfirmPrompt(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
