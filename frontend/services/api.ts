// All calls go through the Next.js rewrite (/api → FastAPI), so audio URLs work as-is.

async function request<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.detail || body?.error || `Request failed (${res.status})`);
  return body as T;
}

const post = <T = any>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined });

export type Persona = "auto" | "consumer" | "merchant";

export const api = {
  dashboard: () => request("/api/dashboard"),
  userApp: (userId: string) => request(`/api/app/${userId}`),
  chat: (text: string, persona: Persona, speak = false, language = "auto") => post("/api/chat", { text, persona, speak, language }),
  voice: (blob: Blob, persona: Persona) => {
    const form = new FormData();
    form.append("audio", blob, "speech.webm");
    form.append("persona", persona);
    return request("/api/voice/webhook", { method: "POST", body: form });
  },
  callVoice: (blob: Blob, callId: string) => {
    const form = new FormData();
    form.append("audio", blob, "speech.webm");
    form.append("call_id", callId);
    return request("/api/voice/webhook", { method: "POST", body: form });
  },
  approve: (id: string) => post(`/api/approvals/${id}/approve`, { by: "You (dashboard)", channel: "dashboard" }),
  reject: (id: string) => post(`/api/approvals/${id}/reject`, { by: "You (dashboard)", channel: "dashboard" }),
  respondCall: (id: string, text: string) => post(`/api/calls/${id}/respond`, { text }),
  injectFraud: () => post("/api/risk/analyze", {}),
  telegramPress: (data: string) => post("/api/telegram/simulate", { data, who: "Dashboard (simulated tap)" }),
  measureCampaign: (id: string) => post(`/api/campaign/${id}/measure`),
  shieldStart: (source: "simulation" | "mic" | "phone", scenario = "digital_arrest", userId = "U001") =>
    post("/api/shield/start", { source, scenario, user_id: userId }),
  shieldEnd: (id: string) => post(`/api/shield/${id}/end`),
  shieldAudio: (id: string, blob: Blob) => {
    const form = new FormData();
    form.append("audio", blob, "chunk.webm");
    return request(`/api/shield/${id}/audio`, { method: "POST", body: form });
  },
  snapUpload: (blob: Blob, userId = "M001", source = "app") => {
    const form = new FormData();
    form.append("image", blob, "photo.jpg");
    form.append("user_id", userId);
    form.append("source", source);
    return request("/api/snap", { method: "POST", body: form });
  },
  snapSample: (name: string, source = "app") => post(`/api/snap/sample/${name}?source=${source}`),
  demoStart: (mode: "autoplay" | "presenter", scenario?: number) => post("/api/demo/start", { mode, scenario: scenario ?? null }),
  demoStop: () => post("/api/demo/stop"),
  demoReset: () => post("/api/demo/reset"),
};
