"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Link2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { fetchCalendarIcs, listChatWorkItems } from "@/lib/chat-api";
import { saveStoredExternalEvents } from "@/lib/schedule-utils";
import {
  buildMonthGrid,
  detectConflicts,
  entriesForDay,
  eventDay,
  monthLabel,
  shiftMonth,
  type CalendarEntry,
  type ExternalCalendarEvent,
} from "@/lib/calendar-utils";
import type { ChatTaskSuggestion, Milestone, WorkflowItem } from "@/types/api";
import { formatScheduleRange } from "@/lib/datetime-utils";
import { cn } from "@/lib/utils";
import { WorkItemScheduleEditor } from "@/components/chat/work-item-schedule-editor";

const ICS_STORAGE_KEY = "trend-pilot-chat-ics-url";

type Props = {
  apiAuth: string;
  chatType: "dm" | "group";
  targetId: string;
  taskSuggestions: ChatTaskSuggestion[];
  refreshKey?: number;
};

function parseDueFromSuggestion(s: ChatTaskSuggestion): string | null {
  const start = s.update_fields?.scheduled_start;
  if (start) return start.slice(0, 10);
  const raw = s.update_fields?.due_date;
  if (!raw) return null;
  return raw.slice(0, 10);
}

function itemHasSchedule(item: WorkflowItem): boolean {
  return Boolean(item.scheduled_start || item.due_date);
}

function workItemEntries(items: WorkflowItem[]): CalendarEntry[] {
  return items
    .filter((item) => itemHasSchedule(item))
    .map((item) => {
      const startIso = item.scheduled_start ?? (item.due_date ? `${item.due_date}T09:00:00` : undefined);
      const isoDate = (startIso ?? "").slice(0, 10);
      return {
        id: item.item_id,
        title: item.title,
        isoDate,
        startIso: item.scheduled_start,
        endIso: item.scheduled_end,
        timeLabel: formatScheduleRange(item.scheduled_start, item.scheduled_end),
        kind: "work_item" as const,
        stage: item.stage,
      };
    });
}

function milestoneEntries(milestones: Milestone[]): CalendarEntry[] {
  return milestones
    .filter((ms) => ms.scheduled_start || ms.due_date)
    .map((ms) => {
      const startIso = ms.scheduled_start ?? (ms.due_date ? `${ms.due_date}T09:00:00` : undefined);
      return {
        id: ms.milestone_id,
        title: ms.title,
        isoDate: (startIso ?? "").slice(0, 10),
        startIso: ms.scheduled_start,
        endIso: ms.scheduled_end,
        timeLabel: formatScheduleRange(ms.scheduled_start, ms.scheduled_end),
        kind: "milestone" as const,
        stage: ms.status,
      };
    });
}

function suggestionEntries(suggestions: ChatTaskSuggestion[]): CalendarEntry[] {
  const rows: CalendarEntry[] = [];
  suggestions.forEach((s, idx) => {
    const iso = parseDueFromSuggestion(s);
    if (!iso) return;
    const start = s.update_fields?.scheduled_start;
    const end = s.update_fields?.scheduled_end;
    rows.push({
      id: `suggestion-${idx}`,
      title: s.title || s.comment || "Suggested task",
      isoDate: iso,
      startIso: start,
      endIso: end,
      timeLabel: formatScheduleRange(start, end),
      kind: "suggestion",
    });
  });
  return rows;
}

export function ChatInfoCalendar({
  apiAuth,
  chatType,
  targetId,
  taskSuggestions,
  refreshKey = 0,
}: Props) {
  const [viewMonth, setViewMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedIso, setSelectedIso] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [icsUrl, setIcsUrl] = useState("");
  const [externalEvents, setExternalEvents] = useState<ExternalCalendarEvent[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [showSyncHelp, setShowSyncHelp] = useState<"google" | "apple" | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIcsUrl(localStorage.getItem(ICS_STORAGE_KEY) ?? "");
  }, []);

  const loadWorkItems = useCallback(async () => {
    if (!targetId) {
      setItems([]);
      setMilestones([]);
      return;
    }
    setLoadingItems(true);
    try {
      const data = await listChatWorkItems(apiAuth, { chat_type: chatType, target_id: targetId });
      setItems(data.items);
      setMilestones(data.milestones);
    } catch {
      setItems([]);
      setMilestones([]);
    } finally {
      setLoadingItems(false);
    }
  }, [apiAuth, chatType, targetId]);

  useEffect(() => {
    void loadWorkItems();
  }, [loadWorkItems, refreshKey]);

  const workEntries = useMemo(
    () => [
      ...workItemEntries(items),
      ...milestoneEntries(milestones),
      ...suggestionEntries(taskSuggestions),
    ],
    [items, milestones, taskSuggestions],
  );

  const conflictDays = useMemo(
    () => detectConflicts(workEntries, externalEvents),
    [workEntries, externalEvents],
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of workEntries) {
      const list = map.get(entry.isoDate) ?? [];
      list.push({ ...entry, conflict: conflictDays.has(entry.isoDate) });
      map.set(entry.isoDate, list);
    }
    for (const ev of externalEvents) {
      const iso = eventDay(ev.start);
      const list = map.get(iso) ?? [];
      list.push({
        id: `ext-${ev.start}-${ev.summary}`,
        title: ev.summary,
        isoDate: iso,
        kind: "external",
        conflict: conflictDays.has(iso),
      });
      map.set(iso, list);
    }
    return map;
  }, [workEntries, externalEvents, conflictDays]);

  const monthGrid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const selectedEntries = entriesForDay(entriesByDay.get(selectedIso) ?? [], selectedIso);

  async function handleSyncIcs() {
    const url = icsUrl.trim();
    if (!url) {
      setSyncError("Paste your Google or Apple calendar ICS URL first.");
      return;
    }
    setSyncBusy(true);
    setSyncError("");
    try {
      const result = await fetchCalendarIcs(apiAuth, { ics_url: url });
      setExternalEvents(result.events);
      saveStoredExternalEvents(result.events);
      if (typeof window !== "undefined") {
        localStorage.setItem(ICS_STORAGE_KEY, url);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncBusy(false);
    }
  }

  const undatedItems = items.filter((i) => !itemHasSchedule(i));
  const undatedCount = undatedItems.length + taskSuggestions.filter((s) => !parseDueFromSuggestion(s)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
          Schedule & work items
        </p>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-black/5"
          onClick={() => void loadWorkItems()}
          disabled={loadingItems}
          aria-label="Refresh work items"
        >
          {loadingItems ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="rounded-xl border border-black/5 bg-[#fafafa] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-black/5"
            onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-semibold text-[#101828]">{monthLabel(viewMonth)}</span>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-black/5"
            onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-sm font-medium text-muted-foreground">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {monthGrid.map((day) => {
            const dayEntries = entriesByDay.get(day.iso) ?? [];
            const hasWork = dayEntries.some((e) => e.kind !== "external");
            const hasExternal = dayEntries.some((e) => e.kind === "external");
            const hasConflict = conflictDays.has(day.iso);
            const isSelected = selectedIso === day.iso;
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => setSelectedIso(day.iso)}
                className={cn(
                  "relative flex h-10 flex-col items-center justify-center rounded-md text-base transition",
                  !day.inMonth && "text-muted-foreground/50",
                  day.inMonth && "text-[#333]",
                  isSelected && "bg-black text-white",
                  !isSelected && day.inMonth && "hover:bg-black/5",
                  hasConflict && !isSelected && "ring-1 ring-amber-500/80",
                )}
              >
                {day.date.getDate()}
                <span className="mt-0.5 flex h-1 gap-0.5">
                  {hasWork ? (
                    <span className={cn("h-1 w-1 rounded-full", isSelected ? "bg-white" : "bg-[#9810fa]")} />
                  ) : null}
                  {hasExternal ? (
                    <span className={cn("h-1 w-1 rounded-full", isSelected ? "bg-white/70" : "bg-[#0284c7]")} />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9810fa]" /> Work item
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0284c7]" /> External
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full ring-1 ring-amber-500" /> Conflict
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-2.5">
        <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{selectedIso}</p>
        {selectedEntries.length === 0 ? (
          <p className="text-base text-muted-foreground">No tasks or events this day.</p>
        ) : (
          <ul className="max-h-28 space-y-1 overflow-y-auto">
            {selectedEntries.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  "rounded-lg px-2 py-1 text-base",
                  entry.kind === "external" && "bg-sky-50 text-sky-900",
                  entry.kind === "suggestion" && "bg-amber-50 text-amber-950",
                  entry.kind === "work_item" && "bg-purple-50 text-purple-950",
                  entry.kind === "milestone" && "bg-emerald-50 text-emerald-950",
                )}
              >
                <div className="flex items-start gap-1">
                  {entry.conflict ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" /> : null}
                  <span className="font-medium">{entry.title}</span>
                </div>
                <span className="text-sm capitalize text-muted-foreground">
                  {entry.kind.replace("_", " ")}
                  {entry.stage ? ` · ${entry.stage}` : ""}
                  {entry.timeLabel ? ` · ${entry.timeLabel}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 ? (
        <div className="rounded-xl border border-black/5 bg-white p-2.5">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Linked work items ({items.length})
          </p>
          <ul className="max-h-40 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li key={item.item_id} className="rounded-lg border border-black/5 bg-[#fafafa] p-2">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-medium text-[#222]">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.stage}
                      {item.owner ? ` · ${item.owner}` : ""}
                    </p>
                    {item.source_message_batch_index != null ? (
                      <p className="text-sm text-purple-800">
                        From chat section #{(item.source_message_batch_index ?? 0) + 1}
                      </p>
                    ) : null}
                    {itemHasSchedule(item) ? (
                      <p className="text-sm text-indigo-800">
                        {formatScheduleRange(item.scheduled_start, item.scheduled_end)}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-700">No date/time</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-indigo-700 underline"
                    onClick={() =>
                      setEditingItemId((prev) => (prev === item.item_id ? null : item.item_id))
                    }
                  >
                    {editingItemId === item.item_id ? "Close" : "Edit time"}
                  </button>
                </div>
                {editingItemId === item.item_id ? (
                  <WorkItemScheduleEditor
                    apiAuth={apiAuth}
                    chatType={chatType}
                    targetId={targetId}
                    item={item}
                    compact
                    onSaved={() => {
                      setEditingItemId(null);
                      void loadWorkItems();
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {undatedCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {undatedCount} item{undatedCount === 1 ? "" : "s"} without a scheduled date/time.
        </p>
      ) : null}

      <div className="rounded-xl border border-dashed border-black/10 bg-[#fafafa] p-3">
        <p className="mb-2 flex items-center gap-1.5 text-base font-semibold text-[#333]">
          <Link2 className="h-3.5 w-3.5" />
          Google / Apple calendar
        </p>
        <p className="mb-2 text-sm leading-relaxed text-muted-foreground">
          Paste your private ICS subscription URL to overlay busy times and flag schedule conflicts.
        </p>
        <input
          className="mb-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-base"
          value={icsUrl}
          onChange={(e) => setIcsUrl(e.target.value)}
          placeholder="https://calendar.google.com/calendar/ical/…"
        />
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-sm font-medium hover:bg-black/5"
            onClick={() => setShowSyncHelp((h) => (h === "google" ? null : "google"))}
          >
            Google setup
          </button>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-sm font-medium hover:bg-black/5"
            onClick={() => setShowSyncHelp((h) => (h === "apple" ? null : "apple"))}
          >
            Apple setup
          </button>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void handleSyncIcs()}
            disabled={syncBusy}
          >
            {syncBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarDays className="h-3 w-3" />}
            Sync
          </button>
        </div>
        {showSyncHelp === "google" ? (
          <p className="mb-2 text-sm text-muted-foreground">
            Google Calendar → Settings → your calendar → Integrate calendar → Secret address in iCal format.
          </p>
        ) : null}
        {showSyncHelp === "apple" ? (
          <p className="mb-2 text-sm text-muted-foreground">
            Mac Calendar → Settings → Accounts → calendar → copy the subscribe (.ics) URL.
          </p>
        ) : null}
        {syncError ? <p className="text-sm text-red-600">{syncError}</p> : null}
        {externalEvents.length > 0 ? (
          <p className="text-sm text-[#16a34a]">
            Synced {externalEvents.length} external event{externalEvents.length === 1 ? "" : "s"}.
            {conflictDays.size > 0
              ? ` ${conflictDays.size} day${conflictDays.size === 1 ? "" : "s"} with conflicts.`
              : " No conflicts detected."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
