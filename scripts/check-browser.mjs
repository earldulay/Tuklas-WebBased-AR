// Run against a local Vite server and a dedicated Chrome --remote-debugging-port=9222 profile.
// Uses a real AR.js detector with a canvas camera stream; never accesses a physical camera.
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { modules } from '../backend/src/data/modules.ts';
const origin = process.env.TEST_ORIGIN || 'http://localhost:5174';
const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = pages.find(p => p.type === 'page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id) { const task = pending.get(data.id); pending.delete(data.id); data.error ? task.reject(data.error) : task.resolve(data.result); }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression, timeout = 20000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await evaluate(expression)) return; await sleep(150); } throw Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`); }
const click = async text => { await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw Error('Missing button: ' + ${JSON.stringify(text)}); button.click(); })()`); await sleep(130); };
const card = async text => { await evaluate(`(() => { const button = [...document.querySelectorAll('.module-card')].find(b => b.textContent.includes(${JSON.stringify(text)})); if (!button) throw Error('Missing card'); button.click(); })()`); await sleep(130); };
await send('Page.enable'); await send('Runtime.enable');
await evaluate(`try { sessionStorage.removeItem('testRole'); } catch { /* New about:blank profile. */ }`);
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
localStorage.setItem('tuklas-user', JSON.stringify({ id: 'browser-test-${Date.now()}-' + (sessionStorage.testRole || 'teacher'), username: 'test', name: 'Browser Test', role: sessionStorage.testRole || 'teacher', sectionId: null }));
localStorage.setItem('tuklas-token', 'test-only'); localStorage.setItem('tuklas-view-mode', 'fallback');
const realFetch = window.fetch.bind(window);
window.__records = [];
window.fetch = (input, init) => { const url = typeof input === 'string' ? input : input.url; if (url.includes('/api/')) { if (url.endsWith('/sync') && init?.body) { const incoming = JSON.parse(init.body).records; for (const record of incoming) if (!window.__records.some(r => r.id === record.id)) window.__records.push({...record, syncedAt: new Date().toISOString()}); } return Promise.resolve(new Response(JSON.stringify(url.endsWith('/modules') ? ${JSON.stringify(modules)} : { records: window.__records, feedback: [], sections: [], students: [] }), { status: 200 })); } return realFetch(input, init); };
window.__markerVisible = true;
navigator.mediaDevices.getUserMedia = async () => {
 const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
 const ctx = canvas.getContext('2d'); const marker = new Image(); marker.src = '/assets/tuklas-marker.png'; await marker.decode();
 const draw = () => { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 640, 480); if (window.__markerVisible) ctx.drawImage(marker, 170, 90, 300, 300); }; draw();
 const timer = setInterval(draw, 50); const stream = canvas.captureStream(20);
 for (const track of stream.getTracks()) { const stop = track.stop.bind(track); track.stop = () => { clearInterval(timer); stop(); }; }
 return stream;
};` });
await send('Page.navigate', { url: origin });
await waitFor(`document.body.innerText.includes('Preview Lessons')`);
await mkdir('.browser-check/screens', { recursive: true });
const range = async (index, value) => { await evaluate(`(() => { const input = document.querySelectorAll('input[type=range]')[${index}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(value))}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(150); };
for (const experiment of modules) {
  await click('Preview Lessons');
  assert.equal(await evaluate(`document.querySelectorAll('.module-card').length`), 4);
  await card(experiment.quarter);
  await card(experiment.moduleTitle);
  await card(experiment.title);
  await click('Next');
  await waitFor(`document.querySelector('.three-scene canvas') !== null`);
  if (await evaluate(`document.body.innerText.includes('Use 3D Model')`)) await click('Use 3D Model');
  await sleep(500);
  // Sweep both inputs to their maxima and back to exercise state/scene transitions.
  await evaluate(`(() => { for (const input of document.querySelectorAll('input[type=range]')) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, input.max); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
  await sleep(200); await click('Reset model');
  if (['series', 'parallel', 'home-circuit'].includes(experiment.id)) await click('Close switch');
  if (experiment.id === 'earth-scale') for (const layer of ['Inner core', 'Outer core', 'Mantle', 'Crust']) await click(`Add ${layer}`);
  if (experiment.id === 'bonding') {
    await click('Transfer to Cl');
    await waitFor(`document.querySelector('.data-readout').textContent.includes('1 electron transferred')`);
    await range(0, 1);
    await click('Place shared pair 1 in O–H'); await click('Place shared pair 2 in O–H');
    await waitFor(`document.querySelector('.data-readout').textContent.includes('2/2 shared pairs')`);
  }
  if (experiment.id === 'chemical-change') { await range(0, 2); await range(1, 2); await waitFor(`document.querySelector('.data-readout').textContent.includes('new substance')`); }
  if (experiment.id === 'replication') await evaluate(`(() => { for (const select of document.querySelectorAll('.base-choice select')) { const old = select.parentElement.querySelector('strong').textContent; select.value = {A:'T',T:'A',C:'G',G:'C'}[old]; select.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
  await click('Run Trial');
  await evaluate(`document.querySelector('.ar-frame').scrollIntoView({ block: 'center' })`);
  await sleep(250);
  await writeFile(`.browser-check/screens/${experiment.id}-3d.png`, Buffer.from((await send('Page.captureScreenshot')).data, 'base64'));
  await click('Use Camera');
  await waitFor(`document.querySelector('.camera-status')?.textContent === 'Tuklas marker detected.'`, 30000);
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Run Trial' && !b.disabled)`);
  await evaluate(`document.querySelector('.ar-frame').scrollIntoView({ block: 'center' })`);
  await sleep(350);
  await writeFile(`.browser-check/screens/${experiment.id}-ar.png`, Buffer.from((await send('Page.captureScreenshot')).data, 'base64'));
  await evaluate('window.__markerVisible = false');
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Run Trial' && b.disabled)`);
  await evaluate('window.__markerVisible = true');
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Run Trial' && !b.disabled)`);
  assert.equal(await evaluate('document.documentElement.scrollWidth > window.innerWidth'), false, `${experiment.id}: horizontal overflow`);
  console.log(`PASS ${experiment.id}: mobile 3D, real marker detection, loss/reacquisition, trial gate`);
  await click('Home');
}
assert.deepEqual(errors, []);
console.log('PASS all twelve experiments without browser exceptions.');
// Verify saved stages belong to the selected experiment, including repeat observations.
await evaluate(`sessionStorage.testRole = 'student';`);
await send('Page.reload');
await waitFor(`document.body.innerText.includes('Progress Summary')`);
await click('Modules'); await card(modules[0].quarter); await card(modules[0].moduleTitle); await card(modules[0].title);
await evaluate(`document.querySelectorAll('fieldset input[type=radio]:first-of-type').forEach(input => { if (!document.querySelector('input[name="'+input.name+'"]:checked')) input.click(); })`);
await click('Next');
await waitFor(`document.querySelector('.three-scene canvas') !== null`);
await click('Run Trial'); await click('Run Trial');
assert.equal(await evaluate(`window.__records.filter(r => r.moduleId === 'inertia' && r.stage === 'Observe').length`), 1);
await click('Continue');
await evaluate(`document.querySelectorAll('textarea:not([readonly])').forEach(input => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'At zero net force, the stationary cart remained at rest.'); input.dispatchEvent(new Event('input', { bubbles: true })); })`);
await click('Submit');
await waitFor(`document.body.innerText.includes('Great work!')`);
assert.deepEqual(await evaluate(`window.__records.map(r => r.stage)`), ['Predict', 'Observe', 'Explain']);
await click('Modules'); await card(modules[1].quarter); await card(modules[1].moduleTitle); await card(modules[1].title);
assert.equal(await evaluate(`document.querySelectorAll('.prediction-question').length`), 3);
assert.equal(await evaluate(`document.querySelectorAll('input[type=radio]:checked').length`), 0);
assert.equal(await evaluate(`window.__records.filter(r => r.moduleId === 'force-mass').length`), 0);
await click('Modules');
assert.equal(await evaluate(`document.querySelectorAll('.module-card').length`), 4, 'Modules navigation always opens Quarters');
assert.deepEqual(errors, []);
console.log('PASS student POE submission, repeat-trial deduplication and experiment isolation. Screenshots in .browser-check/screens.');
await evaluate(`sessionStorage.removeItem('testRole')`);
socket.close();
