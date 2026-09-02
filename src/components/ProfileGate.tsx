import { useState } from "react";
import { checkFolderPassword, setFolderPassword, folderHasPassword } from "../api";

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

function unlockedKey(folder: Folder): string { return `lifeos_unlocked_${folder}`; }
function isRemembered(folder: Folder): boolean { return localStorage.getItem(unlockedKey(folder)) === "true"; }
function remember(folder: Folder) { localStorage.setItem(unlockedKey(folder), "true"); }

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

  const [settingFolder, setSettingFolder] = useState<Folder | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setError_, setSetError] = useState("");

  async function tryPick(folder: Folder) {
    if (isRemembered(folder)) { onPick(folder); return; }
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
      remember(pendingFolder);
      onPick(pendingFolder);
    } else {
      setError(true);
    }
  }

  async function openSetPassword(ev: React.MouseEvent, folder: Folder) {
    ev.stopPropagation();
    const already = await folderHasPassword(folder);
    if (already) {
      alert("У этой папки уже есть пароль. Чтобы сменить его, сначала войдите с текущим паролем — смена пароля изнутри пока не реализована.");
      return;
    }
    setSettingFolder(folder);
    setNewPassword("");
    setConfirmPassword("");
    setSetError("");
  }

  async function submitNewPassword() {
    if (!settingFolder) return;
    if (!newPassword.trim()) { setSetError("Пароль не может быть пустым"); return; }
    if (newPassword !== confirmPassword) { setSetError("Пароли не совпадают"); return; }
    await setFolderPassword(settingFolder, newPassword);
    remember(settingFolder);
    setSettingFolder(null);
    onPick(settingFolder);
  }

  return (
    <div className="folder-gate">
      <img src="/icon-192.png" alt="Life OS" className="folder-gate-logo" />
      <div className="folder-options">
        {FOLDERS.map(f => (
          <div key={f.id} className="folder-card" onClick={() => !checking && tryPick(f.id)}>
            <div className="folder-emoji">{f.emoji}</div>
            <div>{f.label}</div>
            <div className="edit-link" style={{ marginLeft: "auto" }} onClick={(ev) => openSetPassword(ev, f.id)}>Задать пароль</div>
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

      {settingFolder && (
        <div className="modal-bg" onClick={() => setSettingFolder(null)}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div style={{ marginBottom: 12 }}>Задать пароль для «{FOLDERS.find(f => f.id === settingFolder)?.label}»</div>
            <input type="password" autoFocus value={newPassword} onChange={ev => { setNewPassword(ev.target.value); setSetError(""); }}
              placeholder="Новый пароль" style={{ marginBottom: 10 }} />
            <input type="password" value={confirmPassword} onChange={ev => { setConfirmPassword(ev.target.value); setSetError(""); }}
              onKeyDown={ev => { if (ev.key === "Enter") submitNewPassword(); }} placeholder="Повторите пароль" />
            {setError_ && <div className="field" style={{ color: "var(--event)", marginBottom: 10 }}>{setError_}</div>}
            <div>
              <button onClick={submitNewPassword}>Сохранить и войти</button>
              <button className="cancel" onClick={() => setSettingFolder(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
