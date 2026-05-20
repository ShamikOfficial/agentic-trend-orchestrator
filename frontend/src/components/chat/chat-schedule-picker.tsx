"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { suggestTimeSlots } from "@/lib/chat-api";
import {
  loadStoredExternalEvents,
  scheduleFieldsFromCustom,
  scheduleFieldsFromSlot,
} from "@/lib/schedule-utils";
import type { SuggestTimeSlotsResponse, TimeSlot } from "@/types/api";
import { cn } from "@/lib/utils";

type Props = {
  apiAuth: string;
  chatType: "dm" | "group";
  targetId: string;
  taskTitle: string;
  taskDescription?: string;
  messageText?: string;
  preferredDate?: string;
  durationMinutes?: number;
  onSelect: (fields: Record<string, string>, label: string) => void;
  compact?: boolean;
};

export function ChatSchedulePicker({
  apiAuth,
  chatType,
  targetId,
  taskTitle,
  taskDescription = "",
  messageText,
  preferredDate,
  durationMinutes = 60,
  onSelect,
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SuggestTimeSlotsResponse | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("10:00");
  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  useEffect(() => {
    if (preferredDate) {
      setCustomDate(preferredDate);
    }
  }, [preferredDate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const result = await suggestTimeSlots(apiAuth, {
          chat_type: chatType,
          target_id: targetId,
          task_title: taskTitle,
          task_description: taskDescription,
          duration_minutes: durationMinutes,
          preferred_date: preferredDate,
          message_text: messageText,
          external_events: loadStoredExternalEvents(),
        });
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    apiAuth,
    chatType,
    targetId,
    taskTitle,
    taskDescription,
    messageText,
    preferredDate,
    durationMinutes,
  ]);

  function pickSlot(slot: TimeSlot) {
    setSelectedStart(slot.start);
    onSelect(scheduleFieldsFromSlot(slot), slot.label);
  }

  function applyCustom() {
    const fields = scheduleFieldsFromCustom(customDate, customTime, durationMinutes);
    if (!fields) return;
    setSelectedStart(fields.scheduled_start);
    onSelect(fields, `Custom · ${customDate} ${customTime}`);
    setCustomOpen(false);
  }

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Finding open time slots…
      </p>
    );
  }

  if (!data?.slots?.length) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground">No slots found — pick a custom time.</p>
        <CustomTimeRow
          customOpen={customOpen}
          setCustomOpen={setCustomOpen}
          customDate={customDate}
          setCustomDate={setCustomDate}
          customTime={customTime}
          setCustomTime={setCustomTime}
          onApply={applyCustom}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", compact && "mt-1")}>
      <p className="flex items-start gap-1 text-sm leading-snug text-indigo-900">
        <CalendarClock className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{data.smart_reply}</span>
      </p>
      <div className="flex flex-wrap gap-1">
        {data.slots.map((slot) => (
          <button
            key={slot.start}
            type="button"
            onClick={() => pickSlot(slot)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-sm font-medium transition",
              selectedStart === slot.start
                ? "border-indigo-600 bg-indigo-600 text-white"
                : slot.recommended
                  ? "border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
                  : "border-black/10 bg-white text-[#333] hover:bg-black/5",
              slot.conflict && selectedStart !== slot.start && "opacity-60",
            )}
          >
            {slot.label}
          </button>
        ))}
      </div>
      <CustomTimeRow
        customOpen={customOpen}
        setCustomOpen={setCustomOpen}
        customDate={customDate}
        setCustomDate={setCustomDate}
        customTime={customTime}
        setCustomTime={setCustomTime}
        onApply={applyCustom}
      />
    </div>
  );
}

function CustomTimeRow({
  customOpen,
  setCustomOpen,
  customDate,
  setCustomDate,
  customTime,
  setCustomTime,
  onApply,
}: {
  customOpen: boolean;
  setCustomOpen: (v: boolean) => void;
  customDate: string;
  setCustomDate: (v: string) => void;
  customTime: string;
  setCustomTime: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        className="text-sm font-medium text-indigo-800 underline underline-offset-2"
        onClick={() => setCustomOpen(!customOpen)}
      >
        {customOpen ? "Hide custom time" : "Choose custom date & time"}
      </button>
      {customOpen ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            className="h-9 rounded-md border border-black/10 px-2 text-base"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
          />
          <input
            type="time"
            className="h-9 rounded-md border border-black/10 px-2 text-base"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
          />
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-2 py-1 text-sm font-semibold text-white"
            onClick={onApply}
          >
            Use time
          </button>
        </div>
      ) : null}
    </div>
  );
}

