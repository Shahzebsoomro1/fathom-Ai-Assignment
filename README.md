# Fathom frontend recreation

The first completed milestone is the public landing page, based on the supplied
Fathom reference screenshots. It includes the starfield hero, original artwork and
local fonts, company logos, feature carousel, team/individual tabs, benefit previews,
integrations, use cases, pricing links, gradient CTA, and multi-column footer.

The page adapts to desktop, tablet, and mobile. Menus, carousel controls, swipe
gestures, and tabs work with mouse, touch, and keyboard. Reduced-motion preferences
disable the animated starfield, marquee, and planet animation.

The second milestone adds screenshot-matched `/signup` and `/login` pages, plus a
local dashboard destination at `/dashboard`. Google and Microsoft buttons show a
500ms loading state, disable duplicate clicks, and navigate with a client-side
history/state switch. Sign-in/sign-up links and browser Back keep the form in sync.
SSO is simulated: no real provider account, calendar, credential, or token is used.

Development and browser previews remain local. The user has authorized GitHub
source submission after reviewing and approving the pending commit. Website
deployment and changes to the existing hosted preview remain disabled.

## Run locally

Requires Node.js 22 or later. The React workspace uses the dependencies pinned in
`package-lock.json`.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:4173. Set `PORT` to choose a different port.
The meeting workspace now uses React, React DOM, and esbuild. Install the pinned
dependencies with `npm install` if they are not present. `npm run dev` builds and
watches the React source; `npm run build` performs a local build only.

Auth routes: http://127.0.0.1:4173/signup and http://127.0.0.1:4173/login.
Both provider buttons navigate to http://127.0.0.1:4173/dashboard.

The landing/auth source and compiled meeting workspace are in `dist/`.
Modular meeting components, hooks, JSON fixtures, and styles live in
`frontend/meeting/`. `frontend/server.mjs` provides the local development server.
The existing `dist/` files are tracked because this directory also contains the
landing/auth source and reference assets. Ignore rules exclude new build output;
they do not remove these existing tracked files. No environment variables or
external API credentials are required for the simulated frontend.

The submission includes the root `.agent-logs/` capture files. See
`CODE-REVIEW.md` for the latest review findings and verification limits; the
security/ignore-file preparation does not resolve those functional findings.

## Verification

JavaScript syntax checks passed. Browser verification passed at 1917, 1440, 1024,
768, 390, and 320px, with no horizontal overflow or browser runtime errors.
The carousel, audience and benefit tabs, desktop dropdowns, Escape handling, and
mobile navigation were exercised. Original image and font loading was checked.

See `recon/LANDING-QA.json` and the `landing-*.png` screenshots under
`recon/screenshots/`. `scripts/landing-qa.mjs` reproduces these checks against a
running local server and an isolated Edge browser with DevTools on port 9337.

Auth browser verification passed 37 checks covering all three routes, Google and
Microsoft from both forms, loading/disabled states, the 500ms transition, seamless
navigation, form toggles, browser Back, cancellation of a pending transition, and
responsive layouts at 1440, 768, 390, and 320px. The simulated flow made zero external
OAuth/network requests. See `recon/AUTH-QA.json`, `scripts/auth-qa.mjs`, and the
`auth-*.png` verification screenshots.

The post-call workspace passed browser and data checks for playback, audio/video
mode switching, keyboard tabs, seeking, transcript search and speaker filtering,
summary templates, source-linked chat, action statuses, notes, local Jira drafts,
reload persistence, and the complete one-hour fixture. Its checks made zero external
requests. See `recon/MEETING-QA.json` and `scripts/meeting-qa.mjs`.

The Jira flow now uses an editable side drawer with 400ms autosave, retained AI
originals, suggested-field labels, owner/assigned-by separation, conservative date
resolution, recoverable dismissal with Undo, duplicate-safe simulated ticket keys,
and persistent sequential batch review. See `recon/JIRA-WORKFLOW-QA.json` and
`frontend/meeting/README.md`. No changes were deployed or published.

## Scope and reference material

The third milestone implements the post-call React workspace. Open
http://127.0.0.1:4173/meetings/discovery or
http://127.0.0.1:4173/meetings/launch-review. The dashboard now lists both sample calls.
Playback, source-linked transcript search/filtering, summary templates, instant
transcript-grounded mock chat, action statuses, local Jira drafts, and timestamped
annotations work. The full-hour fixture has eight participants and 96 segments.
See `frontend/meeting/README.md` for the component map and an honest walkthrough
of the simulated capture, media, AI, and integration layers.

The landing page, simulated auth flow, dashboard recording list, and post-call
workspace are implemented. Real calendar/capture integrations, live media, hosted
AI, and external clip-sharing remain future milestones. Signup/login links stay within the local clone;
external resource links still point to the original product's verified public URLs.
No real meeting capture or authentication backend is claimed or provided.

The supplied screenshots and inspection of the live public pages informed this
milestone. The original product's authenticated end-to-end meeting workflow has not
been completed by the coding agent. The references are not claimed as screenshots
of meetings conducted by this agent.

Original public Fathom brand assets are downloaded locally for faithful reference
matching. Their URLs are listed in `frontend/ASSET-SOURCES.json`; brand names and
artwork belong to their respective owners. This is an assignment recreation.

Assignment prompt/final-response capture remains automatic under `.agent-logs/`.
See `CAPTURE-TEST.md` for capture verification and recorded setup failures.
