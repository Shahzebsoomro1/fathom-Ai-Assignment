const stopWords = new Set(
  "a an and are as at be by can did do does for from had has have how i in is it me my of on our please tell that the their there these they this to us was we were what when where which who why will with would you your about meeting call said".split(
    " ",
  ),
);

// Deterministic local answers. Every returned fact cites the supplied transcript.
export function answerQuestion(question, meeting) {
  const query = question.toLowerCase();
  if (
    /\b(participants?|speakers?)\b|who (joined|attended|was there)/.test(query)
  ) {
    return {
      intro: `${meeting.speakers.length} people spoke in this meeting:`,
      sources: meeting.speakers.map((speaker) => ({
        text: `${speaker.name} (${speaker.handle}) — ${speaker.role}.`,
        time:
          meeting.transcript.find((row) => row.speakerId === speaker.id)
            ?.start || 0,
        speakerId: speaker.id,
      })),
    };
  }
  if (/how long|\b(duration|length)\b/.test(query)) {
    const minutes = Math.floor(meeting.duration / 60);
    const seconds = meeting.duration % 60;
    return {
      intro: `This recording is ${minutes} minute${minutes === 1 ? "" : "s"}${seconds ? ` and ${seconds} seconds` : ""} long.`,
      sources: [
        {
          text: "The final segment marks the end of the recorded conversation.",
          time: meeting.transcript.at(-1).start,
        },
      ],
    };
  }
  if (
    /\b(action|tasks?|next steps|follow.?up|owners?|to.?do|commitments?)\b/.test(
      query,
    )
  ) {
    return {
      intro: "Here are the follow-ups recorded in this meeting:",
      sources: meeting.actionItems.map((item) => ({
        text: `${item.text} — ${meeting.speakers.find((s) => s.id === item.ownerId)?.name || "Unassigned"}. ${item.duePhrase ? `Due wording: “${item.duePhrase}”.` : "No due date mentioned."}`,
        time: item.time,
      })),
    };
  }
  if (/\b(decisions?|decide[ds]?|agreed|approve[ds]?)\b/.test(query))
    return {
      intro: "The team agreed on these decisions:",
      sources: meeting.summary.decisions,
    };
  if (/\b(risks?|blockers?|concerns?|delays?)\b/.test(query))
    return {
      intro: "These risks and dependencies were discussed:",
      sources: meeting.summary.risks,
    };
  if (
    /\b(summary|summarize|recap|overview|takeaways|topics?|purpose)\b|what (was|is).*(about|discussed)/.test(
      query,
    )
  )
    return {
      intro: meeting.summary.overview,
      sources: meeting.summary.highlights,
    };
  const terms = [
    ...new Set(
      query
        .replace(/[^a-z0-9@\s-]/g, " ")
        .split(/\s+/)
        .filter((term) => term.length > 2 && !stopWords.has(term)),
    ),
  ];
  const ranked = meeting.transcript
    .map((row) => {
      const speaker = meeting.speakers.find((s) => s.id === row.speakerId);
      const text =
        `${speaker?.name} ${speaker?.handle} ${row.text}`.toLowerCase();
      return {
        row,
        score: terms.reduce(
          (score, term) => score + (text.includes(term) ? 1 : 0),
          0,
        ),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.row.start - b.row.start);
  if (!ranked.length)
    return {
      intro:
        "I couldn’t find that in this meeting’s transcript. Try asking about the pilot deadline, Jira, decisions, or who owns the next steps.",
      sources: [],
    };
  return {
    intro: "These parts of the conversation answer your question:",
    sources: ranked.slice(0, 3).map(({ row }) => ({
      text: row.text,
      time: row.start,
      speakerId: row.speakerId,
    })),
  };
}
