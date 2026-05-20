export type CalendarDay = {
  date: Date;
  inMonth: boolean;
  iso: string;
};

export type CalendarEntry = {
  id: string;
  title: string;
  isoDate: string;
  kind: "work_item" | "milestone" | "suggestion" | "external";
  stage?: string;
  conflict?: boolean;
  startIso?: string;
  endIso?: string;
  timeLabel?: string;
};

export type ExternalCalendarEvent = {
  summary: string;
  start: string;
  end: string;
  all_day?: string;
};

const ISO_DAY = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function buildMonthGrid(viewMonth: Date): CalendarDay[] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({
      date,
      inMonth: date.getMonth() === month,
      iso: ISO_DAY(date),
    });
  }
  return days;
}

export function eventDay(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

export function entriesForDay(entries: CalendarEntry[], iso: string): CalendarEntry[] {
  return entries.filter((e) => e.isoDate === iso);
}

export function detectConflicts(
  workEntries: CalendarEntry[],
  externalEvents: ExternalCalendarEvent[],
): Set<string> {
  const workDays = new Set(workEntries.map((e) => e.isoDate));
  const conflictDays = new Set<string>();
  for (const ev of externalEvents) {
    const day = eventDay(ev.start);
    if (workDays.has(day)) conflictDays.add(day);
  }
  return conflictDays;
}

export function monthLabel(viewMonth: Date): string {
  return viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function shiftMonth(viewMonth: Date, delta: number): Date {
  return new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
}
