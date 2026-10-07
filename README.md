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

All remaining development is local only. Do not deploy, publish, or push updates to
the existing hosted preview. That preview predates the user's local-only instruction.

## Run locally

Requires Node.js 22 or later. There are no dependencies to install.

```sh
npm run dev
```

Open http://127.0.0.1:4173. Set `PORT` to choose a different port.

Auth routes: http://127.0.0.1:4173/signup and http://127.0.0.1:4173/login.
Both provider buttons navigate to http://127.0.0.1:4173/dashboard.

The source is directly deployable static HTML, CSS, and JavaScript in `dist/`.
`frontend/server.mjs` provides the local development server.

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

## Scope and reference material

The landing page and simulated auth flow are implemented. The dashboard currently
provides the reference's empty workspace as the auth destination, with navigation,
the Ask Fathom empty state, and the onboarding entry point. Full calendar integration,
meeting playback, transcript, summaries, action items, meeting search, and clip-sharing
flows remain future milestones. Signup/login links stay within the local clone;
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
