import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.jsx";
import { Timestamp } from "./Timestamp.jsx";
import { formatTime, momentLabel, speakerById } from "../lib/time.js";
import { Avatar } from "./Avatar.jsx";
export function Annotations({
  meeting,
  notes,
  playback,
  draftTime,
  onDraftTime,
  onAdd,
  onDelete,
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState("note");
  const textarea = useRef(null);
  useEffect(() => {
    if (draftTime !== null) {
      textarea.current?.focus({ preventScroll: true });
      textarea.current?.scrollIntoView({ block: "nearest" });
    }
  }, [draftTime]);
  const cancel = () => {
    onDraftTime(null);
    setText("");
    setType("note");
  };
  const save = (event) => {
    event.preventDefault();
    if (!text.trim() || draftTime === null) return;
    onAdd({
      id: crypto.randomUUID(),
      time: draftTime,
      text: text.trim(),
      type,
      speakerId: "self",
    });
    cancel();
  };
  return (
    <section
      className="sidebar-section annotations"
      aria-labelledby="notes-heading"
    >
      <div className="sidebar-section-heading">
        <h2 id="notes-heading">
          ANNOTATIONS <span>{notes.length}</span>
        </h2>
        <button
          onClick={() => onDraftTime(playback.currentTime)}
          aria-label="Add annotation"
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
      {draftTime !== null && (
        <form className="note-form" onSubmit={save}>
          <div>
            <label>
              <span className="sr-only">Annotation type</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                aria-label="Annotation type"
              >
                <option value="note">Note</option>
                <option value="decision">Decision</option>
                <option value="risk">Risk</option>
              </select>
            </label>
            <span>at {formatTime(draftTime)}</span>
          </div>
          <label className="sr-only" htmlFor="note-text">
            Note text
          </label>
          <textarea
            id="note-text"
            ref={textarea}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What matters about this moment?"
            rows="3"
            maxLength={2000}
          />
          <div className="note-form-actions">
            <button type="button" onClick={cancel}>
              Cancel
            </button>
            <button
              type="submit"
              className="cyan-button"
              disabled={!text.trim()}
            >
              Save note
            </button>
          </div>
        </form>
      )}
      <div className="notes-list">
        {notes.map((note) => {
          const speaker = speakerById(meeting, note.speakerId);
          const active = Math.abs(playback.currentTime - note.time) < 4;
          return (
            <article
              className={`annotation annotation-${note.type}${active ? " active-annotation" : ""}`}
              key={note.id}
              data-note-id={note.id}
            >
              <div className="annotation-heading">
                <span className="annotation-kind">
                  <Icon
                    name={note.type === "note" ? "note" : "bookmark"}
                    size={14}
                  />
                  {note.type} <span>·</span>{" "}
                  <Timestamp time={note.time} onSeek={playback.seek}>
                    {momentLabel(note.time)}
                  </Timestamp>
                </span>
                <button
                  className="annotation-delete"
                  onClick={() => onDelete(note.id)}
                  aria-label={`Delete ${note.type} at ${formatTime(note.time)}`}
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
              <p>{note.text}</p>
              <div className="annotation-author">
                <Avatar speaker={speaker} small />
                {speaker?.name || "You"}
              </div>
            </article>
          );
        })}
        {!notes.length && (
          <p className="notes-empty">
            Add a note to keep an important moment close.
          </p>
        )}
      </div>
    </section>
  );
}
