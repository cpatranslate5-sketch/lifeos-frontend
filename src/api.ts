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
  profile: string;
  space: string;
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

export interface DiaryEntry {
  id: string;
  profile: string;
  date: string;
  text: string;
  photo_paths: string[];
  created_at: string;
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

export async function sendMessage(content: string, today: string, conversationId = "default", space = "life", profile = "nemalenkiy"): Promise<Message[]> {
  const res = await req("/messages", {
    method: "POST",
    body: JSON.stringify({ content, conversation_id: conversationId, today, space, profile }),
  });
  return res.json();
}

export async function fetchEntities(type?: string, space?: string, profile?: string): Promise<Entity[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (space) params.set("space", space);
  if (profile) params.set("profile", profile);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await req(`/entities${qs}`);
  return res.json();
}

export async function createEntity(type: string, name: string, attributes: Record<string, any> = {}, space = "life", profile = "nemalenkiy"): Promise<Entity> {
  const res = await req("/entities", { method: "POST", body: JSON.stringify({ type, name, attributes, space, profile }) });
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

export async function bulkDeleteEntities(ids: string[]): Promise<number> {
  const res = await req("/entities/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
  const data = await res.json();
  return data.deleted;
}

export async function entityHistory(id: string): Promise<any[]> {
  const res = await req(`/entities/${id}/history`);
  return res.json();
}

export async function getLifephase(profile = "nemalenkiy"): Promise<Lifephase | null> {
  const res = await req(`/lifephase?profile=${encodeURIComponent(profile)}`);
  return res.json();
}
export async function setLifephase(lp: Lifephase, profile = "nemalenkiy"): Promise<Lifephase> {
  const res = await req(`/lifephase?profile=${encodeURIComponent(profile)}`, { method: "PUT", body: JSON.stringify(lp) });
  return res.json();
}

export async function getReflection(profile = "nemalenkiy"): Promise<{ activity_by_type: Record<string, number>; stalled: string[] }> {
  const res = await req(`/reflection?profile=${encodeURIComponent(profile)}`);
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

// --- Diary (PD folder) ---

export async function fetchDiaryEntries(date: string, profile?: string): Promise<DiaryEntry[]> {
  const params = new URLSearchParams({ date });
  if (profile) params.set("profile", profile);
  const res = await req(`/diary?${params.toString()}`);
  return res.json();
}

export async function fetchDiaryRange(start: string, end: string, profile?: string): Promise<DiaryEntry[]> {
  const params = new URLSearchParams({ start, end });
  if (profile) params.set("profile", profile);
  const res = await req(`/diary/range?${params.toString()}`);
  return res.json();
}

export async function createDiaryEntry(date: string, profile: string, text: string, files: File[]): Promise<DiaryEntry> {
  const form = new FormData();
  form.append("date", date);
  form.append("profile", profile);
  form.append("text", text);
  for (const f of files) form.append("files", f);
  const res = await fetch(`${API_URL}/diary`, { method: "POST", headers: { ...authHeaders() }, body: form });
  if (!res.ok) throw new Error(`diary create failed: ${res.status}`);
  return res.json();
}

export async function addPhotosToDiaryEntry(id: string, files: File[]): Promise<DiaryEntry> {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const res = await fetch(`${API_URL}/diary/${id}/photos`, { method: "POST", headers: { ...authHeaders() }, body: form });
  if (!res.ok) throw new Error(`diary add photos failed: ${res.status}`);
  return res.json();
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  await req(`/diary/${id}`, { method: "DELETE" });
}

export async function editDiaryEntry(id: string, text: string): Promise<DiaryEntry> {
  const res = await req(`/diary/${id}`, { method: "PATCH", body: JSON.stringify({ text }) });
  return res.json();
}

export async function importDiaryExcel(file: File): Promise<{ created: number; skipped_duplicates: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/diary/import`, { method: "POST", headers: { ...authHeaders() }, body: form });
  if (!res.ok) throw new Error(`import failed: ${res.status}`);
  return res.json();
}

export function diaryPhotoUrl(filename: string): string {
  return `${API_URL}/diary/photo/${filename}`;
}

// --- PD diary AI chat ---

export interface DiaryChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  event_timestamp: string;
}

export async function fetchDiaryChatHistory(): Promise<DiaryChatMessage[]> {
  const res = await req("/diary/chat");
  return res.json();
}

export async function askDiaryChat(content: string, today: string): Promise<DiaryChatMessage[]> {
  const res = await req("/diary/ask", { method: "POST", body: JSON.stringify({ content, today }) });
  return res.json();
}
