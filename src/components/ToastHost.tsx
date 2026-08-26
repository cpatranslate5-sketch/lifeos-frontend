import { useEffect, useState } from "react";

export default function ToastHost() {
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);

  useEffect(() => {
    let counter = 0;
    function onToast(e: Event) {
      const id = counter++;
      const text = (e as CustomEvent).detail as string;
      setMessages(prev => [...prev, { id, text }]);
      setTimeout(() => setMessages(prev => prev.filter(m => m.id !== id)), 2000);
    }
    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, []);

  if (messages.length === 0) return null;

  return (
    <div className="toast-host">
      {messages.map(m => <div key={m.id} className="toast">{m.text}</div>)}
    </div>
  );
}
