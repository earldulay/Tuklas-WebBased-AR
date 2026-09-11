import { clearRecords, loadRecords, saveRecord, updateRecords } from "./storage";
import type { ActivityRecord, Feedback } from "../types/domain";

interface Options {
  userId: string;
  isCurrent: () => boolean;
  upload: (records: ActivityRecord[]) => Promise<{ records: ActivityRecord[] }>;
  fetch: () => Promise<{ records: ActivityRecord[]; feedback: Feedback[] }>;
  onRecords: (records: ActivityRecord[]) => void;
  onFeedback: (feedback: Feedback[]) => void;
}

export function createRecordSession(options: Options) {
  let stopped = false;
  let networkQueue = Promise.resolve();
  const active = () => !stopped && options.isCurrent();
  const publish = (records: ActivityRecord[]) => {
    if (active()) options.onRecords(records);
    return records;
  };
  // Order pulls and uploads so an earlier server snapshot cannot erase an
  // acknowledged upload. Local saves remain independent of slow requests.
  function enqueue<T>(task: () => Promise<T>): Promise<T | undefined> {
    const result = networkQueue.then(() => active() ? task() : undefined);
    networkQueue = result.then(() => undefined, () => undefined);
    return result;
  }
  return {
    stop() { stopped = true; },
    async load() { return publish(await loadRecords(options.userId)); },
    async save(record: ActivityRecord) {
      if (!active() || record.userId !== options.userId) return [];
      return publish(await saveRecord(record));
    },
    async clear() { return publish(await clearRecords(options.userId)); },
    sync() {
      return enqueue(async () => {
        const current = await loadRecords(options.userId);
        const pending = current.filter(record => !record.syncedAt);
        if (!active() || !pending.length) return current;
        const result = await options.upload(pending);
        if (!active()) return current;
        const ids = new Set(result.records.map(record => record.id));
        // Apply acknowledgements to the latest persisted collection, never
        // to the snapshot sent over the network. Do not resurrect deletions.
        return publish(await updateRecords(options.userId, latest => active() ? latest.map(record =>
          ids.has(record.id) ? { ...record, syncedAt: record.syncedAt || new Date().toISOString() } : record,
        ) : latest));
      });
    },
    reconcile() {
      return enqueue(async () => {
        const before = await loadRecords(options.userId);
        if (!active()) return;
        const result = await options.fetch();
        if (!active()) return;
        const records = await updateRecords(options.userId, latest => {
          if (!active()) return latest;
          const server = result.records.filter(record => record.userId === options.userId);
          const retained = latest.filter(record => !server.some(item => item.id === record.id) &&
            (!record.syncedAt || !before.some(item => item.id === record.id && item.syncedAt === record.syncedAt)));
          return [...server, ...retained];
        });
        publish(records);
        if (active()) options.onFeedback(result.feedback || []);
      });
    },
  };
}
