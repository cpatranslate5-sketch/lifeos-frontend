import { useEffect, useRef, useState } from "react";
import { DiaryEntry, fetchDiaryEntries, createDiaryEntry, addPhotosToDiaryEntry, deleteDiaryEntry, diaryPhotoUrl } from "../api";
import { todayStr, addDaysStr } from "../dateUtils";

const PEOPLE: [string, string][] = [["nemalenkiy", "НеМаленький"], ["kotyonok", "Котёнок"]];

function AddPhotoButton({ entryId, onAdded }: { entryId: string; onAdded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      await addPhotosToDiaryEntry(entryId, Array.from(files));
      await onAdded();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={e => handleChange(e.target.files)} />
      <span className="why" onClick={() => inputRef.current?.click()}>
        {busy ? "загружаю…" : "+ добавить фото"}
      </span>
    </>
  );
}

export default function Diary({ onSwitchFolder }: { onSwitchFolder: () => void }) {
  const [person, setPerson] = useState("nemalenkiy");
  const [date, setDate] = useState(todayStr());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("lifeos_theme") as "dark" | "light") || "dark");

  useEffect(() => {
    document.body.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("lifeos_theme", theme);
  }, [theme]);

  async function load() {
    setLoading(true);
    try {
      setEntries(await fetchDiaryEntries(date, person));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [date, person]);

  async function submit() {
    if (!text.trim() && files.length === 0) return;
    setSubmitting(true);
    try {
      await createDiaryEntry(date, person, text.trim(), files);
      setText(""); setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить эту запись насовсем?")) return;
    await deleteDiaryEntry(id);
    await load();
  }

  const todayValue = todayStr();

  return (
    <div className="app">
      <div className="folder-bar">
        <span>PD</span>
        <span className="why" onClick={onSwitchFolder}>сменить папку</span>
      </div>
      <div className="space-switch">
        {PEOPLE.map(([k, label]) => (
          <div key={k} className={`space-btn ${person === k ? "on" : ""}`} onClick={() => setPerson(k)}>{label}</div>
        ))}
        <div className="theme-toggle" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Сменить тему">
          {theme === "dark" ? "☀️" : "🌙"}
        </div>
      </div>
      <div className="view">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div className="why" onClick={() => setDate(addDaysStr(date, -1))}>← назад</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", padding: "5px 8px", fontSize: "0.8rem" }} />
          <div className="why" onClick={() => setDate(addDaysStr(date, 1))}>вперёд →</div>
          {date !== todayValue && <span className="edit-link" onClick={() => setDate(todayValue)}>к сегодня</span>}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <textarea rows={3} value={text} onChange={e => setText(e.target.value)}
            placeholder="Что было? Например: Посмотрели Крепкий орешек, ходили в зоопарк…"
            style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", padding: 8, fontSize: "0.85rem", marginBottom: 8 }} />
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={e => setFiles(Array.from(e.target.files || []))}
            style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 8, display: "block" }} />
          <button onClick={submit} disabled={submitting}
            style={{ background: "var(--project)", border: "none", borderRadius: 8, padding: "8px 16px", color: "#14171F", fontWeight: 600, cursor: "pointer" }}>
            {submitting ? "Сохраняю…" : "Добавить запись"}
          </button>
        </div>

        {loading && <div className="muted">Загрузка…</div>}
        {!loading && entries.length === 0 && <div className="muted">На {date} записей нет.</div>}
        {entries.map(e => (
          <div key={e.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: "0.9rem", marginBottom: e.photo_paths.length ? 8 : 4 }}>{e.text}</div>
            {e.photo_paths.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                {e.photo_paths.map(p => (
                  <img key={p} src={diaryPhotoUrl(p)} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <AddPhotoButton entryId={e.id} onAdded={load} />
              <span className="why" style={{ color: "var(--event)" }} onClick={() => remove(e.id)}>удалить</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
