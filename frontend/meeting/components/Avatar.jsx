export function Avatar({ speaker, small = false }) {
  return (
    <span
      className={`avatar${small ? " avatar-small" : ""}`}
      style={{ "--avatar-color": speaker?.color || "#778899" }}
      title={speaker?.name}
      aria-label={speaker?.name}
    >
      {speaker?.initials || "SS"}
    </span>
  );
}
