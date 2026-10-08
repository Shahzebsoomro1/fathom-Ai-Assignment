import { useState } from "react";
import { activeSegment, formatTime, speakerById } from "../lib/time.js";
import { Avatar } from "./Avatar.jsx";
import { Icon } from "./Icon.jsx";

export function MeetingPlayer({ meeting, playback, onAddNote }) {
  const [mode, setMode] = useState("video");
  const [muted, setMuted] = useState(false);
  const { currentTime, isPlaying, speed, seek, toggle, setSpeed } = playback;
  const segment = activeSegment(meeting.transcript, currentTime);
  const speaker = speakerById(meeting, segment?.speakerId);
  const progress = (currentTime / meeting.duration) * 100;
  return (
    <section
      className="meeting-player"
      aria-label="Meeting playback simulation"
    >
      <div className="player-mode-bar">
        <div className="mode-switch" aria-label="Playback mode">
          <button
            className={mode === "video" ? "selected" : ""}
            onClick={() => setMode("video")}
            aria-pressed={mode === "video"}
          >
            <Icon name="video" size={15} />
            Video
          </button>
          <button
            className={mode === "audio" ? "selected" : ""}
            onClick={() => setMode("audio")}
            aria-pressed={mode === "audio"}
          >
            <Icon name="audio" size={15} />
            Audio
          </button>
        </div>
        <span className="recording-badge">Demo recording</span>
      </div>
      <div
        className={`player-screen ${mode === "audio" ? "audio-screen" : ""}`}
      >
        {mode === "video" ? (
          <>
            <div
              className="participant-photo"
              role="img"
              aria-label="Meeting participant in the sample recording"
            />
            <div className="player-mini-participant">
              <Avatar speaker={meeting.speakers[1]} />
              <span>{meeting.speakers[1].name}</span>
            </div>
          </>
        ) : (
          <div
            className={`waveform ${isPlaying ? "is-playing" : ""}`}
            aria-label="Audio playback visualization"
          >
            {Array.from({ length: 44 }, (_, index) => (
              <span
                key={index}
                style={{
                  "--bar-height": `${12 + ((index * 17 + 11) % 64)}px`,
                  "--bar-delay": `${index * -0.055}s`,
                }}
              />
            ))}
          </div>
        )}
        <div className="player-vignette" />
        <button
          className="center-play"
          onClick={toggle}
          aria-label={isPlaying ? "Pause recording" : "Play recording"}
        >
          <Icon name={isPlaying ? "pause" : "play"} size={25} />
        </button>
        <div className="speaker-overlay">
          <Avatar speaker={speaker} small />
          <span>
            {speaker?.name}
            <small>{speaker?.handle}</small>
          </span>
        </div>
        <div className="recording-watermark">
          <img src="/assets/logo.svg" alt="Fathom" />
        </div>
      </div>
      <div className="playback-controls">
        <input
          type="range"
          className="progress-range"
          min="0"
          max={meeting.duration}
          step="0.1"
          value={currentTime}
          onChange={(event) => seek(event.target.value)}
          aria-label="Playback position"
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(meeting.duration)}`}
          style={{ "--progress": `${progress}%` }}
        />
        <div className="playback-controls-row">
          <div className="transport-controls">
            <button
              onClick={toggle}
              aria-label={isPlaying ? "Pause playback" : "Play playback"}
              data-testid="play-toggle"
            >
              <Icon name={isPlaying ? "pause" : "play"} size={18} />
            </button>
            <button
              onClick={() => seek(currentTime - 10)}
              aria-label="Back 10 seconds"
            >
              <Icon name="skipBack" size={18} />
            </button>
            <button
              onClick={() => seek(currentTime + 10)}
              aria-label="Forward 10 seconds"
            >
              <Icon name="skipForward" size={18} />
            </button>
            <span className="playback-time">
              <strong data-testid="current-time">
                {formatTime(currentTime)}
              </strong>
              <span>/</span>
              {formatTime(meeting.duration)}
            </span>
          </div>
          <div className="secondary-controls">
            <label className="speed-select">
              <span className="sr-only">Playback speed</span>
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                aria-label="Playback speed"
              >
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}x
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? "Unmute preview" : "Mute preview"}
              aria-pressed={muted}
            >
              <Icon name={muted ? "mute" : "volume"} size={18} />
            </button>
            <button
              className="player-note-button"
              onClick={() => onAddNote(currentTime)}
            >
              <Icon name="bookmark" size={15} />
              <span>Add note</span>
            </button>
          </div>
        </div>
      </div>
      <div className="chapter-bar">
        <span className="chapter-label">Chapters</span>
        {meeting.chapters.map((chapter) => (
          <button
            key={chapter.time}
            onClick={() => seek(chapter.time)}
            className={
              currentTime >= chapter.time &&
              currentTime <
                (meeting.chapters[meeting.chapters.indexOf(chapter) + 1]
                  ?.time ?? meeting.duration)
                ? "active-chapter"
                : ""
            }
          >
            {chapter.title}
          </button>
        ))}
      </div>
    </section>
  );
}
