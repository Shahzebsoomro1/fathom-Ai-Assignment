import { useRef } from "react";
import { Icon } from "./Icon.jsx";
const tabs = [
  { id: "summary", title: "SUMMARY", icon: "note" },
  { id: "transcript", title: "TRANSCRIPT", icon: "audio" },
  { id: "ask", title: "ASK FATHOM", icon: "sparkles" },
];
export function MeetingTabs({ value, onChange, transcriptCount }) {
  const refs = useRef([]);
  const keyDown = (event, index) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      onChange(tabs[next].id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div className="meeting-tabs" role="tablist" aria-label="Meeting content">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            refs.current[index] = element;
          }}
          role="tab"
          id={`${tab.id}-tab`}
          aria-selected={value === tab.id}
          aria-controls={`${tab.id}-panel`}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => keyDown(event, index)}
        >
          <Icon name={tab.icon} size={16} />
          {tab.title}
          {tab.id === "transcript" && <span>{transcriptCount}</span>}
        </button>
      ))}
    </div>
  );
}
