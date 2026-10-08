export function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function momentLabel(seconds) {
  return seconds < 60
    ? `${Math.floor(seconds)}s`
    : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}
export function activeSegment(transcript, time) {
  return (
    transcript.find((row) => time >= row.start && time < row.end) ||
    transcript.at(-1)
  );
}
export const speakerById = (meeting, id) =>
  meeting.speakers.find((speaker) => speaker.id === id);
