const paths = {
  play: "M7 4l13 8L7 20Z",
  pause: "M7 5v14M17 5v14",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  back: "M20 12H4m6-6-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l4 4L19 6",
  close: "m6 6 12 12M18 6 6 18",
  bookmark: "M6 3h12v18l-6-4-6 4Z",
  note: "M5 3h14v18H5ZM8 8h8M8 12h8M8 16h4",
  copy: "M9 9h11v12H9ZM4 15H2V2h11v3",
  link: "m10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 1-1a4 4 0 1 1 6 6l-4 4a4 4 0 0 1-6 0",
  sparkles: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM20 2v4m-2-2h4",
  send: "M12 20V4m-6 6 6-6 6 6",
  audio: "M4 9v6m4-10v14m4-16v18m4-16v14m4-10v6",
  volume: "M11 4 6 8H2v8h4l5 4Zm4 4a6 6 0 0 1 0 8m4-12a11 11 0 0 1 0 16",
  mute: "M11 4 6 8H2v8h4l5 4Zm5 5 6 6m0-6-6 6",
  video: "M2 5h13v14H2Zm13 5 7-4v12l-7-4",
  skipBack: "M5 9V3m0 6h6M5 9a9 9 0 1 1-1 8",
  skipForward: "M19 9V3m0 6h-6m6 0a9 9 0 1 0 1 8",
  jira: "m12 3 9 9-9 9-9-9Z",
  people:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m13-16a4 4 0 0 1 0 8m7 8v-3a4 4 0 0 0-3-3M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  clock: "M12 8v5l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  calendar: "M4 5h16v16H4ZM8 2v6m8-6v6M4 11h16",
  filter: "M3 5h18M7 12h10m-7 7h4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  chevron: "m6 9 6 6 6-6",
};
export function Icon({ name, size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "play" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "pause" ? 4 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.sparkles} />
    </svg>
  );
}
