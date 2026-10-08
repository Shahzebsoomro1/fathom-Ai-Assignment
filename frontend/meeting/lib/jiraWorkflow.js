import { formatTime } from "./time.js";

export const DRAFT_FIELDS = [
  "title",
  "description",
  "assignee",
  "priority",
  "dueDate",
];
export const PRIORITIES = ["Highest", "High", "Medium", "Low", "Lowest"];
export const canCreate = (action) =>
  !action.ticket && action.stage !== "dismissed";
export const isEdited = (action) =>
  Boolean(action.draft && Object.keys(action.draft.editedFields || {}).length);

export function calendarDate(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const value = (name) => parts.find((part) => part.type === name).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function resolveDueDate(phrase, meeting, referenceInstant = new Date()) {
  const original = (phrase || "").trim();
  const text = original.toLowerCase().replace(/\.$/, "");
  const zone = meeting.timeZone || "Asia/Karachi";
  const base = calendarDate(meeting.date, zone);
  const today = calendarDate(referenceInstant, zone);
  const baseDay = new Date(`${base}T12:00:00Z`);
  const asDate = (date) => date.toISOString().slice(0, 10);
  const result = (date) =>
    date < base || date < today
      ? {
          date: "",
          original,
          suggested: false,
          reason:
            "This phrase resolves to a past date. Choose a date manually.",
        }
      : {
          date,
          original,
          suggested: true,
          reason: "Resolved from the meeting date and timezone.",
        };
  if (!text)
    return {
      date: "",
      original,
      suggested: false,
      reason: "No due date was mentioned.",
    };
  if (/\b(next week|soon|after launch|later|eventually|sometime)\b/.test(text))
    return {
      date: "",
      original,
      suggested: false,
      reason: "No specific date was mentioned. Choose a date if needed.",
    };
  if (/^(?:by )?(?:today|end of (?:the )?day|eod)$/.test(text))
    return result(base);
  if (/^(?:by )?tomorrow$/.test(text)) {
    baseDay.setUTCDate(baseDay.getUTCDate() + 1);
    return result(asDate(baseDay));
  }
  const weekday = text.match(
    /^(?:by |this |on )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  );
  if (weekday) {
    const target = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ].indexOf(weekday[1]);
    const offset = (target - baseDay.getUTCDay() + 7) % 7;
    if (!offset)
      return {
        date: "",
        original,
        suggested: false,
        reason:
          "The weekday is also the meeting day, so the intended date is ambiguous.",
      };
    baseDay.setUTCDate(baseDay.getUTCDate() + offset);
    return result(asDate(baseDay));
  }
  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const namedDate = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/,
  );
  if (namedDate) {
    const year = Number(namedDate[3] || base.slice(0, 4));
    const month = monthNames.indexOf(namedDate[1].slice(0, 3));
    const day = Number(namedDate[2]);
    const date = new Date(Date.UTC(year, month, day, 12));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month &&
      date.getUTCDate() === day
    )
      return result(asDate(date));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T12:00:00Z`);
    if (!Number.isNaN(date.getTime()) && asDate(date) === text)
      return result(text);
  }
  return {
    date: "",
    original,
    suggested: false,
    reason: "The date phrase is ambiguous. Choose a date manually.",
  };
}

export function transcriptSource(action, meeting) {
  const segment =
    meeting.transcript.find(
      (row) => action.time >= row.start && action.time < row.end,
    ) || meeting.transcript.at(-1);
  const assignedBy = meeting.speakers.find(
    (speaker) => speaker.id === (action.assignedById || action.speakerId),
  );
  return {
    quote: segment.text,
    time: action.time,
    assignedBy: assignedBy?.name || "Unknown speaker",
    href: `${globalThis.location?.origin || "http://127.0.0.1:4173"}/meetings/${meeting.id}?t=${action.time}`,
  };
}
export function sourceBlock(action, meeting) {
  const source = transcriptSource(action, meeting);
  return `Transcript quote: "${source.quote}"\nAssigned by: ${source.assignedBy}\nMoment: ${formatTime(source.time)}\nTimestamp link: ${source.href}\nOriginal due-date wording: ${action.duePhrase || "Not mentioned"}`;
}
export function generateAIDraft(action, meeting) {
  const owner = meeting.speakers.find(
    (speaker) => speaker.id === action.ownerId,
  );
  const due = resolveDueDate(action.duePhrase, meeting);
  return {
    title: action.text,
    description: `${action.text}\n\n${sourceBlock(action, meeting)}`,
    assignee: owner?.name || "",
    priority: PRIORITIES.includes(action.priority) ? action.priority : "Medium",
    dueDate: due.date,
    suggested: {
      assignee: Boolean(owner && action.ownerSuggested),
      priority: action.prioritySuggested !== false,
      dueDate: due.suggested,
    },
    dueReason: due.reason,
  };
}
export function ensureSourceDescription(description, action, meeting) {
  const source = transcriptSource(action, meeting);
  const wording = action.duePhrase || "Not mentioned";
  if (
    description.includes(source.quote) &&
    description.includes(source.href) &&
    description.includes(`Original due-date wording: ${wording}`)
  )
    return description;
  return `${description.trim()}\n\n--- Original meeting evidence ---\n${sourceBlock(action, meeting)}`;
}
export function normalizeAction(item, saved, meeting) {
  const ticket =
    saved?.ticket?.key && /^FAT-\d+$/.test(saved.ticket.key)
      ? saved.ticket
      : item.jira?.key && !item.jira.draft
        ? {
            ...item.jira,
            createdAt: meeting.date,
            assignee:
              meeting.speakers.find((speaker) => speaker.id === item.ownerId)
                ?.name || "",
            seeded: true,
          }
        : null;
  const aiDraft =
    saved?.aiDraft?.title && typeof saved.aiDraft.description === "string"
      ? saved.aiDraft
      : null;
  let draft =
    saved?.draft && aiDraft
      ? { ...saved.draft, editedFields: saved.draft.editedFields || {} }
      : null;
  if (!draft && saved?.jira?.draft && !ticket) {
    const original = generateAIDraft(item, meeting);
    draft = {
      ...original,
      title: saved.jira.title || original.title,
      description: saved.jira.description || original.description,
      editedFields: { title: true, description: true },
    };
  }
  return {
    ...item,
    ownerId: item.ownerId ?? null,
    assignedById: item.assignedById || item.speakerId,
    status: ["todo", "in-progress", "done"].includes(saved?.status)
      ? saved.status
      : item.status,
    stage: ticket
      ? "added"
      : saved?.stage === "dismissed"
        ? "dismissed"
        : draft
          ? "draft-ready"
          : "detected",
    ticket,
    aiDraft: ticket
      ? null
      : aiDraft || (draft ? generateAIDraft(item, meeting) : null),
    draft: ticket ? null : draft,
  };
}
export function nextTicketKey(actions) {
  return `FAT-${actions.reduce((value, action) => Math.max(value, Number(action.ticket?.key?.match(/^FAT-(\d+)$/)?.[1] || 141)), 141) + 1}`;
}
