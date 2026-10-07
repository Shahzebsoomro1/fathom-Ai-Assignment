import fs from 'node:fs/promises';
const debuggingOrigin = 'http://127.0.0.1:9337';
const origin = 'http://127.0.0.1:4173';
const response = await fetch(origin);
if (!response.ok) throw new Error(`Frontend returned ${response.status}`);
const tabs = await (await fetch(`${debuggingOrigin}/json/list`)).json();
let tab = tabs.find(t => t.type === 'page' && t.url.startsWith(origin));
if (!tab) tab = await (await fetch(`${debuggingOrigin}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let sequence = 0;
const pending = new Map();
const browserErrors = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text);
  if (pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
function assert(condition, label) { if (!condition) throw new Error(label); checks.push(label); }
async function screenshot(name) {
  const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(`recon/screenshots/${name}.png`, Buffer.from(result.data, 'base64'));
}
await call('Runtime.enable');
await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await call('Emulation.setDeviceMetricsOverride', { width: 1917, height: 920, deviceScaleFactor: 1, mobile: false });
await call('Page.navigate', { url: origin });
await sleep(1000);
await evaluate('document.fonts.ready');
await evaluate("Promise.all(Array.from(document.images).map(i=>{i.loading='eager';return i.decode().catch(()=>null)}))");
await evaluate('window.scrollTo(0, document.body.scrollHeight)');
await sleep(800);
await evaluate('window.scrollTo(0,0)');
await sleep(100);
assert(await evaluate("document.querySelector('h1').innerText.includes('out of this world')"), 'Landing hero rendered');
const missing = await evaluate("Array.from(document.images).filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)");
assert(missing.length === 0, `All images load (${missing.length} missing: ${missing.join(', ')})`);
assert(await evaluate("document.fonts.check('300 24px Sora') && document.fonts.check('500 24px Rounds')"), 'Local brand fonts load');
await screenshot('landing-desktop');
await evaluate("document.querySelector('[data-tab=individuals]').click()");
assert(await evaluate("document.querySelector('#individuals-panel').hidden===false && document.querySelector('#teams-panel').hidden===true"), 'Individuals tab changes content');
await evaluate("document.querySelector('[data-tab=teams]').click()");
await evaluate("document.querySelector('[data-carousel=next]').click()");
assert(await evaluate("document.querySelector('[data-slide=\"2\"]').getAttribute('aria-current')==='true'"), 'Carousel next changes the selected feature');
await evaluate("document.querySelector('[data-slide=\"1\"]').click()");
await evaluate("document.querySelector('[data-workflow=\"1\"]').click()");
assert(await evaluate("document.querySelector('#workflow-preview img').getAttribute('src').endsWith('momentum.avif')"), 'Workflow tab changes the illustration');
await evaluate("document.querySelector('[data-workflow=\"0\"]').click()");
await evaluate("document.querySelector('.nav-dropdown summary').click()");
assert(await evaluate("document.querySelector('.nav-dropdown').open"), 'Navigation dropdown opens');
await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
assert(await evaluate("!document.querySelector('.nav-dropdown').open"), 'Escape closes the navigation dropdown');
await evaluate('document.activeElement.blur()');
await evaluate("window.scrollTo(0,document.querySelector('.product-carousel').getBoundingClientRect().top+scrollY-150)");
await sleep(150);
await screenshot('landing-carousel');
await evaluate("window.scrollTo(0,document.querySelector('.audience-panel').getBoundingClientRect().top+scrollY-150)");
await sleep(150);
await screenshot('landing-teams');
await evaluate("window.scrollTo(0,document.querySelector('.final-cta').getBoundingClientRect().top+scrollY-120)");
await sleep(150);
await screenshot('landing-cta');
await evaluate('window.scrollTo(0,document.body.scrollHeight)');
await sleep(150);
await screenshot('landing-footer');
const widths = [1917, 1440, 1024, 768, 390, 320];
for (const width of widths) {
  await call('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 920, deviceScaleFactor: 1, mobile: width < 600 });
  await sleep(100);
  const overflow = await evaluate('document.documentElement.scrollWidth > window.innerWidth');
  assert(!overflow, `No horizontal overflow at ${width}px`);
  if (width === 390) {
    await evaluate('window.scrollTo(0,0)');
    await screenshot('landing-mobile');
    await evaluate("document.querySelector('.menu-toggle').click()");
    assert(await evaluate("!document.querySelector('#mobile-nav').hidden"), 'Mobile navigation opens');
    await evaluate("document.querySelector('#mobile-nav a').click()");
    assert(await evaluate("document.querySelector('#mobile-nav').hidden"), 'Mobile navigation closes after selection');
  }
}
assert(browserErrors.length === 0, `No browser runtime errors (${browserErrors.length})`);
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await evaluate('window.scrollTo(0,0)');
await fs.writeFile('recon/LANDING-QA.json', JSON.stringify({ checked_at: new Date().toISOString(), browser: 'Microsoft Edge via DevTools Protocol', url: origin, checks, browserErrors }, null, 2));
console.log(JSON.stringify({ status: 'PASS', checks: checks.length, widths, screenshots: ['landing-desktop', 'landing-mobile', 'landing-carousel', 'landing-teams', 'landing-cta', 'landing-footer'] }));
ws.close();
