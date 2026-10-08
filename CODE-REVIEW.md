# Local code review — 2026-10-08

Verdict: changes are needed before submission. The component structure is reasonable, but the Jira workflow has a confirmed unintended-submit bug and several persistence and responsive defects. Product source was not changed during this review. Nothing was published.

## Findings

1. **P1 — Clicking transcript evidence creates a ticket.** `frontend/meeting/components/Timestamp.jsx:4` renders a button without `type="button"`. `JiraDrawer.jsx:299` places it inside the creation form. Reproduced by opening action a2 and clicking its 1:24 timestamp: the drawer closed, a fake ticket was allocated, and the action became Added. Set the shared timestamp button type explicitly and cover this interaction in regression checks.

2. **P2 — Persistence failure is reported as success.** `frontend/meeting/hooks/useMeetingState.js:68` suppresses storage write failures, while `JiraDrawer.jsx:47` and `:56` unconditionally report Saved. Reproduced with a simulated QuotaExceededError: the drawer displayed “Saved locally,” then reloading returned the action to Detected. Return persistence status and show a recoverable unsaved state for drafts, dismissals, notes, and ticket changes.

3. **P2 — Valid JSON with an invalid saved-state shape crashes the page.** `frontend/meeting/hooks/useMeetingState.js:21` calls `.find` without validating that saved.actions is an array. Saving `{"actions":{}}` under the meeting storage key and reloading produced `TypeError: ...actions?.find is not a function` and an empty React root. Validate stored collections, nullable entries, drafts, and review indexes before restoring. Provide a recovery path rather than a blank screen.

4. **P2 — Batch discard controls extend below short viewports.** `frontend/meeting/styles/jira.css:326`, `:483`, and `:646` combine a shrinking form with fixed header/footer areas. With batch review and discard confirmation open, the footer ended at y=607 in a 320×568 viewport and y=494 in an 844×390 viewport. Confirmation/action controls were cut off and the editable field region collapsed to 30–36 pixels. Allow the whole drawer content to scroll or adapt the footer and drawer height to available space. Screenshot: `.recon-runtime/review-batch-landscape.png`.

5. **P2 — Dashboard onboarding overlaps other controls on short screens.** `dist/auth.css:7` absolutely positions `.onboarding-guide` inside the scrolling calls panel, while the fixed `.expand-ask` control occupies the same bottom region. At 390×500 the Ask Fathom button covers part of the onboarding label; at 320×568 and 844×390 the guide also intersects the second recording card. Reserve layout space or use normal flow at short/mobile breakpoints. Screenshot: `.recon-runtime/review-dashboard-small.png`.

6. **P3 — Hook dependency omissions and warning-check coverage.** `JiraDrawer.jsx:75` omits readOnly from its mount cleanup effect; `:89` omits close; `MeetingWorkspace.jsx:78` reads drawerAction and showSource but depends only on drawerAction?.id. Refactor these into stable callbacks/refs with explicit lifecycle intent. `package.json:10` only syntax-checks four non-React files; there is no JSX/unused-variable/hooks lint step. `frontend/meeting-build.config.mjs` forces production mode even for `npm run dev`, and the checked-in browser suites collect exceptions but not console warning/error events. Add a genuine development configuration and lint/console-warning coverage. These are static dependency findings; the exercised development flows did not emit missing-key or invalid-prop warnings.

7. **P3 — Unused API surface.** `frontend/meeting/lib/jiraWorkflow.js:3` exports DRAFT_FIELDS with no consumer. `frontend/meeting/hooks/usePlayback.js:34` exposes setPlaying although no consumer uses it. No unused imports or local variables were found in the React components during source inspection. Remove unused exports/return fields or put them to use.

8. **P3 — Dashboard Ask Fathom contradicts the populated dashboard.** `dist/auth.js:115` always answers that there are no recorded meetings, even while two sample recordings are visible. Ground this stub in the fixtures or explicitly direct users to the per-meeting assistant.

## Structure and styling

The player, transcript, summary, chat, action list, annotations, drawer, workflow logic, and playback state have sensible module boundaries. List rendering uses keys; no unhandled DOM props were found in the inspected components. Dark backgrounds and cyan accents are consistent overall, with distinct Added/Dismissed states.

This project uses plain CSS, not Tailwind. There are no Tailwind classes/configuration to validate. The landing/auth pages use imperative JavaScript, while meeting routes use React. This split works for the current prototype, but theme values are repeated across three stylesheets and `useMeetingState` combines persistence, normalization, ticket creation, and batch orchestration. Shared design tokens and a reducer/persistence adapter would make future changes easier; a framework rewrite is not necessary for this review.

## Validation and limits

- `npm.cmd run check` passed.
- A separate, unminified development React bundle built successfully; exercised drawer, chat, transcript, and playback flows under StrictMode emitted no missing-key or invalid-prop warnings. Only the React DevTools informational message appeared.
- Existing browser checks were rerun locally. Their original zero-external-request assertion counted injected `chrome-extension:` assets as external app traffic. Temporary review copies exclude only that scheme and write their reports/screenshots under `.recon-runtime`; product code and checked-in test assertions were not changed.
- Landing (17 checks) and auth (37 checks) passed. Initial meeting and Jira runs reached their final external-request assertions without earlier failures. Later temporary reruns were not a clean full-suite pass: the meeting harness stalled and was stopped, and Jira failed its mobile transcript-visibility assertion. Do not treat older checked-in PASS reports as a clean result for this review. A fresh isolated browser run is needed after the fixes.
- Additional browser probes covered desktop/tablet/mobile widths and short viewports, storage write failure, malformed persisted state, and unintended timestamp submission. These exposed failures not covered by the existing happy-path suites.
- No ESLint configuration/tooling exists in the project; unused-code and effect-dependency findings above are from source inspection, not a claimed clean lint run.
- Auth, recording/playback, AI answers, and Jira are intentionally simulated. That is compatible with the agreed frontend demo scope; it is not a production authentication/meeting/Jira service.
