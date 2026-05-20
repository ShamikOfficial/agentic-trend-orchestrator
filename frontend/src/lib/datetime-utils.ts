/** Format ISO datetime for `<input type="datetime-local" />`. */
export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatScheduleRange(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return "";
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "";
  const datePart = start.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const timePart = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (!endIso) return `${datePart} ${timePart}`;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return `${datePart} ${timePart}`;
  const endTime = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart} – ${endTime}`;
}

export function scheduleFieldsFromDatetimes(
  startLocal: string,
  endLocal: string,
): Record<string, string> | null {
  if (!startLocal || !endLocal) return null;
  const start = new Date(startLocal);
  const end = new Date(endLocal);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() <= start.getTime()) return null;
  return {
    due_date: startLocal.slice(0, 10),
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
  };
}
