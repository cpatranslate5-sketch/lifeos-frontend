import { useEffect, useRef, useState } from "react";
import { DiaryEntry, fetchDiaryEntries, fetchDiaryRange, createDiaryEntry, addPhotosToDiaryEntry, deleteDiaryEntry, diaryPhotoUrl, importDiaryExcel } from "../api";
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

function ImportButton({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const res = await importDiaryExcel(files[0]);
      alert(`Импорт завершён: добавлено ${res.created}, пропущено дублей ${res.skipped_duplicates}.`);
      await onDone();
    } catch (e: any) {
      alert(`Не получилось импортировать: ${e.message}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx" style={{ display: "none" }}
        onChange={e => handleChange(e.target.files)} />
      <span className="edit-link" onClick={() => inputRef.current?.click()}>
        {busy ? "импортирую…" : "импорт из Excel"}
      </span>
    </>
  );
}

export default function Diary({ onSwitchFolder }: { onSwitchFolder: () => void }) {
  const [person, setPerson] = useState("nemalenkiy");
  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7)); // YYYY-MM
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("lifeos_theme") as "dark" | "light") || "dark");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("lifeos_theme", theme);
  }, [theme]);

  async function load() {
    setLoading(true);
    try {
      if (viewMode === "day") {
        setEntries(await fetchDiaryEntries(date, person));
      } else {
        const [y, m] = month.split("-").map(Number);
        const start = `${month}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const end = `${month}-${String(lastDay).padStart(2, "0")}`;
        setEntries(await fetchDiaryRange(start, end, person));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [date, month, person, viewMode]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const MONTHS_RU = ["", "январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

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
        <div style={{ display: "flex", gap: 14 }}>
          <ImportButton onDone={load} />
          <span className="why" onClick={onSwitchFolder}>сменить папку</span>
        </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div className={`why ${viewMode === "day" ? "" : ""}`} style={viewMode === "day" ? { color: "var(--project)", fontWeight: 600 } : {}} onClick={() => setViewMode("day")}>по дате</div>
          <div className="why" style={viewMode === "month" ? { color: "var(--project)", fontWeight: 600 } : {}} onClick={() => setViewMode("month")}>по месяцу</div>
        </div>

        {viewMode === "day" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div className="why" onClick={() => setDate(addDaysStr(date, -1))}>← назад</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", padding: "5px 8px", fontSize: "0.8rem" }} />
            <div className="why" onClick={() => setDate(addDaysStr(date, 1))}>вперёд →</div>
            {date !== todayValue && <span className="edit-link" onClick={() => setDate(todayValue)}>к сегодня</span>}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div className="why" onClick={() => shiftMonth(-1)}>← назад</div>
            <div style={{ fontWeight: 600 }}>{MONTHS_RU[Number(month.split("-")[1])]} {month.split("-")[0]}</div>
            <div className="why" onClick={() => shiftMonth(1)}>вперёд →</div>
            {month !== todayValue.slice(0, 7) && <span className="edit-link" onClick={() => setMonth(todayValue.slice(0, 7))}>к текущему</span>}
          </div>
        )}

        {viewMode === "day" && (
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
        )}

        {loading && <div className="muted">Загрузка…</div>}
        {!loading && entries.length === 0 && (
          <div className="muted">{viewMode === "day" ? `На ${date} записей нет.` : "За этот месяц записей нет."}</div>
        )}
        {entries.map((e, i) => (
          <div key={e.id}>
            {viewMode === "month" && (i === 0 || entries[i - 1].date !== e.date) && (
              <div className="diary-date-label">{e.date}</div>
            )}
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: "0.9rem", marginBottom: e.photo_paths.length ? 8 : 4 }}>{e.text}</div>
              {e.photo_paths.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {e.photo_paths.map(p => (
                    <img key={p} src={diaryPhotoUrl(p)} alt="" onClick={() => setLightbox(diaryPhotoUrl(p))}
                      style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)", cursor: "pointer" }} />
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                <AddPhotoButton entryId={e.id} onAdded={load} />
                <span className="why" style={{ color: "var(--event)" }} onClick={() => remove(e.id)}>удалить</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="lightbox-img" />
        </div>
      )}
    </div>
  );
}
