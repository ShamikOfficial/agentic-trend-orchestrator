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

/** Map stored ISO schedule to local date/time inputs for <input type="date|time">. */
export function scheduleFieldsToLocalInputs(fields: Record<string, string>): {
  date: string;
  time: string;
} {
  const start = fields.scheduled_start?.trim();
  if (!start) {
    return { date: fields.due_date?.slice(0, 10) ?? "", time: "10:00" };
  }
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) {
    return { date: fields.due_date?.slice(0, 10) ?? "", time: "10:00" };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
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

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function localDateYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function resolveWeekdayLocal(name: string, today: Date, forceNext: boolean): string {
  const target = WEEKDAY_NAMES.indexOf(name.toLowerCase() as (typeof WEEKDAY_NAMES)[number]);
  if (target < 0) return localDateYmd(today);
  let daysAhead = (target - today.getDay() + 7) % 7;
  if (forceNext || daysAhead === 0) {
    if (daysAhead === 0) daysAhead = 7;
  }
  const out = new Date(today);
  out.setDate(out.getDate() + daysAhead);
  return localDateYmd(out);
}

/** Client-side fallback when API leaves date only in description/reasoning text. */
export function parseDateFromPhrase(text: string, now = new Date()): string | null {
  const lower = text.toLowerCase();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  if (/\btoday\b/.test(lower)) return localDateYmd(today);
  if (/\btomorrow\b/.test(lower)) {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return localDateYmd(t);
  }

  const patterns: Array<[RegExp, boolean]> = [
    [/\bon\s+next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, true],
    [/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, true],
    [/\bthis\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, false],
    [/\bon\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, false],
  ];
  for (const [re, forceNext] of patterns) {
    const m = lower.match(re);
    if (m) return resolveWeekdayLocal(m[1], today, forceNext);
  }

  const plain = lower.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (plain) return resolveWeekdayLocal(plain[1], today, false);

  return null;
}

function parseTimeFromPhrase(text: string): { hour: number; minute: number } | null {
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  const minute = Number(m[2] ?? 0);
  if (m[3].toLowerCase() === "pm") hour += 12;
  if (m[3].toLowerCase() === "am" && Number(m[1]) === 12) hour = 0;
  if (m[3].toLowerCase() === "pm" && Number(m[1]) === 12) hour = 12;
  return { hour, minute };
}

function suggestionScheduleText(suggestion: {
  title?: string;
  description?: string;
  reasoning?: string;
  update_fields?: Record<string, string>;
}): string {
  const parts: string[] = [
    suggestion.title ?? "",
    suggestion.description ?? "",
    suggestion.reasoning ?? "",
  ];
  const uf = suggestion.update_fields ?? {};
  for (const val of Object.values(uf)) {
    if (val?.trim()) parts.push(val);
  }
  return parts.filter(Boolean).join(" ");
}

export function inferScheduleFieldsFromSuggestion(suggestion: {
  action: string;
  title?: string;
  description?: string;
  reasoning?: string;
  update_fields?: Record<string, string>;
}): Record<string, string> | null {
  if (!suggestionNeedsSchedule(suggestion)) return null;
  const uf = suggestion.update_fields ?? {};
  if (uf.scheduled_start?.trim() && uf.scheduled_end?.trim()) {
    return {
      due_date: uf.due_date ?? uf.scheduled_start.slice(0, 10),
      scheduled_start: uf.scheduled_start,
      scheduled_end: uf.scheduled_end,
    };
  }
  // Do not re-infer when API already set a due_date (avoids UTC 3am drift).
  if (uf.due_date?.trim() && !uf.scheduled_start?.trim()) {
    return null;
  }
  const text = suggestionScheduleText(suggestion);
  if (!text.trim()) return null;
  const day =
    uf.due_date?.trim().slice(0, 10) ?? parseDateFromPhrase(text) ?? null;
  if (!day) return null;
  const time = parseTimeFromPhrase(text);
  const hour = time?.hour ?? 10;
  const minute = time?.minute ?? 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(
    `${day}T${pad(hour)}:${pad(minute)}:00`,
  );
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    due_date: day,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
  };
}

export function enrichSuggestionWithSchedule<T extends {
  action: string;
  title?: string;
  description?: string;
  reasoning?: string;
  update_fields?: Record<string, string>;
}>(suggestion: T): T {
  const inferred = inferScheduleFieldsFromSuggestion(suggestion);
  if (!inferred) return suggestion;
  return {
    ...suggestion,
    update_fields: { ...(suggestion.update_fields ?? {}), ...inferred },
  };
}

export function scheduleFieldsFromSuggestions(
  suggestions: Array<{
    action: string;
    title?: string;
    description?: string;
    reasoning?: string;
    update_fields?: Record<string, string>;
  }>,
): Record<number, Record<string, string>> {
  const out: Record<number, Record<string, string>> = {};
  suggestions.forEach((s, idx) => {
    const inferred = inferScheduleFieldsFromSuggestion(s);
    if (inferred) {
      out[idx] = inferred;
    }
  });
  return out;
}

export function formatScheduleLabel(fields: Record<string, string>): string {
  const startRaw = fields.scheduled_start;
  if (!startRaw) return fields.due_date ?? "";
  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) return fields.due_date ?? startRaw;
  const end = fields.scheduled_end ? new Date(fields.scheduled_end) : null;
  const datePart = start.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timePart = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (end && !Number.isNaN(end.getTime())) {
    const endPart = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `${datePart} ${timePart} – ${endPart}`;
  }
  return `${datePart} ${timePart}`;
}

export function labelsFromScheduleFields(
  fieldsByIndex: Record<number, Record<string, string>>,
): Record<number, string> {
  const labels: Record<number, string> = {};
  for (const [idx, fields] of Object.entries(fieldsByIndex)) {
    labels[Number(idx)] = formatScheduleLabel(fields);
  }
  return labels;
}

/** Shift keyed maps when a suggestion row is removed by index. */
export function reindexSuggestionRecord<T>(
  record: Record<number, T>,
  removedIndex: number,
): Record<number, T> {
  const next: Record<number, T> = {};
  for (const [key, value] of Object.entries(record)) {
    const i = Number(key);
    if (i < removedIndex) next[i] = value;
    else if (i > removedIndex) next[i - 1] = value;
  }
  return next;
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
  const start = merged.scheduled_start?.trim() ?? "";
  const end = merged.scheduled_end?.trim() ?? "";
  if (!start || !end) return false;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs;
}

export function suggestionHasPrefilledSchedule(suggestion: {
  action: string;
  update_fields?: Record<string, string>;
}): boolean {
  return hasRequiredScheduleFields(undefined, suggestion);
}
