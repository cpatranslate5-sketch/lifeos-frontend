const PROFILE_KEY = "lifeos_profile";

export type Folder = "nemalenkiy" | "kotyonok" | "pd";

export function getSavedFolder(): Folder | null {
  return (localStorage.getItem(PROFILE_KEY) as Folder) || null;
}
export function saveFolder(folder: Folder) {
  localStorage.setItem(PROFILE_KEY, folder);
}
export function clearSavedFolder() {
  localStorage.removeItem(PROFILE_KEY);
}

export default function ProfileGate({ onPick }: { onPick: (folder: Folder) => void }) {
  return (
    <div className="folder-gate">
      <h1 style={{ marginBottom: 24 }}>Life OS</h1>
      <div className="folder-options">
        <div className="folder-card" onClick={() => onPick("nemalenkiy")}>
          <div className="folder-emoji">🧑</div>
          <div>НеМаленький</div>
        </div>
        <div className="folder-card" onClick={() => onPick("kotyonok")}>
          <div className="folder-emoji">🐱</div>
          <div>Котёнок</div>
        </div>
        <div className="folder-card" onClick={() => onPick("pd")}>
          <div className="folder-emoji">📔</div>
          <div>PD</div>
        </div>
      </div>
    </div>
  );
}
