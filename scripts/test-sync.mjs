import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { createRecordSession } from '../frontend/src/lib/record-session.ts';
import { loadRecords, saveRecord, clearRecords } from '../frontend/src/lib/storage.ts';
import { getToken, setSession, subscribeSession } from '../frontend/src/lib/auth.ts';
import { fetchMyRecords } from '../frontend/src/lib/api.ts';
import { createApp } from '../backend/src/app.ts';
import { prisma } from '../backend/src/lib/prisma.ts';
import { signToken } from '../backend/src/lib/auth.ts';

// No external services or real accounts. Test the production modules with
// controllable network responses and the localStorage fallback.
globalThis.window = new EventTarget();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
  key: index => [...values.keys()][index] ?? null,
  get length() { return values.size; },
};
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const record = (id, userId = 'a', extra = {}) => ({
  id, userId, role: 'student', module: 'Inertia', moduleId: 'inertia',
  mode: 'fallback', stage: 'Predict', text: id,
  createdAt: new Date().toISOString(), ...extra,
});

localStorage.setItem('tuklas-records', JSON.stringify([record('legacy')]));
await Promise.all([saveRecord(record('one')), saveRecord(record('two')), saveRecord(record('other', 'b'))]);
assert.deepEqual((await loadRecords('a')).map(r => r.id).sort(), ['legacy', 'one', 'two']);
await clearRecords('a');
assert.deepEqual((await loadRecords('b')).map(r => r.id), ['other']);
console.log('PASS concurrent fallback saves, legacy migration and account-scoped clear.');

let rendered = [];
let feedback = [];
let current = true;
const uploadStarted = deferred();
const uploadResponse = deferred();
const session = createRecordSession({
  userId: 'a', isCurrent: () => current,
  upload: async () => { uploadStarted.resolve(); return uploadResponse.promise; },
  fetch: async () => ({ records: [], feedback: [] }),
  onRecords: records => { rendered = records; }, onFeedback: items => { feedback = items; },
});
await session.save(record('predict'));
const uploading = session.sync();
await uploadStarted.promise;
await session.save(record('observe', 'a', { stage: 'Observe' }));
uploadResponse.resolve({ records: [record('predict')] });
await uploading;
assert.deepEqual(rendered.map(r => r.id).sort(), ['observe', 'predict']);
assert.ok(rendered.find(r => r.id === 'predict').syncedAt);
assert.equal(rendered.find(r => r.id === 'observe').syncedAt, undefined);
assert.equal((await loadRecords('a')).length, 2);
await session.reconcile();
assert.deepEqual(rendered.map(r => r.id), ['observe'], 'Reset removes synced work and retains queued local work');
console.log('PASS delayed acknowledgement preserves new submissions; reset retains unsynced work.');

const pullStarted = deferred();
const pullResponse = deferred();
const calls = [];
const ordered = createRecordSession({
  userId: 'a', isCurrent: () => true,
  fetch: async () => { calls.push('pull'); pullStarted.resolve(); return pullResponse.promise; },
  upload: async records => { calls.push('upload'); return { records }; },
  onRecords: records => { rendered = records; }, onFeedback: () => {},
});
const pulling = ordered.reconcile();
await pullStarted.promise;
const nextUpload = ordered.sync();
await ordered.save(record('explain', 'a', { stage: 'Explain' }));
assert.deepEqual(calls, ['pull']);
pullResponse.resolve({ records: [], feedback: [] });
await Promise.all([pulling, nextUpload]);
assert.deepEqual(calls, ['pull', 'upload']);
assert.ok(rendered.every(r => r.syncedAt));
assert.equal(rendered.length, 2);
console.log('PASS reconciliation and upload ordering with a simultaneous local save.');

const staleStarted = deferred();
const staleResponse = deferred();
const stale = createRecordSession({
  userId: 'a', isCurrent: () => current,
  fetch: async () => { staleStarted.resolve(); return staleResponse.promise; },
  upload: async records => ({ records }),
  onRecords: () => assert.fail('Old session published records'),
  onFeedback: () => assert.fail('Old session published feedback'),
});
const stalePull = stale.reconcile();
await staleStarted.promise;
current = false;
stale.stop();
staleResponse.resolve({ records: [], feedback: [{ comment: 'Private feedback' }] });
await stalePull;
assert.equal((await loadRecords('a')).length, 2, 'Old response must not persist a stale reset');
assert.deepEqual(feedback, []);
console.log('PASS account changes ignore pending record and feedback responses.');

// A failed write must reject; callers must not mistake it for saved work.
const originalSet = localStorage.setItem;
localStorage.setItem = () => { throw new Error('Quota exceeded'); };
await assert.rejects(saveRecord(record('unsaved')), /Quota/);
localStorage.setItem = originalSet;
assert.equal((await loadRecords('a')).some(r => r.id === 'unsaved'), false);

const realFetch = globalThis.fetch;
let notices = 0;
const unsubscribe = subscribeSession(() => { notices++; });
setSession('old-token', { id: 'a' });
const oldResponse = deferred();
globalThis.fetch = () => oldResponse.promise;
const oldRequest = fetchMyRecords();
setSession('new-token', { id: 'b' });
oldResponse.resolve(new Response('{}', { status: 401 }));
await assert.rejects(oldRequest, /Session changed/);
assert.equal(getToken(), 'new-token');
globalThis.fetch = async () => new Response('{}', { status: 401 });
await assert.rejects(fetchMyRecords());
assert.equal(getToken(), null);
assert.equal(notices, 3, 'Session expiry must notify the rendered app');
unsubscribe();
globalThis.fetch = realFetch;
console.log('PASS active 401 clears and announces session; stale 401 preserves new login.');

process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
process.env.JWT_SECRET = 'local-regression-secret';
const originalModule = prisma.module.upsert;
const originalUpsert = prisma.activityRecord.upsert;
const originalTransaction = prisma.$transaction;
let rows = new Map([['owned-by-b', record('owned-by-b', 'b')]]);
prisma.module.upsert = async () => ({});
// Lazy operations model Prisma's transaction semantics and unique constraint.
prisma.activityRecord.upsert = args => args;
prisma.$transaction = async operations => {
  const working = new Map(rows);
  const result = [];
  for (const args of operations) {
    const existing = working.get(args.where.id);
    if (existing && existing.userId !== args.where.userId) {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'test' });
    }
    const saved = existing ? { ...existing, ...args.update } : args.create;
    working.set(saved.id, saved);
    result.push(saved);
  }
  rows = working;
  return result;
};
const server = createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const post = records => fetch(`http://127.0.0.1:${server.address().port}/api/sync`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ sub: 'a', username: 'a', role: 'student' })}` },
  body: JSON.stringify({ records }),
});
try {
  assert.equal((await post([record('valid'), record('owned-by-b')])).status, 409);
  assert.equal(rows.has('valid'), false, 'Conflicting batch rolls back');
  assert.equal(rows.get('owned-by-b').userId, 'b');
  assert.equal((await post([record('valid')])).status, 200);
  assert.equal((await post([record('valid', 'a', { text: 'Retry' })])).status, 200);
  assert.equal(rows.get('valid').text, 'Retry');
  assert.equal(rows.size, 2);
  console.log('PASS API ownership collision, batch rollback and same-owner retry (mock database).');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  prisma.module.upsert = originalModule;
  prisma.activityRecord.upsert = originalUpsert;
  prisma.$transaction = originalTransaction;
  await prisma.$disconnect();
}
