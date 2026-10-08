# Post-call meeting workspace

The React workspace mounts at `/meetings/discovery` and `/meetings/launch-review`.
The dashboard's sample recording cards open these routes. Existing landing and
authentication pages retain their previous implementation.

## Components and state

- `MeetingWorkspace.jsx`: shared playback, selected tab, search, annotations,
  notifications, and Jira draft state.
- `components/MeetingPlayer.jsx`: video/audio simulation, timeline seeking, speed,
  pause/play, ten-second skips, chapters, and note creation at the current time.
- `components/MeetingTabs.jsx`: accessible summary/transcript/chat tabs with
  keyboard navigation. Panels remain mounted so switching tabs preserves state.
- `components/TranscriptView.jsx`: JSON transcript rows, speaker avatars/handles,
  search highlighting, speaker filtering, active-segment highlighting, and optional
  follow-playback scrolling.
- `components/SummaryView.jsx`: general, sales, and engineering templates with
  clickable source citations and copying of the selected template.
- `components/AskFathom.jsx`: instant local answers and clickable source timestamps.
- `components/ActionItems.jsx`: separate work status and Jira lifecycle, owner and
  assigned-by speaker, source moments, dismissal/restoration, filters, selection,
  and batch review. `JiraDrawer.jsx` edits and creates simulated Jira tickets while
  the transcript stays available.
- `components/Annotations.jsx`: note/decision/risk moments, seek links, and creating
  or removing local notes.
- `Avatar.jsx`, `Icon.jsx`, and `Timestamp.jsx`: shared presentation primitives.

`hooks/usePlayback.js` owns a speed-aware clock with clamped seeking, interval
cleanup, replay, and automatic stopping at the end. `hooks/useMeetingState.js`
persists action statuses, note changes, and Jira drafts locally under a separate
key per meeting. If browser storage is unavailable, the UI continues in memory.

## Structured mock data

`data/meetings.json` contains two complete fixtures:

- A 2:06 discovery call: four speakers, twelve timestamped segments, five action
  items, three annotations, chapters, summary templates, decisions, and risks.
- A 60:00 team sync: eight speakers, 96 segments, six topic chapters, seven action
  items, five annotations, summary templates, decisions, and risks.

Transcript rows carry `id`, `speakerId`, `start`, `end`, `text`, and `tags`.
Action items and annotations refer to a speaker and source time. The QA script
checks speaker references, ordering, duration bounds, and the final recording time.

`lib/answers.js` implements deterministic mock answers from these records: actions,
decisions, risks, summary, duration, participants, and ranked transcript excerpts.
Every factual answer has seekable evidence; unsupported questions return a clear
no-evidence answer. This is not a hosted AI model or a claim of real AI inference.

## Local build and preview

```sh
npm install
npm run dev
```

React and React DOM are pinned in the root lockfile. esbuild compiles JSX and JSON
into `dist/meeting.js` and `dist/meeting.css`. `npm run dev` builds and watches the
meeting source, then serves the entire frontend on http://127.0.0.1:4173.
Reload the browser after changing source. `npm run build` produces the same local
bundle without starting the server. No command deploys or publishes the application.

## Walkthrough and intentional stubs

1. Sign in through the simulated local auth flow and open a sample recording.
2. Play/pause, change speed, switch video/audio, and seek using the progress bar.
3. Open TRANSCRIPT, click `0:19`, search `permissions`, and filter by Lily Chen.
4. Click the sidebar's `note · 19s`, add a note, and change an action's status.
5. Select an action, open Add to Jira, edit its autosaved draft, and create a
   simulated ticket. No real Jira issue is created.
6. Ask `Who owns the next steps?` and click the `1:13` source in the answer.
7. Switch summary templates; copy the selected summary if clipboard access is allowed.
8. Choose the full-hour fixture, filter its eight speakers, and seek to `59:22`.

Capture, moving video/audio media, real SSO/calendar connections, real Jira, and
hosted AI inference remain stubbed. The player uses a sample still image from the
user-supplied reference and a simulated timeline; audio mode uses a visualization.
All activity remains local. The local meeting URL can include `?t=19` to open at a
specific second; copying a link does not share or publish a real recording.

See `recon/MEETING-QA.json` and `recon/screenshots/meeting-*.png` for validation.

## Agreed Jira review workflow

Ownership refers to the person doing the work. The transcript speaker is retained
separately as `assignedById`; "I'll" assigns the speaker, explicit delegation uses
the named person, and team/vague mentions remain unassigned with a suggestion hint.
Draft priorities and inferred assignees are labeled suggested until the user edits
the field. Dates are resolved only for clear phrases using the meeting's date and
timezone. Ambiguous weekdays, vague phrases, invalid dates, and past dates stay
blank. Both the original wording and timestamped transcript evidence remain in
the ticket description, even when the user edits the description body.

The Jira lifecycle is separate from work completion: Detected, Draft ready, Added,
or Dismissed. All hides dismissed items; the Dismissed filter has a count and Restore.
Dismissal offers Undo, preserves drafts, persists locally, and excludes the item
from selection/creation. A restored item returns to Detected or Draft ready. Added
items have a made-up ticket key and cannot be dismissed or added again.

The side drawer autosaves after 400ms of inactivity and flushes pending edits on
close, Cancel, page reload, and step changes. The original AI draft is stored
separately; Reset to AI draft does not regenerate it or contact an API. Edited
cards show an edited marker, and edited fields lose their suggested labels.
Discard draft requires confirmation. Create ticket clears both drafts and marks
the action Added. Ticket details then open read-only.

Batch review keeps a persistent queue and index. Previous/Next and Skip retain
each item's draft. Cancel and reload preserve the current step; Resume review
reopens it. Creating a ticket advances to the next item and closes the last step.
On mobile, the bottom drawer keeps transcript context above it and can be minimized.

All Jira keys, AI drafting, and ticket creation are simulated in this local browser.
`lib/jiraWorkflow.js` implements the date/provenance rules and source generation;
`hooks/useMeetingState.js` owns persistent workflow transitions and duplicate guards.
See `scripts/jira-workflow-qa.mjs`, `recon/JIRA-WORKFLOW-QA.json`, and the
`jira-drawer-*.png` captures for verification.
