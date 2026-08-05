import { useEffect, useRef, useState } from "react";
import { Message, fetchMessages, sendMessage, downloadExport } from "../api";
import { todayStr } from "../dateUtils";

export default function Chat({ onDataChanged, space }: { onDataChanged: () => void; space: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchMessages(space).then(setMessages).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [space]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true); setError(null);
    try {
      const newMsgs = await sendMessage(content, todayStr(), space, space);
      setMessages(prev => [...prev, ...newMsgs]);
      setInput("");
      onDataChanged();
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  }

  async function handleExport(format: "json" | "md") {
    try { await downloadExport(format); } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <span>Life OS — Чат</span>
        <div className="export-buttons">
          <button onClick={() => handleExport("json")}>Экспорт JSON</button>
          <button onClick={() => handleExport("md")}>Экспорт Markdown</button>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="messages">
        {loading && <div className="empty">Загрузка…</div>}
        {!loading && messages.length === 0 && <div className="empty">Пока нет сообщений — напишите первое.</div>}
        {messages.map(m => (
          <div key={m.id} className={`message ${m.role}`}>
            <div className="bubble">{m.content}</div>
            <div className="meta">{new Date(m.event_timestamp).toLocaleString("ru-RU")}</div>
          </div>
        ))}
        {sending && <div className="thinking">анализирую…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="input-row">
        <input value={input} placeholder="Напишите сообщение…" onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSend(); }} />
        <button onClick={handleSend} disabled={sending}>➤</button>
      </div>
    </div>
  );
}
