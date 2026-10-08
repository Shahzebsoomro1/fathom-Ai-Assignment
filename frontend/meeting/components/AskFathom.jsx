import { useEffect, useRef, useState } from "react";
import { answerQuestion } from "../lib/answers.js";
import { speakerById } from "../lib/time.js";
import { Avatar } from "./Avatar.jsx";
import { Icon } from "./Icon.jsx";
import { Timestamp } from "./Timestamp.jsx";
const suggestions = [
  "What are the next steps?",
  "What did we decide?",
  "What are the risks?",
  "When is the beta review?",
];
export function AskFathom({ meeting, onSeek }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const end = useRef(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);
  const ask = (question) => {
    const text = question.trim();
    if (!text) return;
    const answer = answerQuestion(text, meeting);
    setMessages((previous) => [
      ...previous,
      { id: crypto.randomUUID(), role: "user", text },
      { id: crypto.randomUUID(), role: "assistant", ...answer },
    ]);
    setInput("");
  };
  return (
    <div className="ask-fathom-view">
      <div
        className="meeting-chat"
        aria-live="polite"
        aria-label="Meeting questions and answers"
      >
        {!messages.length && (
          <div className="ask-welcome">
            <div className="ask-orb">
              <Icon name="sparkles" size={27} />
            </div>
            <h3>A little more clarity.</h3>
            <p>
              Ask about decisions, owners, or something you missed.
              <br />
              Every answer links back to the conversation.
            </p>
            <div className="meeting-suggestions">
              {suggestions.map((question) => (
                <button key={question} onClick={() => ask(question)}>
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            <div className="chat-user" key={message.id}>
              <span className="chat-user-avatar">S</span>
              <p>{message.text}</p>
            </div>
          ) : (
            <article className="chat-answer" key={message.id}>
              <div className="chat-answer-heading">
                <Icon name="sparkles" size={19} /> FATHOM{" "}
                <span>This meeting</span>
              </div>
              <p>{message.intro}</p>
              {message.sources.length > 0 && (
                <ul>
                  {message.sources.map((source, index) => (
                    <li key={index}>
                      {source.speakerId && (
                        <span className="answer-speaker">
                          <Avatar
                            speaker={speakerById(meeting, source.speakerId)}
                            small
                          />
                          {speakerById(meeting, source.speakerId)?.name}
                        </span>
                      )}
                      <span>{source.text}</span>
                      <Timestamp time={source.time} onSeek={onSeek} />
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ),
        )}
        <div ref={end} />
      </div>
      <form
        className="meeting-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
      >
        <label className="sr-only" htmlFor="meeting-question">
          Ask about this meeting
        </label>
        <textarea
          id="meeting-question"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask(input);
            }
          }}
          placeholder="Ask anything about this meeting…"
          rows="2"
          maxLength={2000}
        />
        <div>
          <span>
            <Icon name="link" size={13} />
            Answers grounded in the transcript
          </span>
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send meeting question"
          >
            <Icon name="send" size={19} />
          </button>
        </div>
      </form>
    </div>
  );
}
