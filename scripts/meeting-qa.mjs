import fs from "node:fs/promises";
import { answerQuestion } from "../frontend/meeting/lib/answers.js";
const fixtures = JSON.parse(
  await fs.readFile("frontend/meeting/data/meetings.json", "utf8"),
);
const checks = [];
function assert(condition, label) {
  if (!condition) throw new Error(label);
  checks.push(label);
}
for (const meeting of fixtures) {
  assert(
    meeting.transcript.every(
      (row, i, rows) =>
        row.start >= 0 &&
        row.end > row.start &&
        row.end <= meeting.duration &&
        (i === 0 || rows[i - 1].end <= row.start) &&
        meeting.speakers.some((speaker) => speaker.id === row.speakerId),
    ),
    `${meeting.id}: valid ordered transcript and speakers`,
  );
  assert(
    meeting.transcript.at(-1).end === meeting.duration,
    `${meeting.id}: transcript reaches recording end`,
  );
  const answer = answerQuestion("Who owns the next steps?", meeting);
  assert(
    answer.sources.length === meeting.actionItems.length &&
      answer.sources.every(
        (source) => source.time >= 0 && source.time <= meeting.duration,
      ),
    `${meeting.id}: action answer has valid evidence`,
  );
  assert(
    answerQuestion("Explain interplanetary teleportation", meeting).sources
      .length === 0,
    `${meeting.id}: unsupported question does not invent evidence`,
  );
}
assert(
  fixtures[1].duration === 3600 &&
    fixtures[1].speakers.length === 8 &&
    fixtures[1].transcript.length === 96,
  "Rich full-hour fixture includes eight speakers and 96 segments",
);

const origin = "http://127.0.0.1:4173";
const debug = "http://127.0.0.1:9337";
for (const route of [
  "/meetings/discovery",
  "/meetings/launch-review",
  "/meeting.js",
  "/meeting.css",
])
  assert((await fetch(origin + route)).ok, `${route} serves locally`);
const tabs = await (await fetch(debug + "/json/list")).json();
let tab = tabs.find(
  (t) => t.type === "page" && t.url.startsWith(origin + "/meetings"),
);
if (!tab)
  tab = await (
    await fetch(
      `${debug}/json/new?${encodeURIComponent(origin + "/meetings/discovery")}`,
      { method: "PUT" },
    )
  ).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let sequence = 0;
const pending = new Map();
const errors = [];
const externalRequests = [];
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown")
    errors.push(message.params.exceptionDetails.text);
  if (
    message.method === "Network.requestWillBeSent" &&
    !message.params.request.url.startsWith(origin) &&
    !message.params.request.url.startsWith("data:")
  )
    externalRequests.push(message.params.request.url);
  if (pending.has(message.id)) {
    const p = pending.get(message.id);
    pending.delete(message.id);
    message.error
      ? p.reject(new Error(message.error.message))
      : p.resolve(message.result);
  }
};
const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function open(route) {
  await call("Page.navigate", { url: origin + route });
  await sleep(350);
  await evaluate(
    "new Promise(resolve=>{const image=new Image();image.onload=()=>image.decode().then(resolve,resolve);image.onerror=resolve;image.src='/assets/tutorial-reference.png';})",
  );
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await sleep(60);
}
async function input(selector, value) {
  await evaluate(
    `(()=>{const input=document.querySelector(${JSON.stringify(selector)});const prototype=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await sleep(60);
}
async function screenshot(name) {
  const result = await call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await fs.writeFile(
    `recon/screenshots/${name}.png`,
    Buffer.from(result.data, "base64"),
  );
}
await call("Runtime.enable");
await call("Network.enable");
await call("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
await call("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await open("/meetings/discovery");
await evaluate(
  "localStorage.removeItem('fathom.meeting.discovery'); localStorage.removeItem('fathom.meeting.launch-review')",
);
await open("/meetings/discovery");
assert(
  await evaluate(
    "document.querySelector('h1').textContent.includes('ThinkBionics') && document.querySelectorAll('[role=tab]').length===3",
  ),
  "React meeting workspace renders with three tabs",
);
assert(
  await evaluate(
    "Math.abs(document.querySelector('.player-screen').getBoundingClientRect().width-document.querySelector('.meeting-left').getBoundingClientRect().width)<3",
  ),
  "Playback frame fills the left pane without unused horizontal space",
);
await evaluate("document.querySelector('#summary-tab').focus()");
await call("Input.dispatchKeyEvent", {
  type: "keyDown",
  key: "ArrowRight",
  code: "ArrowRight",
  windowsVirtualKeyCode: 39,
});
await sleep(60);
assert(
  await evaluate(
    "document.querySelector('#transcript-tab').getAttribute('aria-selected')==='true' && document.activeElement.id==='transcript-tab'",
  ),
  "Keyboard arrows select and focus meeting tabs",
);
await click("#summary-tab");
await evaluate("document.activeElement.blur()");
await screenshot("meeting-summary-desktop");
await click('[data-testid="play-toggle"]');
await sleep(1150);
assert(
  await evaluate(
    "document.querySelector('[data-testid=current-time]').textContent!=='0:00' && document.querySelector('[data-testid=play-toggle]').getAttribute('aria-label')==='Pause playback'",
  ),
  "Playback simulation advances while playing",
);
await click('[data-testid="play-toggle"]');
const pausedTime = await evaluate(
  'document.querySelector(".progress-range").value',
);
await sleep(300);
assert(
  await evaluate(
    `document.querySelector('.progress-range').value===${JSON.stringify(pausedTime)}`,
  ),
  "Pause stops playback advancement",
);
await click(".mode-switch button:nth-child(2)");
assert(
  await evaluate(
    `document.querySelector('.audio-screen .waveform')!==null && document.querySelector('.progress-range').value===${JSON.stringify(pausedTime)}`,
  ),
  "Audio mode preserves timeline position and displays a playback visualization",
);
await click(".mode-switch button:nth-child(1)");
await input('[aria-label="Playback speed"]', "2");
assert(
  await evaluate(
    "document.querySelector('[aria-label=\"Playback speed\"]').value==='2'",
  ),
  "Playback speed changes to 2x",
);
await click("#transcript-tab");
await click('.transcript-row [data-time="19"]');
assert(
  await evaluate(
    "document.querySelector('[data-testid=current-time]').textContent==='0:19' && document.querySelector('[data-segment-id=discovery-3]').getAttribute('aria-current')==='true'",
  ),
  "Transcript timestamp seeks playback and highlights the correct speaker segment",
);
await screenshot("meeting-transcript-desktop");
await input('[aria-label="Search transcript"]', "permissions");
assert(
  await evaluate(
    "document.querySelectorAll('.transcript-row').length===3 && document.querySelectorAll('.transcript-row mark').length>0",
  ),
  "Transcript search filters and highlights matching text",
);
await input('[aria-label="Filter transcript by speaker"]', "lily");
assert(
  await evaluate(
    "[...document.querySelectorAll('.transcript-row')].every(row=>row.querySelector('strong').textContent==='Lily Chen')",
  ),
  "Speaker filtering retains the selected speaker",
);
await input('[aria-label="Search transcript"]', "no-such-phrase-192");
assert(
  await evaluate(
    "document.querySelector('.content-empty').textContent.includes('No matching transcript')",
  ),
  "Empty transcript search state renders",
);
await click(".content-empty button");
assert(
  await evaluate("document.querySelectorAll('.transcript-row').length===12"),
  "Reset filters restores the complete transcript",
);
await click('.annotation-kind [data-time="19"]');
assert(
  await evaluate(
    "document.querySelector('[data-testid=current-time]').textContent==='0:19' && document.querySelector('.active-annotation').textContent.includes('Traceability')",
  ),
  "Note timestamp seeks and highlights its source moment",
);
await click('[aria-label="Add annotation"]');
await input(
  "#note-text",
  "QA note: verify this commitment with the pilot team.",
);
await click(".note-form button[type=submit]");
assert(
  await evaluate(
    "document.querySelector('.notes-list').textContent.includes('QA note: verify')",
  ),
  "New timestamped note is added",
);
await input("[data-action-id=a1] .status-select", "done");
assert(
  await evaluate(
    "document.querySelector('[data-action-id=a1]').classList.contains('action-done') && document.querySelector('.action-progress').getAttribute('aria-valuenow')==='1'",
  ),
  "Action completion updates status and completed count",
);
await click("[data-action-id=a2] .jira-link");
assert(
  await evaluate(
    "document.querySelector('.jira-drawer')!==null && document.querySelector('.fake-jira-badge').textContent.includes('Simulated Jira')",
  ),
  "Jira integration opens the local source-visible draft drawer",
);
await input('[aria-label="Jira ticket title"]', "Reviewed prototype draft");
await click('[aria-label="Close Jira drawer"]');
assert(
  await evaluate(
    "document.querySelector('[data-action-id=a2]').dataset.stage==='draft-ready' && document.querySelector('[data-action-id=a2] .draft-edited')!==null && !document.querySelector('.jira-drawer')",
  ),
  "Saving a Jira draft updates the action without external requests",
);
await open("/meetings/discovery");
assert(
  await evaluate(
    "document.querySelector('.notes-list').textContent.includes('QA note: verify') && document.querySelector('[data-action-id=a1]').classList.contains('action-done')",
  ),
  "Notes and action status persist after reload",
);
await click("#ask-tab");
await input("#meeting-question", "Who owns the next steps?");
await click('[aria-label="Send meeting question"]');
assert(
  await evaluate(
    "document.querySelector('.chat-answer').textContent.includes('Lily Chen') && document.querySelectorAll('.chat-answer .timestamp').length===5 && document.querySelector('.chat-answer').textContent.includes('Unassigned')",
  ),
  "Ask Fathom returns action owners with transcript citations",
);
await click('.chat-answer [data-time="73"]');
assert(
  await evaluate(
    "document.querySelector('[data-testid=current-time]').textContent==='1:13'",
  ),
  "Chat citation seeks the recording",
);
await click("#summary-tab");
await click("#ask-tab");
assert(
  await evaluate("document.querySelectorAll('.chat-answer').length===1"),
  "Chat conversation survives tab switching",
);
await screenshot("meeting-ask-desktop");
await input("#meeting-question", "Explain interplanetary teleportation");
await click('[aria-label="Send meeting question"]');
assert(
  await evaluate(
    "[...document.querySelectorAll('.chat-answer')].at(-1).textContent.includes('couldn’t find') && [...document.querySelectorAll('.chat-answer')].at(-1).querySelectorAll('.timestamp').length===0",
  ),
  "Unknown chat question returns an honest no-evidence answer",
);
await click("#summary-tab");
await input('[aria-label="Summary template"]', "engineering");
assert(
  await evaluate(
    "document.querySelector('.summary-view').textContent.includes('Implementation scope')",
  ),
  "Summary template switches to engineering hand-off",
);
await evaluate(
  "Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedSummary=text}}})",
);
await click(".summary-toolbar button");
assert(
  await evaluate(
    "window.__copiedSummary.includes('Implementation scope') && window.__copiedSummary.includes('Dependencies') && !window.__copiedSummary.includes('Key takeaways')",
  ),
  "Copy summary uses the selected template without changing the system clipboard during QA",
);
await input(".progress-range", "125.8");
await click('[data-testid="play-toggle"]');
await sleep(350);
assert(
  await evaluate(
    "document.querySelector('[data-testid=current-time]').textContent==='2:06' && document.querySelector('[data-testid=play-toggle]').getAttribute('aria-label')==='Play playback'",
  ),
  "Playback stops cleanly at recording end",
);
await input('[aria-label="Choose sample meeting"]', "launch-review");
assert(
  await evaluate(
    "location.pathname.endsWith('launch-review') && document.querySelector('.meeting-meta').textContent.includes('8 participants') && document.querySelector('[data-testid=current-time]').textContent==='0:00'",
  ),
  "Switching to the hour-long meeting resets playback and shows eight participants",
);
await click("#transcript-tab");
assert(
  await evaluate("document.querySelectorAll('.transcript-row').length===96"),
  "Full-hour transcript renders all 96 segments",
);
await click('.transcript-row [data-time="3562.5"]');
assert(
  await evaluate(
    "document.querySelector('[data-testid=current-time]').textContent==='59:22' && document.querySelector('[data-segment-id=launch-96]').getAttribute('aria-current')==='true'",
  ),
  "Late-meeting citation seeks and highlights the final speaker",
);
await screenshot("meeting-hour-desktop");
for (const width of [1917, 1024, 768, 390, 320]) {
  await call("Emulation.setDeviceMetricsOverride", {
    width,
    height: width < 600 ? 844 : 1000,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await sleep(100);
  assert(
    await evaluate("document.documentElement.scrollWidth <= innerWidth"),
    `Meeting workspace has no horizontal overflow at ${width}px`,
  );
  if (width === 390) {
    await evaluate("window.scrollTo(0,0)");
    await screenshot("meeting-mobile");
  }
}
await open("/meetings/missing-meeting");
assert(
  await evaluate(
    "document.querySelector('.missing-meeting').textContent.includes('Meeting not found')",
  ),
  "Unknown meeting URL provides a recovery path",
);
await call("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await open("/dashboard");
await click('a[href="/meetings/discovery"]');
await sleep(350);
assert(
  await evaluate(
    "location.pathname==='/meetings/discovery' && document.querySelector('.meeting-player')!==null",
  ),
  "Dashboard recording opens the React meeting workspace",
);
assert(errors.length === 0, "No browser runtime errors");
assert(
  externalRequests.length === 0,
  "Playback, chat, and Jira flows make zero external requests",
);
// Remove only this test's own note and restore its action changes in the isolated QA browser.
await evaluate(
  "localStorage.removeItem('fathom.meeting.discovery');localStorage.removeItem('fathom.meeting.launch-review')",
);
await open("/meetings/discovery");
await fs.writeFile(
  "recon/MEETING-QA.json",
  JSON.stringify(
    {
      checked_at: new Date().toISOString(),
      status: "PASS",
      checks,
      errors,
      externalRequests,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    status: "PASS",
    checks: checks.length,
    short_segments: 12,
    long_segments: 96,
    external_requests: externalRequests.length,
  }),
);
ws.close();
