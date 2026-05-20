import type { CalendarIcsEvent, TimeSlot } from "@/types/api";

export const ICS_STORAGE_KEY = "trend-pilot-chat-ics-url";
const ICS_EVENTS_KEY = "trend-pilot-chat-calendar-events";

const TIME_PATTERN =
  /\b(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|deadline|due|schedule|scheduled|meeting|call|sync|at\s+\d{1,2}|\d{1,2}(:\d{2})?\s*(am|pm)|by\s+\w+\s+\d{1,2}|eod|eow)\b/i;

const AVAILABILITY_PATTERN =
  /\b(free\s+(slot|time)|open\s+(slot|time)|availability|available|when\s+(can|could)\s+we\s+meet|do\s+i\s+have|next\s+week|this\s+week|find\s+a?\s*time)\b/i;

export function detectSchedulingIntent(text: string): boolean {
  const t = text.trim();
  return TIME_PATTERN.test(t) || AVAILABILITY_PATTERN.test(t);
}

/** Matches @chat questions about free/busy time (not general transcript Q&A). */
export function isAvailabilityQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (AVAILABILITY_PATTERN.test(t)) return true;
  if (/\bfree\b/.test(t) && /\b(slot|time|meet|calendar|week)\b/.test(t)) return true;
  if (/\bavailable\b/.test(t) && /\b(meet|call|week|when|slot)\b/.test(t)) return true;
  return false;
}

export function loadStoredExternalEvents(): CalendarIcsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ICS_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { events?: CalendarIcsEvent[] };
    return parsed.events ?? [];
  } catch {
    return [];
  }
}

export function saveStoredExternalEvents(events: CalendarIcsEvent[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ICS_EVENTS_KEY, JSON.stringify({ events, savedAt: new Date().toISOString() }));
}

export function scheduleFieldsFromSlot(slot: TimeSlot): Record<string, string> {
  const day = slot.start.slice(0, 10);
  return {
    due_date: day,
    scheduled_start: slot.start,
    scheduled_end: slot.end,
  };
}

export function scheduleFieldsFromCustom(dateValue: string, timeValue: string, durationMinutes: number): Record<string, string> | null {
  if (!dateValue || !timeValue) return null;
  const start = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    due_date: dateValue,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
  };
}

/** Show schedule picker on detected tasks that can get a due date (create/update). */
export function suggestionNeedsSchedule(suggestion: { action: string }): boolean {
  return suggestion.action === "create" || suggestion.action === "update";
}

export function scheduleFieldsFromSuggestions(
  suggestions: Array<{ update_fields?: Record<string, string> }>,
): Record<number, Record<string, string>> {
  const out: Record<number, Record<string, string>> = {};
  suggestions.forEach((s, idx) => {
    const uf = s.update_fields ?? {};
    if (uf.scheduled_start?.trim() && uf.scheduled_end?.trim()) {
      out[idx] = {
        due_date: uf.due_date ?? uf.scheduled_start.slice(0, 10),
        scheduled_start: uf.scheduled_start,
        scheduled_end: uf.scheduled_end,
      };
    }
  });
  return out;
}

/** Merge new suggestions with existing panel entries without duplicates. */
export function mergeTaskSuggestions<T extends { action: string; title?: string; existing_item_id?: string }>(
  existing: T[],
  incoming: T[],
): T[] {
  const out = [...existing];
  for (const s of incoming) {
    const dup = out.some((e) => {
      if (s.action === "create" && e.action === "create") {
        const a = (s.title ?? "").trim().toLowerCase();
        const b = (e.title ?? "").trim().toLowerCase();
        return a && a === b;
      }
      if (s.existing_item_id && e.existing_item_id) {
        return s.existing_item_id === e.existing_item_id && s.action === e.action;
      }
      return false;
    });
    if (!dup) out.push(s);
  }
  return out;
}

export function hasRequiredScheduleFields(
  fields: Record<string, string> | undefined,
  suggestion: { action: string; update_fields?: Record<string, string> },
): boolean {
  if (!suggestionNeedsSchedule(suggestion)) return true;
  const merged = { ...(suggestion.update_fields ?? {}), ...(fields ?? {}) };
  return Boolean(merged.scheduled_start?.trim() && merged.scheduled_end?.trim());
}
