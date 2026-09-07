import type { ActivityRecord } from "../types/domain";

const DB_NAME = "tuklas-poe";
const DB_VERSION = 1;
const RECORD_STORE = "records";
const RECORDS_KEY = "tuklas-records";

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

// The device-local store holds records for every account that has ever
// logged in on this device (useful on a shared classroom tablet, where the
// same browser sees several students). Every read/write below is scoped to
// a single userId so one account's progress can never leak into another's.

async function loadAllRecords(): Promise<ActivityRecord[]> {
  const fallback = JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]") as ActivityRecord[];
  const db = await openDb();
  if (!db) return fallback;

  return new Promise((resolve) => {
    const request = db.transaction(RECORD_STORE, "readonly").objectStore(RECORD_STORE).getAll();
    request.onsuccess = () => resolve((request.result || fallback) as ActivityRecord[]);
    request.onerror = () => resolve(fallback);
  });
}

async function writeAllRecords(records: ActivityRecord[]) {
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

export async function loadRecords(userId: string): Promise<ActivityRecord[]> {
  const all = await loadAllRecords();
  return all.filter((record) => record.userId === userId);
}

export async function saveRecord(record: ActivityRecord) {
  const all = await loadAllRecords();
  const next = [...all.filter((item) => item.id !== record.id), record];
  await writeAllRecords(next);
}

export async function replaceRecords(userId: string, records: ActivityRecord[]) {
  const all = await loadAllRecords();
  const others = all.filter((item) => item.userId !== userId);
  await writeAllRecords([...others, ...records]);
}

export async function clearRecords(userId: string) {
  const all = await loadAllRecords();
  await writeAllRecords(all.filter((item) => item.userId !== userId));
}
