const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "lifeos_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Message {
  id: number;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  event_timestamp: string;
  created_at: string;
}

export async function fetchMessages(conversationId = "default"): Promise<Message[]> {
  const res = await fetch(`${API_URL}/messages?conversation_id=${encodeURIComponent(conversationId)}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`);
  return res.json();
}

export async function sendMessage(
  content: string,
  conversationId = "default"
): Promise<{ user_message: Message; assistant_message: Message }> {
  const res = await fetch(`${API_URL}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content, conversation_id: conversationId }),
  });
  if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
  return res.json();
}

export async function downloadExport(format: "json" | "md"): Promise<void> {
  const res = await fetch(`${API_URL}/export?format=${format}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);

  // Filename comes from the backend's Content-Disposition header.
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : `lifeos-export.${format}`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
