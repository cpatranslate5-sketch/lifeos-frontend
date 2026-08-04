import { useEffect, useState } from "react";
import Chat from "./components/Chat";
import { getToken, setToken, checkHealth } from "./api";

export default function App() {
  const [hasToken, setHasToken] = useState(!!getToken());
  const [tokenInput, setTokenInput] = useState("");
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth().then(setApiUp);
  }, []);

  if (!hasToken) {
    return (
      <div className="token-gate">
        <h1>Life OS</h1>
        <p>Введите личный токен доступа (см. backend/.env, APP_AUTH_TOKEN).</p>
        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Токен доступа"
        />
        <button
          onClick={() => {
            setToken(tokenInput.trim());
            setHasToken(true);
          }}
          disabled={!tokenInput.trim()}
        >
          Войти
        </button>
        {apiUp === false && (
          <p className="error-banner">Не удаётся связаться с сервером — проверьте, что backend запущен.</p>
        )}
      </div>
    );
  }

  return <Chat />;
}
