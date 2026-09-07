import type { ActivityRecord, LearningModule } from "../types/domain";

const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchModules() {
  return request<LearningModule[]>("/modules");
}

export function syncRecords(records: ActivityRecord[]) {
  return request<{ records: ActivityRecord[] }>("/sync", {
    method: "POST",
    body: JSON.stringify({ records }),
  });
}
