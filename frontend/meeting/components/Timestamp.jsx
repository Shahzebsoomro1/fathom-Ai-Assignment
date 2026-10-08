import { formatTime } from "../lib/time.js";
export function Timestamp({ time, onSeek, children, className = "" }) {
  return (
    <button
      className={`timestamp ${className}`}
      onClick={() => onSeek(time)}
      aria-label={`Jump to ${formatTime(time)}`}
      data-time={time}
    >
      {children || formatTime(time)}
    </button>
  );
}
