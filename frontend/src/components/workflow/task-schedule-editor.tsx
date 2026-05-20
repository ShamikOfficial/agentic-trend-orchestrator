"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { updateWorkflowItem } from "@/lib/workflow-api";
import type { WorkflowItem } from "@/types/api";

type Props = {
  item: WorkflowItem;
  onSaved: () => void | Promise<void>;
  onError: (message: string) => void;
};

function formatDateLabel(isoDate?: string | null): string {
  if (!isoDate) return "No date";
  const d = isoDate.includes("T") ? new Date(isoDate) : new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "No date";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function TaskScheduleEditor({ item, onSaved, onError }: Props) {
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [busy, setBusy] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDueDate(item.due_date ?? "");
  }, [item.item_id, item.due_date]);

  const createdLabel = formatDateLabel(item.created_at);

  async function handleDueChange(value: string) {
    if (value === dueDate) return;
    setDueDate(value);
    setBusy(true);
    onError("");
    try {
      await updateWorkflowItem(item.item_id, {
        due_date: value || undefined,
      });
      await onSaved();
    } catch (err) {
      setDueDate(item.due_date ?? "");
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 text-base">
      <div className="flex items-center gap-2">
        <span className="text-[#9a9ea6]">Created:</span>
        <span className="font-medium text-[#6a7282]">{createdLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#9a9ea6]">Due:</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 font-medium text-[#101828] underline-offset-2 hover:underline disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin text-[#6a7282]" />
          ) : (
            <Calendar size={16} className="text-[#6a7282]" />
          )}
          {dueDate ? formatDateLabel(dueDate) : "Set due date"}
        </button>
        <input
          ref={dateInputRef}
          type="date"
          className="sr-only"
          value={dueDate}
          onChange={(e) => void handleDueChange(e.target.value)}
        />
      </div>
    </div>
  );
}
