import fs from 'node:fs/promises';
const origin = 'http://127.0.0.1:4173';
const debug = 'http://127.0.0.1:9337';
const checks = [];
function assert(condition, label) { if (!condition) throw new Error(label); checks.push(label); }
for (const route of ['/signup', '/login', '/dashboard']) assert((await fetch(origin + route)).ok, `${route} serves successfully`);
const tabs = await (await fetch(debug + '/json/list')).json();
let tab = tabs.find(t => t.type === 'page' && t.url.startsWith(origin) && /signup|login|dashboard/.test(t.url));
if (!tab) tab = await (await fetch(`${debug}/json/new?${encodeURIComponent(origin + '/signup')}`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let sequence = 0;
const pending = new Map();
const errors = [];
const externalRequests = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Network.requestWillBeSent' && !message.params.request.url.startsWith(origin) && !message.params.request.url.startsWith('data:')) externalRequests.push(message.params.request.url);
  if (pending.has(message.id)) {
    const p = pending.get(message.id); pending.delete(message.id);
    message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result);
  }
};
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function open(route) { await call('Page.navigate', { url: origin + route }); await sleep(250); await evaluate('document.fonts.ready'); }
async function screenshot(name) { const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(`recon/screenshots/${name}.png`, Buffer.from(shot.data, 'base64')); }
await call('Runtime.enable');
await call('Network.enable');
await call('Emulation.setDeviceMetricsOverride', { width: 1917, height: 903, deviceScaleFactor: 1, mobile: false });
await open('/signup');
await screenshot('auth-signup-desktop');
await evaluate('window.__authTestDocument = true');
await evaluate("document.querySelector('#auth-toggle-link').click()");
assert(await evaluate("location.pathname === '/login' && document.querySelector('#auth-title').textContent === 'Log in to Fathom' && window.__authTestDocument"), 'Sign in toggle changes route and form without reloading');
await screenshot('auth-login-desktop');
await evaluate("document.querySelector('#auth-toggle-link').click()");
assert(await evaluate("location.pathname === '/signup' && document.querySelector('#auth-title').textContent === 'Sign up for Fathom'"), 'Sign up toggle returns to signup');
await evaluate('history.back()');
await sleep(75);
assert(await evaluate("location.pathname === '/login' && document.querySelector('#auth-title').textContent === 'Log in to Fathom'"), 'Browser Back restores login form state');
for (const route of ['/signup', '/login']) {
  for (const provider of ['google', 'microsoft']) {
    await open(route);
    await evaluate('window.__authTestDocument = true');
    const start = Date.now();
    await evaluate(`document.querySelector('[data-provider=${provider}]').click()`);
    assert(await evaluate(`location.pathname === '${route}' && [...document.querySelectorAll('[data-provider]')].every(b => b.disabled) && !document.querySelector('[data-provider=${provider}] .loading-spinner').hidden`), `${route}: ${provider} shows loading and disables duplicate clicks`);
    await sleep(200);
    assert(await evaluate(`location.pathname === '${route}'`), `${route}: ${provider} remains in loading before 500ms`);
    await sleep(360);
    assert(await evaluate("location.pathname === '/dashboard' && !document.querySelector('#dashboard-screen').hidden && document.querySelector('#auth-screen').hidden && window.__authTestDocument"), `${route}: ${provider} navigates seamlessly to dashboard`);
    assert(Date.now() - start >= 500, `${route}: ${provider} completes the simulated delay`);
  }
}
await evaluate('document.activeElement.blur()');
await screenshot('auth-dashboard-desktop');
await open('/signup');
await evaluate("document.querySelector('[data-provider=google]').click(); document.querySelector('#auth-toggle-link').click()");
await sleep(600);
assert(await evaluate("location.pathname === '/login' && [...document.querySelectorAll('[data-provider]')].every(b=>!b.disabled)"), 'Changing forms cancels an in-flight auth transition');
for (const width of [1440, 768, 390, 320]) {
  await call('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
  for (const route of ['/signup', '/login', '/dashboard']) {
    await open(route);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `${route}: no horizontal overflow at ${width}px`);
    if (width === 390 && route === '/signup') await screenshot('auth-signup-mobile');
  }
}
assert(errors.length === 0, 'No browser JavaScript exceptions');
assert(externalRequests.length === 0, 'Simulated auth makes no external OAuth or network requests');
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await open('/signup');
await fs.writeFile('recon/AUTH-QA.json', JSON.stringify({ checked_at: new Date().toISOString(), status: 'PASS', checks, errors, externalRequests }, null, 2));
console.log(JSON.stringify({ status: 'PASS', checks: checks.length, providers: ['google', 'microsoft'], routes: ['/signup', '/login', '/dashboard'], simulated_auth: true, external_requests: externalRequests.length }));
ws.close();
