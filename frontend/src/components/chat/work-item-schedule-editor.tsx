"use client";

import { useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { applyTaskAction } from "@/lib/chat-api";
import {
  formatScheduleRange,
  scheduleFieldsFromDatetimes,
  toDatetimeLocalValue,
} from "@/lib/datetime-utils";
import type { WorkflowItem } from "@/types/api";

type Props = {
  apiAuth: string;
  chatType: "dm" | "group";
  targetId: string;
  item: WorkflowItem;
  compact?: boolean;
  onSaved?: () => void;
};

export function WorkItemScheduleEditor({
  apiAuth,
  chatType,
  targetId,
  item,
  compact = false,
  onSaved,
}: Props) {
  const [startLocal, setStartLocal] = useState(() => toDatetimeLocalValue(item.scheduled_start));
  const [endLocal, setEndLocal] = useState(() => toDatetimeLocalValue(item.scheduled_end));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const currentLabel = formatScheduleRange(item.scheduled_start, item.scheduled_end);

  async function handleSave() {
    const fields = scheduleFieldsFromDatetimes(startLocal, endLocal);
    if (!fields) {
      setError("Pick a valid start and end date/time (end must be after start).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await applyTaskAction(apiAuth, {
        action: "update",
        existing_item_id: item.item_id,
        update_fields: fields,
        chat_type: chatType,
        target_id: targetId,
      });
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={compact ? "space-y-1.5" : "space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2"}
    >
      {!compact ? (
        <p className="flex items-center gap-1 text-sm font-semibold text-indigo-900">
          <CalendarClock className="h-3 w-3" />
          Schedule
        </p>
      ) : null}
      {currentLabel ? (
        <p className="text-sm text-indigo-800">{currentLabel}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No date/time set</p>
      )}
      <div className="grid gap-1.5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-muted-foreground">
          Start
          <input
            type="datetime-local"
            className="mt-0.5 h-9 w-full rounded-md border border-black/10 bg-white px-2 text-base"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-muted-foreground">
          End
          <input
            type="datetime-local"
            className="mt-0.5 h-9 w-full rounded-md border border-black/10 bg-white px-2 text-base"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
          />
        </label>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        className="rounded-md bg-indigo-600 px-2 py-0.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        disabled={busy}
        onClick={() => void handleSave()}
      >
        {busy ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </span>
        ) : (
          "Save schedule"
        )}
      </button>
    </div>
  );
}
