# Fathom frontend recreation

The first completed milestone is the public landing page, based on the supplied
Fathom reference screenshots. It includes the starfield hero, original artwork and
local fonts, company logos, feature carousel, team/individual tabs, benefit previews,
integrations, use cases, pricing links, gradient CTA, and multi-column footer.

The page adapts to desktop, tablet, and mobile. Menus, carousel controls, swipe
gestures, and tabs work with mouse, touch, and keyboard. Reduced-motion preferences
disable the animated starfield, marquee, and planet animation.

## Run locally

Requires Node.js 22 or later. There are no dependencies to install.

```sh
npm run dev
```

Open http://127.0.0.1:4173. Set `PORT` to choose a different port.

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

## Scope and reference material

This milestone implements the public landing page. The clone's dashboard, signup,
calendar integration, meeting playback, transcript, summaries, action items, search,
and clip-sharing screens are not implemented yet. Signup, login, demo, and external
resource links currently point to the original product's verified public URLs.
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
