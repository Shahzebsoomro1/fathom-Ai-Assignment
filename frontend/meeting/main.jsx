import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import meetings from "./data/meetings.json";
import { MeetingWorkspace } from "./MeetingWorkspace.jsx";
import "./styles/meeting.css";
import "./styles/jira.css";

function selectedId() {
  return location.pathname.split("/").filter(Boolean)[1] || "discovery";
}
function App() {
  const [id, setId] = useState(selectedId);
  useEffect(() => {
    const onPop = () => setId(selectedId());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const meeting = meetings.find((item) => item.id === id);
  if (!meeting)
    return (
      <div className="missing-meeting">
        <img src="/assets/logo.svg" alt="Fathom" />
        <h1>Meeting not found</h1>
        <p>This meeting isn’t in your local workspace.</p>
        <a className="cyan-button" href="/dashboard">
          Back to My Calls
        </a>
      </div>
    );
  const changeMeeting = (nextId) => {
    history.pushState({}, "", `/meetings/${nextId}`);
    setId(nextId);
    window.scrollTo(0, 0);
  };
  return (
    <MeetingWorkspace
      key={meeting.id}
      meeting={meeting}
      meetings={meetings}
      onMeetingChange={changeMeeting}
    />
  );
}
createRoot(document.querySelector("#meeting-root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
