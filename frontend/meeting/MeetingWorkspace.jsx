import { useEffect, useRef, useState } from "react";
import { usePlayback } from "./hooks/usePlayback.js";
import { useMeetingState } from "./hooks/useMeetingState.js";
import { Avatar } from "./components/Avatar.jsx";
import { Icon } from "./components/Icon.jsx";
import { MeetingPlayer } from "./components/MeetingPlayer.jsx";
import { MeetingTabs } from "./components/MeetingTabs.jsx";
import { TranscriptView } from "./components/TranscriptView.jsx";
import { SummaryView } from "./components/SummaryView.jsx";
import { AskFathom } from "./components/AskFathom.jsx";
import { ActionItems } from "./components/ActionItems.jsx";
import { Annotations } from "./components/Annotations.jsx";
import { JiraDrawer } from "./components/JiraDrawer.jsx";

export function MeetingWorkspace({ meeting, meetings, onMeetingChange }) {
  const timeParam = Number(new URLSearchParams(location.search).get("t")) || 0;
  const playback = usePlayback(meeting.duration, timeParam);
  const state = useMeetingState(meeting);
  const [tab, setTab] = useState("summary");
  const [query, setQuery] = useState("");
  const [draftTime, setDraftTime] = useState(null);
  const [viewTicketId, setViewTicketId] = useState(null);
  const [focusSource, setFocusSource] = useState(null);
  const [toast, setToast] = useState("");
  const [undoActionId, setUndoActionId] = useState(null);
  const toastTimer = useRef(null);
  useEffect(() => {
    document.title = `${meeting.title} — Fathom`;
    return () => clearTimeout(toastTimer.current);
  }, [meeting.title]);
  function notify(message, undoId = null) {
    setToast(message);
    setUndoActionId(undoId);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => {
        setToast("");
        setUndoActionId(null);
      },
      undoId ? 7000 : 3200,
    );
  }
  const reviewAction = state.review?.open
    ? state.actions.find(
        (action) => action.id === state.review.ids[state.review.index],
      )
    : null;
  const drawerAction = viewTicketId
    ? state.actions.find((action) => action.id === viewTicketId)
    : reviewAction;
  const showSource = (time) => {
    setTab("transcript");
    setQuery("");
    playback.seek(time);
    setFocusSource({ time, request: Date.now() });
    if (window.innerWidth < 761)
      requestAnimationFrame(() =>
        document
          .querySelector("#transcript-panel")
          ?.scrollIntoView({ block: "start" }),
      );
  };
  useEffect(() => {
    if (drawerAction) showSource(drawerAction.time);
    let narrow = window.innerWidth < 761;
    const onResize = () => {
      const next = window.innerWidth < 761;
      if (drawerAction && next && !narrow)
        requestAnimationFrame(() =>
          document
            .querySelector("#transcript-panel")
            ?.scrollIntoView({ block: "start" }),
        );
      narrow = next;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawerAction?.id]);
  const openJira = (ids, batch = false, ticketOnly = false) => {
    if (ticketOnly) {
      setViewTicketId(ids[0]);
      return;
    }
    setViewTicketId(null);
    state.openReview(ids, batch);
  };
  const closeDrawer = () => {
    setViewTicketId(null);
    state.closeReview();
  };
  const createTicket = (draft) => {
    const ticket = state.createTicket(drawerAction.id, draft);
    if (!ticket) {
      notify("This action already has a ticket or is no longer eligible.");
      closeDrawer();
      return;
    }
    notify(`${ticket.key} created · Simulated Jira`);
    if (state.review?.batch) state.moveReview(1);
    else state.closeReview();
  };
  const copyLink = async () => {
    const url = new URL(location.href);
    url.searchParams.set("t", Math.floor(playback.currentTime));
    try {
      await navigator.clipboard.writeText(url.href);
      notify("Local meeting link copied");
    } catch {
      notify(
        "Copy is unavailable in this browser. Copy the meeting URL from the address bar.",
      );
    }
  };
  return (
    <div className={`meeting-app${drawerAction ? " jira-review-open" : ""}`}>
      <header className="meeting-topbar">
        <a href="/" aria-label="Fathom home">
          <img src="/assets/logo.svg" alt="Fathom" />
        </a>
        <label className="topbar-search">
          <Icon name="search" size={17} />
          <input
            placeholder="Search this meeting"
            aria-label="Search this meeting"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setTab("transcript");
            }}
          />
        </label>
        <div className="topbar-right">
          <span className="preview-label">LOCAL WORKSPACE</span>
          <a
            href="/dashboard"
            className="profile-circle"
            aria-label="Return to dashboard"
          >
            S
          </a>
        </div>
      </header>
      <main className="meeting-main">
        <div className="meeting-heading">
          <div>
            <a className="back-to-calls" href="/dashboard">
              <Icon name="back" size={14} />
              My Calls
            </a>
            <h1>{meeting.title}</h1>
            <div className="meeting-meta">
              <span>
                <Icon name="calendar" size={14} />
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "Asia/Karachi",
                }).format(new Date(meeting.date))}
              </span>
              <span>
                <Icon name="clock" size={14} />
                {meeting.duration < 600 ? "2 min" : "60 min"}
              </span>
              <span>
                <Icon name="people" size={15} />
                {meeting.speakers.length} participants
              </span>
              <span className="platform-pill">
                <img src="/assets/google-meet.svg" alt="" />
                {meeting.platform}
              </span>
            </div>
          </div>
          <div className="meeting-heading-actions">
            <label className="fixture-select">
              <span className="sr-only">Choose sample meeting</span>
              <select
                aria-label="Choose sample meeting"
                value={meeting.id}
                onChange={(event) => onMeetingChange(event.target.value)}
              >
                {meetings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.duration < 600
                      ? "Discovery · 2 min"
                      : "Team sync · 60 min · 8 people"}
                  </option>
                ))}
              </select>
            </label>
            <button className="subtle-button copy-link" onClick={copyLink}>
              <Icon name="link" size={15} />
              Copy link
            </button>
          </div>
        </div>
        <div className="meeting-split">
          <div className="meeting-left">
            <MeetingPlayer
              meeting={meeting}
              playback={playback}
              onAddNote={setDraftTime}
            />
            <MeetingTabs
              value={tab}
              onChange={setTab}
              transcriptCount={meeting.transcript.length}
            />
            <section
              id="summary-panel"
              role="tabpanel"
              aria-labelledby="summary-tab"
              hidden={tab !== "summary"}
            >
              <SummaryView
                meeting={meeting}
                onSeek={playback.seek}
                onToast={notify}
              />
            </section>
            <section
              id="transcript-panel"
              role="tabpanel"
              aria-labelledby="transcript-tab"
              hidden={tab !== "transcript"}
            >
              <TranscriptView
                meeting={meeting}
                playback={playback}
                query={query}
                onQueryChange={setQuery}
                onAddNote={setDraftTime}
                visible={tab === "transcript"}
                focusSource={focusSource}
              />
            </section>
            <section
              id="ask-panel"
              role="tabpanel"
              aria-labelledby="ask-tab"
              hidden={tab !== "ask"}
            >
              <AskFathom meeting={meeting} onSeek={playback.seek} />
            </section>
          </div>
          <aside className="meeting-sidebar">
            <section className="attendees-section">
              <div className="sidebar-section-heading">
                <h2>
                  ATTENDEES <span>{meeting.speakers.length}</span>
                </h2>
                <span>{meeting.subtitle}</span>
              </div>
              <div className="attendee-list">
                {meeting.speakers.map((speaker) => (
                  <div key={speaker.id}>
                    <Avatar speaker={speaker} />
                    <span>
                      {speaker.name}
                      <small>{speaker.handle}</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <ActionItems
              meeting={meeting}
              actions={state.actions}
              review={state.review}
              onStatusChange={state.setActionStatus}
              onJira={openJira}
              onDismiss={(id) => {
                state.dismiss(id);
                notify("Action item dismissed", id);
              }}
              onRestore={(id) => {
                state.restoreAction(id);
                notify("Action item restored");
              }}
              onResume={() => {
                setViewTicketId(null);
                state.resumeReview();
              }}
              onSeek={playback.seek}
            />
            <Annotations
              meeting={meeting}
              notes={state.notes}
              playback={playback}
              draftTime={draftTime}
              onDraftTime={setDraftTime}
              onAdd={(note) => {
                state.addNote(note);
                notify("Note saved");
              }}
              onDelete={state.deleteNote}
            />
            <p className="sidebar-save-note">
              <Icon name="check" size={12} />
              Changes stay in this browser.
            </p>
          </aside>
        </div>
      </main>
      {drawerAction && (
        <JiraDrawer
          key={drawerAction.id}
          action={drawerAction}
          meeting={meeting}
          review={viewTicketId ? null : state.review}
          onClose={closeDrawer}
          onSave={(draft) => state.saveDraft(drawerAction.id, draft)}
          onReset={() => state.resetDraft(drawerAction.id)}
          onDiscard={() => {
            state.discardDraft(drawerAction.id);
            closeDrawer();
            notify("Draft discarded");
          }}
          onCreate={createTicket}
          onStep={state.moveReview}
          onSeek={showSource}
        />
      )}
      <div
        className={`meeting-toast${toast ? " visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && <Icon name="check" size={15} />}
        <span>{toast}</span>
        {undoActionId && (
          <button
            className="undo-dismiss"
            onClick={() => {
              state.restoreAction(undoActionId);
              notify("Dismissal undone");
            }}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
