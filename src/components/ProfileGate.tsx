import { useState } from "react";
import { checkFolderPassword } from "../api";

const PROFILE_KEY = "lifeos_profile";
export type Folder = "nemalenkiy" | "kotyonok" | "ilyusha" | "pd";
export function getSavedFolder(): Folder | null {
  return (localStorage.getItem(PROFILE_KEY) as Folder) || null;
}
export function saveFolder(folder: Folder) {
  localStorage.setItem(PROFILE_KEY, folder);
}
export function clearSavedFolder() {
  localStorage.removeItem(PROFILE_KEY);
}

const FOLDERS: { id: Folder; emoji: string; label: string }[] = [
  { id: "nemalenkiy", emoji: "🧑", label: "НеМаленький" },
  { id: "kotyonok", emoji: "🐱", label: "Котёнок" },
  { id: "ilyusha", emoji: "🧒", label: "Илюша" },
  { id: "pd", emoji: "📔", label: "PD" },
];

export default function ProfileGate({ onPick }: { onPick: (folder: Folder) => void }) {
  const [pendingFolder, setPendingFolder] = useState<Folder | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function tryPick(folder: Folder) {
    setChecking(true);
    const ok = await checkFolderPassword(folder, "");
    setChecking(false);
    if (ok) {
      onPick(folder);
    } else {
      setPendingFolder(folder);
      setPassword("");
      setError(false);
    }
  }

  async function submitPassword() {
    if (!pendingFolder) return;
    setChecking(true);
    const ok = await checkFolderPassword(pendingFolder, password);
    setChecking(false);
    if (ok) {
      onPick(pendingFolder);
    } else {
      setError(true);
    }
  }

  return (
    <div className="folder-gate">
      <img src="/icon-192.png" alt="Life OS" className="folder-gate-logo" />
      <div className="folder-options">
        {FOLDERS.map(f => (
          <div key={f.id} className="folder-card" onClick={() => !checking && tryPick(f.id)}>
            <div className="folder-emoji">{f.emoji}</div>
            <div>{f.label}</div>
          </div>
        ))}
      </div>

      {pendingFolder && (
        <div className="modal-bg" onClick={() => setPendingFolder(null)}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div style={{ marginBottom: 12 }}>Пароль для «{FOLDERS.find(f => f.id === pendingFolder)?.label}»</div>
            <input type="password" autoFocus value={password} onChange={ev => { setPassword(ev.target.value); setError(false); }}
              onKeyDown={ev => { if (ev.key === "Enter") submitPassword(); }} placeholder="Пароль" />
            {error && <div className="field" style={{ color: "var(--event)", marginBottom: 10 }}>Неверный пароль</div>}
            <div>
              <button onClick={submitPassword}>Войти</button>
              <button className="cancel" onClick={() => setPendingFolder(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
