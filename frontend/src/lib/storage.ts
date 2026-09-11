import type { ActivityRecord } from "../types/domain";

const DB_NAME = "tuklas-poe";
const RECORD_STORE = "records";
const LEGACY_KEY = "tuklas-records";
const RECORD_PREFIX = "tuklas-record:";
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  if (!dbPromise) dbPromise = new Promise(resolve => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(RECORD_STORE)) {
        request.result.createObjectStore(RECORD_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

function fallbackRecords(): ActivityRecord[] {
  // Migrate the old array once. Separate keys preserve concurrent additions.
  const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") as ActivityRecord[];
  for (const record of legacy) {
    const key = RECORD_PREFIX + record.id;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(record));
  }
  localStorage.removeItem(LEGACY_KEY);
  const records: ActivityRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(RECORD_PREFIX)) {
      const raw = localStorage.getItem(key);
      if (raw) records.push(JSON.parse(raw) as ActivityRecord);
    }
  }
  return records;
}

type Change = (current: ActivityRecord[]) => ActivityRecord[];

// Read and mutate in ONE IndexedDB transaction, including across tabs.
// Never clear the object store or persist a stale global snapshot.
export async function updateRecords(userId: string, change?: Change): Promise<ActivityRecord[]> {
  const db = await openDb();
  if (!db) {
    const apply = () => {
      const current = fallbackRecords().filter(record => record.userId === userId);
      if (!change) return current;
      const next = change(current).filter(record => record.userId === userId);
      for (const record of next) localStorage.setItem(RECORD_PREFIX + record.id, JSON.stringify(record));
      for (const record of current) {
        if (!next.some(item => item.id === record.id)) localStorage.removeItem(RECORD_PREFIX + record.id);
      }
      return next;
    };
    return navigator.locks ? navigator.locks.request(DB_NAME, apply) : apply();
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORD_STORE, change ? "readwrite" : "readonly");
    const store = transaction.objectStore(RECORD_STORE);
    const request = store.getAll();
    let next: ActivityRecord[] = [];
    request.onsuccess = () => {
      try {
        const current = (request.result as ActivityRecord[]).filter(record => record.userId === userId);
        next = change ? change(current).filter(record => record.userId === userId) : current;
        if (change) {
          for (const record of current) {
            if (!next.some(item => item.id === record.id)) store.delete(record.id);
          }
          for (const record of next) store.put(record);
        }
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    };
    transaction.oncomplete = () => resolve(next);
    transaction.onabort = () => reject(transaction.error || new Error("Saving records failed."));
    transaction.onerror = () => reject(transaction.error || new Error("Reading records failed."));
  });
}

export function loadRecords(userId: string) {
  return updateRecords(userId);
}

export function saveRecord(record: ActivityRecord) {
  return updateRecords(record.userId, current => [...current.filter(item => item.id !== record.id), record]);
}

export function clearRecords(userId: string) {
  return updateRecords(userId, () => []);
}
