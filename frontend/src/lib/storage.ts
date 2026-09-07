import type { ActivityRecord, ProgressState } from "../types/domain";

const DB_NAME = "tuklas-poe";
const DB_VERSION = 1;
const RECORD_STORE = "records";
const RECORDS_KEY = "tuklas-records";
const PROGRESS_KEY = "tuklas-progress";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECORD_STORE)) {
        database.createObjectStore(RECORD_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

  return dbPromise;
}

export function loadProgress(): ProgressState {
  return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") as ProgressState;
}

export function saveProgress(progress: ProgressState) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export async function loadRecords(): Promise<ActivityRecord[]> {
  const fallback = JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]") as ActivityRecord[];
  const db = await openDb();
  if (!db) return fallback;

  return new Promise((resolve) => {
    const request = db.transaction(RECORD_STORE, "readonly").objectStore(RECORD_STORE).getAll();
    request.onsuccess = () => resolve((request.result || fallback) as ActivityRecord[]);
    request.onerror = () => resolve(fallback);
  });
}

export async function saveRecord(record: ActivityRecord) {
  const current = await loadRecords();
  const next = [...current.filter((item) => item.id !== record.id), record];
  localStorage.setItem(RECORDS_KEY, JSON.stringify(next));

  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const request = db.transaction(RECORD_STORE, "readwrite").objectStore(RECORD_STORE).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

export async function replaceRecords(records: ActivityRecord[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(RECORD_STORE, "readwrite");
    const store = transaction.objectStore(RECORD_STORE);
    store.clear();
    records.forEach((record) => store.put(record));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

export async function clearRecords() {
  localStorage.setItem(RECORDS_KEY, "[]");
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const request = db.transaction(RECORD_STORE, "readwrite").objectStore(RECORD_STORE).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}
