"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { ChatSchedulePicker } from "@/components/chat/chat-schedule-picker";
import {
  formatScheduleLabel,
  inferScheduleFieldsFromSuggestion,
  scheduleFieldsFromCustom,
  scheduleFieldsToLocalInputs,
} from "@/lib/schedule-utils";
import type { ChatTaskSuggestion } from "@/types/api";

type Props = {
  apiAuth: string;
  chatType: "dm" | "group";
  targetId: string;
  suggestion: ChatTaskSuggestion;
  fields: Record<string, string> | undefined;
  onChange: (fields: Record<string, string>, label: string) => void;
};

export function SuggestionScheduleEditor({
  apiAuth,
  chatType,
  targetId,
  suggestion,
  fields,
  onChange,
}: Props) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [showSlots, setShowSlots] = useState(false);

  useEffect(() => {
    const source =
      fields ??
      inferScheduleFieldsFromSuggestion(suggestion) ??
      undefined;
    if (source?.scheduled_start) {
      const inputs = scheduleFieldsToLocalInputs(source);
      setDate(inputs.date);
      setTime(inputs.time);
    } else if (source?.due_date) {
      setDate(source.due_date.slice(0, 10));
      setTime("10:00");
    }
  }, [fields, suggestion]);

  function applyDateTime(nextDate: string, nextTime: string) {
    if (!nextDate || !nextTime) return;
    const built = scheduleFieldsFromCustom(nextDate, nextTime, 60);
    if (!built) return;
    onChange(built, formatScheduleLabel(built));
  }

  function handleDateChange(value: string) {
    setDate(value);
    if (value && time) applyDateTime(value, time);
  }

  function handleTimeChange(value: string) {
    setTime(value);
    if (date && value) applyDateTime(date, value);
  }

  const hasSchedule = Boolean(date && time);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-xs font-medium text-indigo-900">
          Date
          <input
            type="date"
            className="h-9 min-w-[9.5rem] rounded-md border border-black/10 bg-white px-2 text-base"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-medium text-indigo-900">
          Time
          <input
            type="time"
            className="h-9 min-w-[7.5rem] rounded-md border border-black/10 bg-white px-2 text-base"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
          />
        </label>
        {hasSchedule && fields ? (
          <p className="pb-1 text-xs font-medium text-indigo-800">
            {formatScheduleLabel(fields)}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-800 underline underline-offset-2"
        onClick={() => setShowSlots((v) => !v)}
      >
        <Pencil className="h-3 w-3" />
        {showSlots ? "Hide suggested slots" : "Browse open slots or pick another time"}
      </button>
      {showSlots ? (
        <ChatSchedulePicker
          apiAuth={apiAuth}
          chatType={chatType}
          targetId={targetId}
          taskTitle={suggestion.title || suggestion.comment || "Task"}
          taskDescription={suggestion.description}
          preferredDate={date || suggestion.update_fields?.due_date?.slice(0, 10)}
          compact
          onSelect={(slotFields, label) => {
            const inputs = scheduleFieldsToLocalInputs(slotFields);
            setDate(inputs.date);
            setTime(inputs.time);
            onChange(slotFields, label);
          }}
        />
      ) : null}
    </div>
  );
}
