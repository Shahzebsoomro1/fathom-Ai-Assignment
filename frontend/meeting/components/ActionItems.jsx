import { useEffect, useState } from "react";
import { Avatar } from "./Avatar.jsx";
import { Icon } from "./Icon.jsx";
import { Timestamp } from "./Timestamp.jsx";
import { canCreate, isEdited, resolveDueDate } from "../lib/jiraWorkflow.js";
const stages = {
  detected: "Detected",
  "draft-ready": "Draft ready",
  added: "Added",
  dismissed: "Dismissed",
};
export function ActionItems({
  meeting,
  actions,
  review,
  onStatusChange,
  onJira,
  onDismiss,
  onRestore,
  onResume,
  onSeek,
}) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  useEffect(() => {
    setSelected((ids) =>
      ids.filter((id) =>
        actions.some((action) => action.id === id && canCreate(action)),
      ),
    );
  }, [actions]);
  const counts = {
    all: actions.filter((action) => action.stage !== "dismissed").length,
    detected: actions.filter((action) => action.stage === "detected").length,
    "draft-ready": actions.filter((action) => action.stage === "draft-ready")
      .length,
    added: actions.filter((action) => action.ticket).length,
    done: actions.filter(
      (action) => action.stage !== "dismissed" && action.status === "done",
    ).length,
    dismissed: actions.filter((action) => action.stage === "dismissed").length,
  };
  const visible = actions.filter((action) =>
    filter === "all"
      ? action.stage !== "dismissed"
      : filter === "done"
        ? action.stage !== "dismissed" && action.status === "done"
        : action.stage === filter,
  );
  const eligible = visible.filter(canCreate);
  const allSelected =
    eligible.length > 0 &&
    eligible.every((action) => selected.includes(action.id));
  const complete = actions.filter(
    (action) => action.status === "done" && action.stage !== "dismissed",
  ).length;
  const selectAll = (checked) =>
    setSelected((ids) =>
      checked
        ? [...new Set([...ids, ...eligible.map((action) => action.id)])]
        : ids.filter((id) => !eligible.some((action) => action.id === id)),
    );
  return (
    <section
      className="sidebar-section action-items"
      aria-labelledby="actions-heading"
    >
      <div className="sidebar-section-heading">
        <h2 id="actions-heading">
          ACTION ITEMS <span>{actions.length}</span>
        </h2>
        <span>
          {complete}/{counts.all} done
        </span>
      </div>
      <div
        className="action-progress"
        role="progressbar"
        aria-label="Completed action items"
        aria-valuemin={0}
        aria-valuemax={counts.all}
        aria-valuenow={complete}
      >
        <span
          style={{
            width: `${counts.all ? (complete / counts.all) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="workflow-filters" aria-label="Action item filters">
        {[
          ["all", "All"],
          ["detected", "Detected"],
          ["draft-ready", "Drafts"],
          ["added", "Added"],
          ["done", "Done"],
          ["dismissed", "Dismissed"],
        ].map(([id, label]) => (
          <button
            key={id}
            data-action-filter={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
            <span>{counts[id]}</span>
          </button>
        ))}
      </div>
      {review?.batch &&
        !review.complete &&
        !review.open &&
        review.ids.some((id) =>
          actions.some((action) => action.id === id && canCreate(action)),
        ) && (
          <button className="resume-batch" onClick={onResume}>
            <Icon name="jira" size={14} />
            Resume review · {review.index + 1} of {review.ids.length}
          </button>
        )}
      {filter !== "dismissed" && (
        <div className="batch-selection">
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              disabled={!eligible.length}
              onChange={(event) => selectAll(event.target.checked)}
              aria-label="Select all eligible action items"
            />
            Select all
          </label>
          <span>{selected.length} selected</span>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              aria-label="Clear selection"
            >
              Clear
            </button>
          )}
        </div>
      )}
      {selected.length > 0 && filter !== "dismissed" && (
        <button
          className="batch-review-button"
          onClick={() => {
            onJira(selected, true);
            setSelected([]);
          }}
        >
          <Icon name="jira" size={14} />
          Review {selected.length} for Jira
        </button>
      )}
      <div className="action-items-list">
        {visible.map((action) => {
          const assignedBy = meeting.speakers.find(
            (s) => s.id === action.assignedById,
          );
          const detectedOwner = meeting.speakers.find(
            (s) => s.id === action.ownerId,
          );
          const ownerName =
            action.ticket?.assignee ??
            action.draft?.assignee ??
            detectedOwner?.name ??
            "";
          const owner = meeting.speakers.find((s) => s.name === ownerName) || {
            name: ownerName || "Unassigned",
            initials: ownerName
              ? ownerName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
              : "?",
            color: "#8b94a4",
          };
          const due =
            action.ticket?.dueDate ??
            action.draft?.dueDate ??
            resolveDueDate(action.duePhrase, meeting).date;
          return (
            <article
              key={action.id}
              data-action-id={action.id}
              data-stage={action.stage}
              className={`action-item workflow-action ${action.stage === "dismissed" ? "action-dismissed" : action.status === "done" ? "action-done" : ""}`}
            >
              <div className="action-title">
                {canCreate(action) ? (
                  <label className="action-select-box">
                    <input
                      type="checkbox"
                      checked={selected.includes(action.id)}
                      onChange={(event) =>
                        setSelected((ids) =>
                          event.target.checked
                            ? [...ids, action.id]
                            : ids.filter((id) => id !== action.id),
                        )
                      }
                      aria-label={`Select ${action.text} for Jira`}
                    />
                  </label>
                ) : (
                  <Icon name={action.ticket ? "jira" : "close"} size={15} />
                )}
                <p>{action.text}</p>
              </div>
              <div className="action-workflow-labels">
                <span className={`workflow-stage stage-${action.stage}`}>
                  {stages[action.stage]}
                </span>
                {isEdited(action) && (
                  <span className="draft-edited">edited</span>
                )}
              </div>
              <div className="action-owner">
                <Avatar speaker={owner} small />
                <span>{ownerName || "Unassigned"}</span>
                <Timestamp time={action.time} onSeek={onSeek} />
              </div>
              {!ownerName &&
                action.ownerSuggestion &&
                !action.draft?.editedFields?.assignee && (
                  <p className="owner-suggestion">
                    Suggested: {action.ownerSuggestion} · choose a person
                  </p>
                )}
              <div className="action-assigned-by">
                Assigned by {assignedBy?.name || "Unknown speaker"}
              </div>
              <div className="action-meta">
                <span className="action-due">
                  <Icon name="calendar" size={12} />
                  {due || action.duePhrase || "No due date"}
                </span>
                {action.stage !== "dismissed" && (
                  <select
                    className={`status-select status-${action.status}`}
                    value={action.status}
                    onChange={(event) =>
                      onStatusChange(action.id, event.target.value)
                    }
                    aria-label={`Work status for ${action.text}`}
                  >
                    <option value="todo">To do</option>
                    <option value="in-progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                )}
              </div>
              <div className="action-jira-controls">
                {action.ticket ? (
                  <button
                    className="jira-link has-jira"
                    onClick={() => onJira([action.id], false, true)}
                  >
                    <Icon name="jira" size={14} />
                    {action.ticket.key}
                    <Icon name="link" size={12} />
                  </button>
                ) : action.stage === "dismissed" ? (
                  <button
                    className="restore-action"
                    onClick={() => onRestore(action.id)}
                  >
                    Restore
                  </button>
                ) : (
                  <>
                    <button
                      className="jira-link"
                      onClick={() => onJira([action.id], false)}
                    >
                      <Icon name="jira" size={14} />
                      {action.draft ? "Review draft" : "Add to Jira"}
                      <Icon name="plus" size={12} />
                    </button>
                    <button
                      className="dismiss-action"
                      onClick={() => onDismiss(action.id)}
                      aria-label={`Dismiss ${action.text}`}
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {!visible.length && (
          <p className="workflow-empty">
            {filter === "dismissed"
              ? "No dismissed items."
              : "No items in this filter."}
          </p>
        )}
      </div>
    </section>
  );
}
