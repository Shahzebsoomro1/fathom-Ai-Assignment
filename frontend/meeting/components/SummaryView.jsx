import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { Timestamp } from "./Timestamp.jsx";
export function SummaryView({ meeting, onSeek, onToast }) {
  const [template, setTemplate] = useState("general");
  const extra = meeting.summary.templates[template];
  const copySummary = async () => {
    const sections = extra
      ? extra.map((section) => `${section.title}\n${section.text}`).join("\n\n")
      : `Key takeaways\n${meeting.summary.highlights.map((item) => `• ${item.text}`).join("\n")}\n\nDecisions\n${meeting.summary.decisions.map((item) => `• ${item.text}`).join("\n")}`;
    const text = `${meeting.title}\n\n${meeting.summary.overview}\n\n${sections}\n\nOpen questions & risks\n${meeting.summary.risks.map((item) => `• ${item.text}`).join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      onToast("Summary copied");
    } catch {
      onToast(
        "Copy is unavailable in this browser. You can select and copy the summary text.",
      );
    }
  };
  return (
    <div className="summary-view">
      <div className="summary-toolbar">
        <label>
          <Icon name="sparkles" size={17} />
          <select
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            aria-label="Summary template"
          >
            <option value="general">General summary</option>
            <option value="sales">Sales discovery</option>
            <option value="engineering">Engineering hand-off</option>
          </select>
        </label>
        <button className="subtle-button" onClick={copySummary}>
          <Icon name="copy" size={15} />
          Copy summary
        </button>
      </div>
      <p className="summary-overview">{meeting.summary.overview}</p>
      {extra ? (
        extra.map((section) => (
          <section className="summary-section" key={section.title}>
            <h3>{section.title}</h3>
            <p>
              {section.text} <Timestamp time={section.time} onSeek={onSeek} />
            </p>
          </section>
        ))
      ) : (
        <>
          <section className="summary-section">
            <h3>Key takeaways</h3>
            <ul>
              {meeting.summary.highlights.map((item) => (
                <li key={item.time}>
                  {item.text}
                  <Timestamp time={item.time} onSeek={onSeek} />
                </li>
              ))}
            </ul>
          </section>
          <section className="summary-section">
            <h3>Decisions</h3>
            <ul>
              {meeting.summary.decisions.map((item) => (
                <li key={item.time}>
                  {item.text}
                  <Timestamp time={item.time} onSeek={onSeek} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <section className="summary-section">
        <h3>Open questions & risks</h3>
        {meeting.summary.risks.map((item) => (
          <p key={item.time}>
            {item.text} <Timestamp time={item.time} onSeek={onSeek} />
          </p>
        ))}
      </section>
      <div className="summary-footer">
        <Icon name="sparkles" size={15} />
        Summary and citations come from this meeting’s transcript.
      </div>
    </div>
  );
}
