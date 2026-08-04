const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "lifeos_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
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

export interface Entity {
  id: string;
  type: string;
  name: string;
  attributes: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lifephase {
  focus: string;
  priorities: string[];
  constraints: string[];
}

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res;
}

export async function fetchMessages(conversationId = "default"): Promise<Message[]> {
  const res = await req(`/messages?conversation_id=${encodeURIComponent(conversationId)}`);
  return res.json();
}

export async function sendMessage(content: string, today: string, conversationId = "default"): Promise<Message[]> {
  const res = await req("/messages", {
    method: "POST",
    body: JSON.stringify({ content, conversation_id: conversationId, today }),
  });
  return res.json();
}

export async function fetchEntities(type?: string): Promise<Entity[]> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  const res = await req(`/entities${qs}`);
  return res.json();
}

export async function createEntity(type: string, name: string, attributes: Record<string, any> = {}): Promise<Entity> {
  const res = await req("/entities", { method: "POST", body: JSON.stringify({ type, name, attributes }) });
  return res.json();
}

export async function updateEntityField(id: string, key: string, value: any): Promise<Entity> {
  const res = await req(`/entities/${id}/field`, { method: "PATCH", body: JSON.stringify({ key, value }) });
  return res.json();
}

export async function renameEntity(id: string, name: string): Promise<Entity> {
  const res = await req(`/entities/${id}/rename`, { method: "PATCH", body: JSON.stringify({ name }) });
  return res.json();
}

export async function deleteEntity(id: string): Promise<void> {
  await req(`/entities/${id}`, { method: "DELETE" });
}

export async function entityHistory(id: string): Promise<any[]> {
  const res = await req(`/entities/${id}/history`);
  return res.json();
}

export async function getLifephase(): Promise<Lifephase | null> {
  const res = await req("/lifephase");
  return res.json();
}
export async function setLifephase(lp: Lifephase): Promise<Lifephase> {
  const res = await req("/lifephase", { method: "PUT", body: JSON.stringify(lp) });
  return res.json();
}

export async function getReflection(): Promise<{ activity_by_type: Record<string, number>; stalled: string[] }> {
  const res = await req("/reflection");
  return res.json();
}

export async function downloadExport(format: "json" | "md"): Promise<void> {
  const res = await req(`/export?format=${format}`);
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : `lifeos-export.${format}`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch { return false; }
}
