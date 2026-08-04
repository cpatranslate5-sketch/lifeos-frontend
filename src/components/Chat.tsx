import { useEffect, useRef, useState } from "react";
import { Message, fetchMessages, sendMessage, downloadExport } from "../api";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages()
      .then(setMessages)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const { user_message, assistant_message } = await sendMessage(content);
      setMessages((prev) => [...prev, user_message, assistant_message]);
      setInput("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function handleExport(format: "json" | "md") {
    try {
      await downloadExport(format);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <span>Life OS — Chat</span>
        <div className="export-buttons">
          <button onClick={() => handleExport("json")} title="Для восстановления системы">
            Экспорт JSON
          </button>
          <button onClick={() => handleExport("md")} title="Для чтения человеком">
            Экспорт Markdown
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="messages">
        {loading && <div className="empty">Загрузка…</div>}
        {!loading && messages.length === 0 && (
          <div className="empty">Пока нет сообщений — напишите первое.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            <div className="bubble">{m.content}</div>
            <div className="meta">{new Date(m.event_timestamp).toLocaleString("ru-RU")}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="input-row">
        <input
          type="text"
          value={input}
          placeholder="Напишите сообщение…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button onClick={handleSend} disabled={sending}>
          Отправить
        </button>
      </div>
    </div>
  );
}
