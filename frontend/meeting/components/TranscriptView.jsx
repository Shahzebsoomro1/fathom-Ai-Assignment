import { useEffect, useMemo, useRef, useState } from "react";
import { activeSegment, speakerById } from "../lib/time.js";
import { Avatar } from "./Avatar.jsx";
import { Icon } from "./Icon.jsx";
import { Timestamp } from "./Timestamp.jsx";
function MarkedText({ text, query }) {
  if (!query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .split(new RegExp(`(${escaped})`, "gi"))
    .map((part, index) =>
      part.toLowerCase() === query.trim().toLowerCase() ? (
        <mark key={index}>{part}</mark>
      ) : (
        part
      ),
    );
}
export function TranscriptView({
  meeting,
  playback,
  query,
  onQueryChange,
  onAddNote,
  visible,
  focusSource,
}) {
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [follow, setFollow] = useState(true);
  const activeId = activeSegment(meeting.transcript, playback.currentTime)?.id;
  const activeRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => {
    if (focusSource) {
      setSpeakerFilter("all");
      setFollow(true);
    }
  }, [focusSource]);
  const filtered = useMemo(
    () =>
      meeting.transcript.filter((row) => {
        const speaker = speakerById(meeting, row.speakerId);
        return (
          (speakerFilter === "all" || row.speakerId === speakerFilter) &&
          `${row.text} ${speaker.name} ${speaker.handle}`
            .toLowerCase()
            .includes(query.toLowerCase().trim())
        );
      }),
    [meeting, speakerFilter, query],
  );
  useEffect(() => {
    if (!visible || !follow || query || !activeRef.current || !listRef.current)
      return;
    const list = listRef.current;
    const listBounds = list.getBoundingClientRect();
    const rowBounds = activeRef.current.getBoundingClientRect();
    if (rowBounds.top < listBounds.top || rowBounds.bottom > listBounds.bottom)
      list.scrollTo({
        top: list.scrollTop + rowBounds.top - listBounds.top - 10,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [activeId, follow, query, visible, speakerFilter, focusSource]);
  return (
    <div className="transcript-view">
      <div className="transcript-toolbar">
        <label className="transcript-search">
          <Icon name="search" size={17} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search transcript"
            aria-label="Search transcript"
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              aria-label="Clear transcript search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </label>
        <label className="speaker-select">
          <Icon name="filter" size={15} />
          <select
            value={speakerFilter}
            onChange={(event) => setSpeakerFilter(event.target.value)}
            aria-label="Filter transcript by speaker"
          >
            <option value="all">All speakers</option>
            {meeting.speakers.map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="transcript-subbar">
        <span>
          {filtered.length} {filtered.length === 1 ? "segment" : "segments"} ·{" "}
          {meeting.speakers.length} speakers
        </span>
        <button
          className={follow ? "follow-active" : ""}
          onClick={() => setFollow((value) => !value)}
          aria-pressed={follow}
        >
          {follow && <Icon name="check" size={13} />}Follow playback
        </button>
      </div>
      <div
        ref={listRef}
        className="transcript-list"
        aria-label="Timestamped transcript"
      >
        {filtered.map((row) => {
          const speaker = speakerById(meeting, row.speakerId);
          const active = row.id === activeId;
          return (
            <article
              className={`transcript-row${active ? " active-segment" : ""}`}
              key={row.id}
              ref={active ? activeRef : null}
              data-segment-id={row.id}
              aria-current={active ? "true" : undefined}
            >
              <Avatar speaker={speaker} />
              <div className="transcript-row-content">
                <div className="transcript-row-header">
                  <strong>{speaker.name}</strong>
                  <span className="speaker-handle">{speaker.handle}</span>
                  <Timestamp time={row.start} onSeek={playback.seek} />
                  <button
                    className="row-note-button"
                    onClick={() => onAddNote(row.start)}
                    aria-label={`Add note for ${speaker.name}'s transcript segment`}
                  >
                    <Icon name="plus" size={15} />
                  </button>
                </div>
                <p>
                  <MarkedText text={row.text} query={query} />
                </p>
              </div>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="content-empty">
            <Icon name="search" size={28} />
            <h3>No matching transcript segments</h3>
            <p>Try another phrase or show all speakers.</p>
            <button
              className="subtle-button"
              onClick={() => {
                onQueryChange("");
                setSpeakerFilter("all");
              }}
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
