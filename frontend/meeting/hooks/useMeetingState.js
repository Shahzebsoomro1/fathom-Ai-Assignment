import { useEffect, useRef, useState } from "react";
import {
  canCreate,
  ensureSourceDescription,
  generateAIDraft,
  nextTicketKey,
  normalizeAction,
} from "../lib/jiraWorkflow.js";
function restore(meeting) {
  let saved;
  try {
    saved = JSON.parse(
      localStorage.getItem(`fathom.meeting.${meeting.id}`) || "null",
    );
  } catch {
    saved = null;
  }
  const actions = meeting.actionItems.map((item) =>
    normalizeAction(
      item,
      saved?.actions?.find((action) => action.id === item.id),
      meeting,
    ),
  );
  const notes = Array.isArray(saved?.notes)
    ? saved.notes
        .filter(
          (note) =>
            typeof note.id === "string" &&
            typeof note.text === "string" &&
            note.text.trim() &&
            note.text.length <= 2000 &&
            Number.isFinite(note.time) &&
            note.time >= 0 &&
            note.time <= meeting.duration,
        )
        .map((note) => ({
          ...note,
          type: ["note", "decision", "risk"].includes(note.type)
            ? note.type
            : "note",
        }))
    : meeting.annotations;
  const review =
    saved?.review && Array.isArray(saved.review.ids)
      ? {
          ...saved.review,
          ids: saved.review.ids.filter((id) =>
            actions.some((action) => action.id === id),
          ),
          index: Math.max(0, saved.review.index || 0),
          open: Boolean(saved.review.open),
        }
      : null;
  return { version: 2, actions, notes, review };
}
export function useMeetingState(meeting) {
  const [state, setState] = useState(() => restore(meeting));
  const stateRef = useRef(state);
  const mutate = (update) => {
    const next = update(stateRef.current);
    stateRef.current = next;
    try {
      localStorage.setItem(
        `fathom.meeting.${meeting.id}`,
        JSON.stringify(next),
      );
    } catch {
      /* Continue in memory. */
    }
    setState(next);
    return next;
  };
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === `fathom.meeting.${meeting.id}` && event.newValue) {
        const next = restore(meeting);
        stateRef.current = next;
        setState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [meeting]);
  const patch = (id, change) =>
    mutate((previous) => ({
      ...previous,
      actions: previous.actions.map((action) =>
        action.id === id ? change(action) : action,
      ),
    }));
  function prepare(action) {
    if (action.ticket || action.stage === "dismissed" || action.draft)
      return action;
    const aiDraft = action.aiDraft || generateAIDraft(action, meeting);
    return {
      ...action,
      aiDraft,
      draft: { ...aiDraft, editedFields: {} },
      stage: "draft-ready",
    };
  }
  return {
    ...state,
    setActionStatus: (id, status) =>
      patch(id, (action) => ({ ...action, status })),
    dismiss: (id) =>
      patch(id, (action) =>
        action.ticket ? action : { ...action, stage: "dismissed" },
      ),
    restoreAction: (id) =>
      patch(id, (action) => ({
        ...action,
        stage: action.ticket
          ? "added"
          : action.draft
            ? "draft-ready"
            : "detected",
      })),
    saveDraft: (id, draft) =>
      patch(id, (action) =>
        canCreate(action) ? { ...action, draft, stage: "draft-ready" } : action,
      ),
    resetDraft: (id) =>
      patch(id, (action) =>
        canCreate(action) && action.aiDraft
          ? {
              ...action,
              draft: { ...action.aiDraft, editedFields: {} },
              stage: "draft-ready",
            }
          : action,
      ),
    discardDraft: (id) =>
      patch(id, (action) =>
        action.ticket
          ? action
          : {
              ...action,
              draft: null,
              stage: action.stage === "dismissed" ? "dismissed" : "detected",
            },
      ),
    openReview: (ids, batch = false) =>
      mutate((previous) => {
        const eligible = [...new Set(ids)].filter((id) =>
          previous.actions.some(
            (action) => action.id === id && canCreate(action),
          ),
        );
        if (!eligible.length) return previous;
        return {
          ...previous,
          actions: previous.actions.map((action) =>
            eligible.includes(action.id) ? prepare(action) : action,
          ),
          review: { ids: eligible, index: 0, open: true, batch },
        };
      }),
    closeReview: () =>
      mutate((previous) => ({
        ...previous,
        review: previous.review ? { ...previous.review, open: false } : null,
      })),
    resumeReview: () =>
      mutate((previous) => ({
        ...previous,
        actions: previous.actions.map((action) =>
          action.id === previous.review?.ids[previous.review.index]
            ? prepare(action)
            : action,
        ),
        review: previous.review ? { ...previous.review, open: true } : null,
      })),
    moveReview: (direction) =>
      mutate((previous) => {
        if (!previous.review) return previous;
        const index = previous.review.index + direction;
        return {
          ...previous,
          review: {
            ...previous.review,
            index: Math.min(Math.max(index, 0), previous.review.ids.length - 1),
            open: index >= 0 && index < previous.review.ids.length,
            complete: index >= previous.review.ids.length,
          },
        };
      }),
    createTicket: (id, draft) => {
      let created = null;
      mutate((current) => {
        let previous = current;
        try {
          if (localStorage.getItem(`fathom.meeting.${meeting.id}`))
            previous = restore(meeting);
        } catch {
          /* Use in-memory state. */
        }
        const action = previous.actions.find((item) => item.id === id);
        if (!action || !canCreate(action) || !draft.title.trim())
          return previous;
        let key = nextTicketKey(previous.actions);
        try {
          const sequence =
            Math.max(
              143,
              Number(localStorage.getItem("fathom.jira.sequence") || 143),
              Number(key.split("-")[1]) - 1,
            ) + 1;
          key = `FAT-${sequence}`;
          localStorage.setItem("fathom.jira.sequence", String(sequence));
        } catch {
          /* The per-meeting sequence remains available in memory. */
        }
        created = {
          key,
          title: draft.title.trim(),
          description: ensureSourceDescription(
            draft.description,
            action,
            meeting,
          ),
          assignee: draft.assignee,
          priority: draft.priority,
          dueDate: draft.dueDate,
          createdAt: new Date().toISOString(),
          seeded: false,
        };
        return {
          ...previous,
          actions: previous.actions.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ticket: created,
                  stage: "added",
                  draft: null,
                  aiDraft: null,
                }
              : item,
          ),
        };
      });
      return created;
    },
    addNote: (note) =>
      mutate((previous) => ({
        ...previous,
        notes: [...previous.notes, note].sort((a, b) => a.time - b.time),
      })),
    deleteNote: (id) =>
      mutate((previous) => ({
        ...previous,
        notes: previous.notes.filter((note) => note.id !== id),
      })),
  };
}
