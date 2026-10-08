import fs from "node:fs/promises";
import {
  generateAIDraft,
  resolveDueDate,
  transcriptSource,
} from "../frontend/meeting/lib/jiraWorkflow.js";
const fixtures = JSON.parse(
  await fs.readFile("frontend/meeting/data/meetings.json", "utf8"),
);
const checks = [];
function assert(condition, label) {
  if (!condition) throw new Error(label);
  checks.push(label);
}
const reference = "2026-10-08T08:00:00Z";
const meeting = fixtures[0];
assert(
  resolveDueDate("Friday", meeting, reference).date === "2026-10-09",
  "Friday resolves from the meeting date",
);
assert(
  resolveDueDate("tomorrow", meeting, reference).date === "2026-10-08",
  "Tomorrow resolves from the meeting date",
);
assert(
  resolveDueDate("Oct 15", meeting, reference).date === "2026-10-15",
  "Explicit month/day resolves without guessing a different year",
);
assert(
  resolveDueDate("end of day", meeting, meeting.date).date === "2026-10-07",
  "End of day resolves to the local meeting day",
);
for (const phrase of ["next week", "soon", "after launch", "Oct 1", "Feb 30"])
  assert(
    resolveDueDate(phrase, meeting, reference).date === "",
    `${phrase}: vague, past, or invalid date stays blank`,
  );
assert(
  resolveDueDate(
    "Friday",
    { ...meeting, date: "2026-10-09T08:00:00Z" },
    "2026-10-09T08:00:00Z",
  ).date === "",
  "Friday spoken on Friday remains ambiguous",
);
assert(
  resolveDueDate(
    "tomorrow",
    { ...meeting, date: "2026-10-07T20:30:00Z" },
    "2026-10-08T02:00:00Z",
  ).date === "2026-10-09",
  "Relative dates use the meeting timezone at a midnight boundary",
);
const unassigned = meeting.actionItems.find((action) => action.id === "a4");
assert(
  generateAIDraft(unassigned, meeting).assignee === "",
  "A team mention does not guess an individual owner",
);
const delegated = fixtures[1].actionItems.find((action) => action.id === "l7");
assert(
  delegated.ownerId === "priya" &&
    transcriptSource(delegated, fixtures[1]).assignedBy === "Yash Verma",
  "Delegated owner and assigned-by speaker remain separate",
);

const origin = "http://127.0.0.1:4173";
const debug = "http://127.0.0.1:9337";
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
    expression: `(()=>{const value=eval(${JSON.stringify(expression)});return value instanceof Node?Boolean(value):value})()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      (result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text) +
        " | " +
        expression,
    );
  return result.result.value;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function open(path) {
  await call("Page.navigate", { url: origin + path });
  await sleep(250);
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await evaluate("Boolean(document.querySelector('.meeting-app'))"))
      return;
    await sleep(100);
  }
  throw new Error("React meeting route did not render: " + path);
}
async function click(selector) {
  await evaluate(
    `(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw new Error('Missing '+${JSON.stringify(selector)});element.click()})()`,
  );
  await sleep(70);
}
async function input(selector, value) {
  await evaluate(
    `(()=>{const element=document.querySelector(${JSON.stringify(selector)});const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await sleep(70);
}
async function screenshot(name) {
  const shot = await call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await fs.writeFile(
    `recon/screenshots/${name}.png`,
    Buffer.from(shot.data, "base64"),
  );
}
const stored = () =>
  evaluate("JSON.parse(localStorage.getItem('fathom.meeting.discovery'))");
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
  "localStorage.removeItem('fathom.meeting.discovery');localStorage.removeItem('fathom.meeting.launch-review')",
);
await open("/meetings/discovery");
assert(
  await evaluate(
    "document.querySelector('[data-action-id=a1]').dataset.stage==='added'&&!document.querySelector('[data-action-id=a1] .dismiss-action')&&!document.querySelector('[data-action-id=a1] input[type=checkbox]')",
  ),
  "Prefilled ticket is Added, nonselectable, and cannot be dismissed",
);
await click("[data-action-id=a4] .jira-link");
assert(
  await evaluate(
    "document.querySelector('.jira-drawer') && document.querySelector('#transcript-panel').hidden===false && document.querySelector('[aria-label=\"Jira assignee\"]').value==='' && document.querySelector('.drawer-suggestion').textContent.includes('Customer success team')",
  ),
  "Unassigned action opens in a source-visible drawer without guessing an owner",
);
assert(
  await evaluate(
    "document.querySelector('[aria-label=\"Jira due date\"]').value===''&&document.querySelector('.original-due-wording').textContent.includes('after launch')&&document.querySelector('[aria-label=\"Jira ticket description\"]').value.includes('Original due-date wording: after launch')",
  ),
  "Vague due date stays blank and original wording is retained in the draft",
);
assert(
  await evaluate(
    "document.querySelector('.drawer-two-fields label').textContent.includes('suggested')",
  ),
  "Inferred priority is visibly suggested",
);
await input('[aria-label="Jira ticket title"]', "Edited rollout checklist");
await input('[aria-label="Jira assignee"]', "Anya Rose");
await input('[aria-label="Jira priority"]', "High");
await sleep(500);
let snapshot = await stored();
assert(
  snapshot.actions.find((a) => a.id === "a4").draft.title ===
    "Edited rollout checklist" &&
    snapshot.actions.find((a) => a.id === "a4").aiDraft.title ===
      "Prepare the rollout checklist",
  "Debounced autosave keeps user edits and original AI draft separately",
);
assert(
  await evaluate(
    "!document.querySelector('.drawer-two-fields label').textContent.includes('suggested')",
  ),
  "Editing priority removes its suggested label",
);
await click('[aria-label="Close Jira drawer"]');
assert(
  await evaluate(
    "document.querySelector('[data-action-id=a4]').dataset.stage==='draft-ready'&&document.querySelector('[data-action-id=a4] .draft-edited')",
  ),
  "Closing saves Draft ready and shows an edited marker",
);
await open("/meetings/discovery");
await click("[data-action-id=a4] .jira-link");
assert(
  await evaluate(
    "document.querySelector('[aria-label=\"Jira ticket title\"]').value==='Edited rollout checklist'&&document.querySelector('[aria-label=\"Jira assignee\"]').value==='Anya Rose'",
  ),
  "Draft fields reopen exactly after a reload",
);
await click('[data-testid="reset-ai-draft"]');
assert(
  await evaluate(
    "document.querySelector('[aria-label=\"Jira ticket title\"]').value==='Prepare the rollout checklist'&&document.querySelector('[aria-label=\"Jira assignee\"]').value===''&&document.querySelector('.drawer-two-fields label').textContent.includes('suggested')",
  ),
  "Reset to AI draft restores original fields and suggestion labels without a request",
);
await input(
  '[aria-label="Jira ticket title"]',
  "A draft that survives dismissal",
);
await click(".drawer-create-actions button[type=button]");
await click("[data-action-id=a4] .dismiss-action");
assert(
  await evaluate(
    "!document.querySelector('[data-action-id=a4]')&&document.querySelector('[data-action-filter=dismissed]').textContent.includes('1')&&document.querySelector('.undo-dismiss')",
  ),
  "Dismiss hides the item from All, updates its count, and offers Undo",
);
await click(".undo-dismiss");
assert(
  await evaluate(
    "document.querySelector('[data-action-id=a4]').dataset.stage==='draft-ready'&&document.querySelector('[data-action-id=a4] .draft-edited')",
  ),
  "Undo restores a retained edited draft",
);
await click("[data-action-id=a4] .dismiss-action");
await open("/meetings/discovery");
await click("[data-action-filter=dismissed]");
assert(
  await evaluate(
    "document.querySelector('[data-action-id=a4]').dataset.stage==='dismissed'&&!document.querySelector('[data-action-id=a4] .jira-link')&&!document.querySelector('.batch-selection')",
  ),
  "Dismissal persists and is excluded from individual and batch creation",
);
await click("[data-action-id=a4] .restore-action");
await click("[data-action-filter=all]");
await click("[data-action-id=a4] .jira-link");
assert(
  await evaluate(
    "document.querySelector('[aria-label=\"Jira ticket title\"]').value==='A draft that survives dismissal'",
  ),
  "Restore preserves the exact saved draft",
);
await click(".discard-draft-button");
assert(
  await evaluate("document.querySelector('[role=alertdialog]')!==null"),
  "Discard draft requires explicit confirmation",
);
await click(".discard-confirmation .confirm-discard-button");
assert(
  await evaluate(
    "!document.querySelector('.jira-drawer')&&document.querySelector('[data-action-id=a4]').dataset.stage==='detected'&&!document.querySelector('[data-action-id=a4] .draft-edited')",
  ),
  "Confirmed discard clears user draft and returns the item to Detected",
);
await click("[data-action-id=a2] .jira-link");
await input('[aria-label="Jira ticket description"]', "My edited description");
await screenshot("jira-drawer-desktop");
const beforeSequence = await evaluate(
  "Number(localStorage.getItem('fathom.jira.sequence')||143)",
);
await evaluate(
  "document.querySelector('.jira-drawer-form').requestSubmit();document.querySelector('.jira-drawer-form')?.requestSubmit()",
);
await sleep(150);
snapshot = await stored();
const created = snapshot.actions.find((a) => a.id === "a2");
assert(
  created.stage === "added" &&
    /^FAT-\d+$/.test(created.ticket.key) &&
    !created.draft &&
    !created.aiDraft,
  "Create ticket assigns a made-up key, clears drafts, and marks Added",
);
assert(
  created.ticket.description.includes("My edited description") &&
    created.ticket.description.includes(
      transcriptSource(
        meeting.actionItems.find((a) => a.id === "a2"),
        meeting,
      ).quote,
    ) &&
    created.ticket.description.includes("Original due-date wording: Friday"),
  "Created description retains original quote, link and due wording after user edits",
);
assert(
  Number(created.ticket.key.split("-")[1]) ===
    Math.max(143, beforeSequence) + 1,
  "Repeated submit allocates only one fake ticket key",
);
assert(
  snapshot.actions.filter((a) => a.id === "a2" && a.ticket).length === 1,
  "Repeated submit cannot create the action twice",
);
await open("/meetings/discovery");
assert(
  await evaluate(
    "document.querySelector('[data-action-id=a2]').dataset.stage==='added'&&!document.querySelector('[data-action-id=a2] .dismiss-action')",
  ),
  "Created ticket persists across reload and remains nondismissible",
);
await click("[data-action-id=a2] .jira-link");
assert(
  await evaluate(
    "document.querySelector('.ticket-added-message')&&!document.querySelector('.drawer-create-actions')",
  ),
  "Existing ticket opens read-only with no second Create ticket control",
);
await click('[aria-label="Close Jira drawer"]');
await click("[data-action-id=a5] .dismiss-action");
await click('[aria-label="Select all eligible action items"]');
assert(
  await evaluate(
    "[...document.querySelectorAll('.action-select-box input')].filter(input=>input.checked).length===2",
  ),
  "Select all excludes Added and Dismissed items",
);
await click(".batch-review-button");
assert(
  await evaluate(
    "document.querySelector('.batch-step').textContent.includes('Review 1 of 2')",
  ),
  "Batch review starts with the eligible selected queue",
);
await input('[aria-label="Jira ticket title"]', "Batch step one edit");
await click('[aria-label="Next batch item"]');
await input('[aria-label="Jira ticket title"]', "Batch step two edit");
await click('[aria-label="Close Jira drawer"]');
await open("/meetings/discovery");
assert(
  await evaluate(
    "document.querySelector('.resume-batch').textContent.includes('2 of 2')",
  ),
  "Cancelled batch retains its exact review step across reload",
);
await click(".resume-batch");
assert(
  await evaluate(
    "document.querySelector('[aria-label=\"Jira ticket title\"]').value==='Batch step two edit'&&document.querySelector('.batch-step').textContent.includes('2 of 2')",
  ),
  "Resuming batch restores edits and the same step",
);
await click('[aria-label="Previous batch item"]');
assert(
  await evaluate(
    "document.querySelector('[aria-label=\"Jira ticket title\"]').value==='Batch step one edit'",
  ),
  "Previous batch step retains its own draft",
);
await click(".drawer-create-actions button[type=submit]");
assert(
  await evaluate(
    "document.querySelector('.batch-step').textContent.includes('2 of 2')&&document.querySelector('[aria-label=\"Jira ticket title\"]').value==='Batch step two edit'",
  ),
  "Creating a batch ticket advances to the next review without losing edits",
);
await click(".drawer-create-actions button[type=submit]");
assert(
  await evaluate("!document.querySelector('.jira-drawer')"),
  "Creating the last batch ticket closes the completed review",
);
snapshot = await stored();
assert(
  snapshot.actions
    .filter((a) => a.ticket && !a.ticket.seeded)
    .map((a) => a.ticket.key).length ===
    new Set(
      snapshot.actions
        .filter((a) => a.ticket && !a.ticket.seeded)
        .map((a) => a.ticket.key),
    ).size,
  "Created fake ticket keys are unique",
);
await open("/meetings/launch-review");
await click("[data-action-id=l7] .jira-link");
assert(
  await evaluate(
    "document.querySelector('[aria-label=\"Jira assignee\"]').value==='Priya Shah'&&document.querySelector('.drawer-source').textContent.includes('Assigned by Yash Verma')",
  ),
  "Delegated assignee and speaker are shown separately in the drawer",
);
for (const width of [1917, 1024, 768, 390, 320]) {
  await call("Emulation.setDeviceMetricsOverride", {
    width,
    height: width < 600 ? 844 : 1000,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await sleep(150);
  assert(
    await evaluate("document.documentElement.scrollWidth<=innerWidth"),
    `Drawer and transcript fit at ${width}px`,
  );
  if (width === 390) {
    await sleep(150);
    assert(
      await evaluate(
        "document.querySelector('#transcript-panel').getBoundingClientRect().top < document.querySelector('.jira-drawer').getBoundingClientRect().top",
      ),
      "Mobile drawer leaves transcript context visible above the sheet",
    );
    await screenshot("jira-drawer-mobile");
    await click('[aria-label="Minimize Jira drawer"]');
    assert(
      await evaluate(
        "document.querySelector('.jira-drawer').classList.contains('drawer-minimized')",
      ),
      "Mobile drawer minimizes so the transcript remains readable",
    );
    await click('[aria-label="Expand Jira drawer"]');
  }
}
assert(errors.length === 0, "No browser runtime errors in the Jira workflow");
assert(
  externalRequests.length === 0,
  "No Jira, AI, hosting, or external requests are made",
);
await evaluate(
  "localStorage.removeItem('fathom.meeting.discovery');localStorage.removeItem('fathom.meeting.launch-review')",
);
await call("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await open("/meetings/discovery");
await fs.writeFile(
  "recon/JIRA-WORKFLOW-QA.json",
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
    external_requests: externalRequests.length,
  }),
);
ws.close();
