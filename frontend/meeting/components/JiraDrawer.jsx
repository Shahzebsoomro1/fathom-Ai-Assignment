import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.jsx";
import { Timestamp } from "./Timestamp.jsx";
import {
  PRIORITIES,
  generateAIDraft,
  transcriptSource,
} from "../lib/jiraWorkflow.js";

export function JiraDrawer({
  action,
  meeting,
  review,
  onSave,
  onReset,
  onDiscard,
  onClose,
  onCreate,
  onStep,
  onSeek,
}) {
  const readOnly = Boolean(action.ticket);
  const original = action.aiDraft || generateAIDraft(action, meeting);
  const initial = readOnly
    ? { ...original, ...action.ticket }
    : action.draft || { ...original, editedFields: {} };
  const [draft, setDraft] = useState(initial);
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [busy, setBusy] = useState(false);
  const draftRef = useRef(draft);
  const saveRef = useRef(onSave);
  const timer = useRef(null);
  const dirty = useRef(false);
  const finished = useRef(false);
  const firstField = useRef(null);
  draftRef.current = draft;
  saveRef.current = onSave;
  const source = transcriptSource(action, meeting);
  const flush = () => {
    clearTimeout(timer.current);
    if (dirty.current && !finished.current && !readOnly) {
      saveRef.current(draftRef.current);
      dirty.current = false;
    }
    setSaveStatus("Saved");
  };
  useEffect(() => {
    if (!dirty.current || readOnly) return;
    setSaveStatus("Saving…");
    timer.current = setTimeout(() => {
      if (!finished.current) {
        saveRef.current(draftRef.current);
        dirty.current = false;
        setSaveStatus("Saved");
      }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [draft, readOnly]);
  useEffect(() => {
    if (window.innerWidth >= 761)
      firstField.current?.focus({ preventScroll: true });
    const onPageHide = () => {
      if (dirty.current && !finished.current && !readOnly)
        saveRef.current(draftRef.current);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("pagehide", onPageHide);
      if (dirty.current && !finished.current && !readOnly)
        saveRef.current(draftRef.current);
    };
  }, []);
  const close = () => {
    flush();
    onClose();
  };
  useEffect(() => {
    const keyDown = (event) => {
      if (event.key === "Escape") {
        if (confirmDiscard) setConfirmDiscard(false);
        else close();
      }
    };
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [confirmDiscard]);
  const edit = (field, value) => {
    dirty.current = true;
    setDraft((previous) => ({
      ...previous,
      [field]: value,
      editedFields: { ...previous.editedFields, [field]: true },
      suggested: { ...previous.suggested, [field]: false },
    }));
  };
  const reset = () => {
    clearTimeout(timer.current);
    dirty.current = false;
    const next = { ...original, editedFields: {} };
    draftRef.current = next;
    setDraft(next);
    onReset();
    setSaveStatus("Saved");
  };
  const discard = () => {
    finished.current = true;
    dirty.current = false;
    clearTimeout(timer.current);
    onDiscard();
  };
  const create = (event) => {
    event.preventDefault();
    if (finished.current || busy || readOnly || !draft.title.trim()) return;
    finished.current = true;
    dirty.current = false;
    clearTimeout(timer.current);
    setBusy(true);
    onCreate(draftRef.current);
  };
  const suggested = (field) =>
    !readOnly && draft.suggested?.[field] && !draft.editedFields?.[field];
  return (
    <aside
      className={`jira-drawer${minimized ? " drawer-minimized" : ""}`}
      aria-labelledby="jira-drawer-title"
    >
      <header className="jira-drawer-header">
        <div>
          <span>
            <Icon name="jira" size={19} />
            {readOnly ? "TICKET DETAILS" : "JIRA DRAFT"}
          </span>
          <h2 id="jira-drawer-title">
            {readOnly ? action.ticket.key : "Review before creating"}
          </h2>
        </div>
        <div className="drawer-header-buttons">
          <button
            className="minimize-drawer"
            onClick={() => setMinimized((value) => !value)}
            aria-label={
              minimized ? "Expand Jira drawer" : "Minimize Jira drawer"
            }
          >
            <Icon name="chevron" />
          </button>
          <button onClick={close} aria-label="Close Jira drawer">
            <Icon name="close" />
          </button>
        </div>
      </header>
      {!minimized && (
        <>
          <div className="jira-drawer-intro">
            <span className="fake-jira-badge">Simulated Jira</span>
            <span>
              {readOnly ? "Ticket already added" : `${saveStatus} locally`}
            </span>
          </div>
          {review?.batch && (
            <div className="batch-step">
              <span>
                Review {review.index + 1} of {review.ids.length}
              </span>
              <div>
                <button
                  disabled={review.index === 0}
                  onClick={() => {
                    flush();
                    onStep(-1);
                  }}
                  aria-label="Previous batch item"
                >
                  Previous
                </button>
                <button
                  disabled={review.index >= review.ids.length - 1}
                  onClick={() => {
                    flush();
                    onStep(1);
                  }}
                  aria-label="Next batch item"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          <form className="jira-drawer-form" onSubmit={create}>
            <div className="drawer-fields">
              <label>
                Title
                <input
                  ref={firstField}
                  value={draft.title || ""}
                  readOnly={readOnly}
                  onChange={(event) => edit("title", event.target.value)}
                  maxLength={300}
                  required
                  aria-label="Jira ticket title"
                />
              </label>
              <label>
                Description
                <textarea
                  value={draft.description || ""}
                  readOnly={readOnly}
                  onChange={(event) => edit("description", event.target.value)}
                  rows="7"
                  maxLength={6000}
                  aria-label="Jira ticket description"
                />
              </label>
              <p className="drawer-description-hint">
                The original quote, timestamp link and due-date wording stay
                attached to the ticket.
              </p>
              <label>
                <span>
                  Assignee{" "}
                  {suggested("assignee") && (
                    <span className="suggested-label">suggested</span>
                  )}
                </span>
                <input
                  list="jira-assignees"
                  value={draft.assignee || ""}
                  readOnly={readOnly}
                  onChange={(event) => edit("assignee", event.target.value)}
                  placeholder="Unassigned"
                  maxLength={120}
                  aria-label="Jira assignee"
                />
              </label>
              <datalist id="jira-assignees">
                {meeting.speakers.map((speaker) => (
                  <option key={speaker.id} value={speaker.name} />
                ))}
              </datalist>
              {!draft.assignee &&
                action.ownerSuggestion &&
                !draft.editedFields?.assignee && (
                  <p className="drawer-suggestion">
                    Suggested: {action.ownerSuggestion}. No individual was
                    assigned.
                  </p>
                )}
              <div className="drawer-two-fields">
                <label>
                  <span>
                    Priority{" "}
                    {suggested("priority") && (
                      <span className="suggested-label">suggested</span>
                    )}
                  </span>
                  <select
                    value={draft.priority || "Medium"}
                    disabled={readOnly}
                    onChange={(event) => edit("priority", event.target.value)}
                    aria-label="Jira priority"
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    Due date{" "}
                    {suggested("dueDate") && (
                      <span className="suggested-label">suggested</span>
                    )}
                  </span>
                  <input
                    type="date"
                    value={draft.dueDate || ""}
                    readOnly={readOnly}
                    onChange={(event) => edit("dueDate", event.target.value)}
                    aria-label="Jira due date"
                  />
                </label>
              </div>
              <div className="original-due-wording">
                <span>Original wording</span>
                <strong>
                  {action.duePhrase
                    ? `“${action.duePhrase}”`
                    : "No due date mentioned"}
                </strong>
                {!draft.dueDate && <p>{original.dueReason}</p>}
              </div>
              <div className="drawer-source">
                <div>
                  <Icon name="note" size={15} />
                  <strong>Transcript evidence</strong>
                  <Timestamp time={source.time} onSeek={onSeek} />
                </div>
                <blockquote>{source.quote}</blockquote>
                <p>
                  Assigned by {source.assignedBy} ·{" "}
                  {meeting.timeZone || "Asia/Karachi"}
                </p>
                <button
                  type="button"
                  onClick={() => onSeek(source.time)}
                  className="drawer-source-button"
                >
                  Show this moment in transcript
                </button>
              </div>
            </div>
            <footer className="jira-drawer-footer">
              {!readOnly && (
                <>
                  <div className="draft-tools">
                    <button
                      type="button"
                      onClick={reset}
                      data-testid="reset-ai-draft"
                    >
                      Reset to AI draft
                    </button>
                    <button
                      type="button"
                      className="discard-draft-button"
                      onClick={() => setConfirmDiscard(true)}
                    >
                      Discard draft
                    </button>
                  </div>
                  {confirmDiscard && (
                    <div
                      className="discard-confirmation"
                      role="alertdialog"
                      aria-label="Confirm discarding draft"
                    >
                      <p>
                        Discard your saved draft and edits? This item returns to
                        Detected.
                      </p>
                      <div>
                        <button
                          type="button"
                          onClick={() => setConfirmDiscard(false)}
                        >
                          Keep draft
                        </button>
                        <button
                          type="button"
                          className="confirm-discard-button"
                          onClick={discard}
                        >
                          Discard draft
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="drawer-create-actions">
                    <button
                      type="button"
                      className="subtle-button"
                      onClick={close}
                    >
                      Cancel
                    </button>
                    {review?.batch && (
                      <button
                        type="button"
                        className="subtle-button"
                        onClick={() => {
                          flush();
                          onStep(1);
                        }}
                      >
                        Skip for now
                      </button>
                    )}
                    <button
                      className="cyan-button"
                      type="submit"
                      disabled={busy || confirmDiscard || !draft.title?.trim()}
                    >
                      {busy ? "Creating…" : "Create ticket"}
                    </button>
                  </div>
                </>
              )}
              {readOnly && (
                <div className="ticket-added-message">
                  <Icon name="check" size={16} />
                  Already added. A second ticket cannot be created.
                </div>
              )}
            </footer>
          </form>
        </>
      )}
    </aside>
  );
}
