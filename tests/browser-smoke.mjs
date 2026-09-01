import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const remote = process.env.CHROME_REMOTE || "http://127.0.0.1:9222";
const baseUrl = process.env.APP_URL || "http://127.0.0.1:8765/";
const screenshotDir = process.env.SCREENSHOT_DIR;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await (await fetch(`${remote}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url.startsWith("http")) || targets.find((item) => item.type === "page");
if (!target) throw new Error("Aucun onglet Chrome disponible.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map();
const browserErrors = [];
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserErrors.push(`${message.params.entry.url || "resource"}: ${message.params.entry.text}`);
};

function call(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const response = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}

async function waitFor(expression, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(50);
  }
  throw new Error(`Délai dépassé : ${expression}\n${await evaluate(`document.body.innerText.slice(0, 1200)`)}`);
}

const click = async (action) => {
  const found = await evaluate(`(() => { const item = document.querySelector('[data-action="${action}"]'); if (!item) return false; item.click(); return true; })()`);
  if (!found) throw new Error(`Action absente : ${action}\n${await evaluate(`document.body.innerText.slice(0, 1200)`)}`);
  await delay(100);
};

async function finishNight() {
  for (let guard = 0; guard < 8; guard += 1) {
    if (await evaluate(`Boolean(document.querySelector('[data-action="resolve-night"]'))`)) break;
    const type = await evaluate(`document.querySelector('#cupid-first') ? 'cupid' : document.querySelector('#witch-kill') ? 'witch' : document.querySelector('#seer-result') ? 'seer' : 'wolves'`);
    if (type === "cupid") {
      await evaluate(`(() => { const a = document.querySelector('#cupid-first'), b = document.querySelector('#cupid-second'); a.value = a.options[1].value; b.value = b.options[2].value; })()`);
    } else if (type === "witch") {
      await evaluate(`document.querySelector('#witch-kill').value = ''`);
    } else {
      await evaluate(`(() => { const game = JSON.parse(localStorage.getItem('werewolf-manager.game.v1')).game; const select = document.querySelector('#night-target'); const safe = [...select.options].map(o => o.value).find(id => { const p = game.players.find(item => item.id === id); return p && ['villager', 'seer', 'witch'].includes(p.roleId); }); select.value = safe || select.options[1].value; })()`);
    }
    await click("validate-night");
    if (type === "seer") {
      await waitFor(`document.querySelector('[data-action="confirm-modal"]')`);
      await click("confirm-modal");
    }
  }
  await waitFor(`document.querySelector('[data-action="resolve-night"]')`);
  await click("resolve-night");
  await waitFor(`document.body.innerText.includes('Résolution de la nuit')`);
  await click("apply-night");
  await waitFor(`document.querySelector('[data-action="next-phase"]')`);
}

await call("Runtime.enable");
await call("Log.enable");
await call("Page.enable");
await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 850, deviceScaleFactor: 1, mobile: false });
await call("Page.navigate", { url: baseUrl });
await waitFor(`document.querySelector('[data-action="new-game"]')`);
await evaluate(`localStorage.clear()`);
await call("Page.reload", { ignoreCache: true });
await waitFor(`document.querySelector('[data-action="new-game"]')`);
await click("new-game");
await waitFor(`document.querySelector('[data-action="fill-players"]')`);
await click("fill-players");
assert.equal(await evaluate(`document.querySelectorAll('[data-player-name]').length`), 8);
await click("go-distribution");
await waitFor(`document.querySelector('[data-action="assign-roles"]')`);
await click("assign-roles");
await waitFor(`document.querySelector('[data-action="reveal-role"]')`);
await click("reveal-role");
assert.equal(await evaluate(`document.body.innerText.toLocaleLowerCase('fr').includes('votre rôle')`), true);
await click("hide-next-role");
await waitFor(`document.querySelector('[data-action="skip-distribution"]')`);
await click("skip-distribution");
await click("launch-game");
await waitFor(`document.querySelector('[data-action="start-night"]')`);
await click("start-night");
await finishNight();
await click("next-phase");
await waitFor(`document.body.innerText.includes('Le village débat')`);
await click("set-timer");
await click("start-timer");
await delay(1100);
await click("pause-timer");
assert.ok(await evaluate(`JSON.parse(localStorage.getItem('werewolf-manager.game.v1')).game.timer.remaining`) < 60);
await click("next-phase");
await waitFor(`document.querySelector('#simple-vote-target')`);
await evaluate(`(() => { const game = JSON.parse(localStorage.getItem('werewolf-manager.game.v1')).game; const select = document.querySelector('#simple-vote-target'); const safe = game.players.find(p => p.alive && p.roleId !== 'hunter'); select.value = safe.id; })()`);
await click("resolve-vote");
await waitFor(`document.body.innerText.includes('Le vote est appliqué')`);
await click("next-phase");
assert.equal(await evaluate(`JSON.parse(localStorage.getItem('werewolf-manager.game.v1')).game.night`), 2);

if (screenshotDir) {
  await mkdir(screenshotDir, { recursive: true });
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`${screenshotDir}/werewolf-desktop.png`, Buffer.from(shot.data, "base64"));
}

await click("public-view");
await waitFor(`document.body.innerText.toLocaleLowerCase('fr').includes('vue publique')`);
const publicText = await evaluate(`document.querySelector('main').innerText`);
assert.doesNotMatch(publicText, /Voyante|Sorcière|Chasseur|Villageois|Camp des|notes/i);

await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await delay(150);
assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, "Débordement horizontal mobile");
if (screenshotDir) {
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`${screenshotDir}/werewolf-mobile.png`, Buffer.from(shot.data, "base64"));
}

await call("Page.reload", { ignoreCache: true });
await waitFor(`document.querySelector('[data-action="resume-game"]')`);
await click("resume-game");
await waitFor(`document.querySelector('[data-action="start-night"]')`);
assert.equal(await evaluate(`JSON.parse(localStorage.getItem('werewolf-manager.game.v1')).game.night`), 2);
await click("start-night");
await finishNight();
assert.equal(await evaluate(`JSON.parse(localStorage.getItem('werewolf-manager.game.v1')).game.day`), 2);
assert.deepEqual(browserErrors, [], `Erreurs navigateur : ${browserErrors.join(" | ")}`);

socket.close();
console.log("Browser smoke test: parcours complet, reload, vue publique et mobile validés.");
