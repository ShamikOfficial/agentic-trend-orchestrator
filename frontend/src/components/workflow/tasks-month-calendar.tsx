"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildMonthGrid, monthLabel, shiftMonth } from "@/lib/calendar-utils";
import { COLUMN_COLORS, taskCalendarIso, toUiColumn } from "@/lib/workflow-task-utils";
import type { WorkflowItem } from "@/types/api";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Props = {
  tasks: WorkflowItem[];
  selectedItemId: string;
  onSelectTask: (itemId: string) => void;
};

export function TasksMonthCalendar({ tasks, selectedItemId, onSelectTask }: Props) {
  const [viewMonth, setViewMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const monthGrid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const todayIso = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);

  const datedTasks = useMemo(
    () =>
      tasks
        .map((task) => ({ task, iso: taskCalendarIso(task) }))
        .filter((row): row is { task: WorkflowItem; iso: string } => Boolean(row.iso)),
    [tasks],
  );

  const undatedTasks = useMemo(
    () => tasks.filter((task) => !taskCalendarIso(task)),
    [tasks],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, WorkflowItem[]>();
    for (const { task, iso } of datedTasks) {
      const list = map.get(iso) ?? [];
      list.push(task);
      map.set(iso, list);
    }
    return map;
  }, [datedTasks]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 text-base">
      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-[#364153] transition hover:bg-[#f3f4f6]"
            onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={22} />
          </button>
          <h2 className="text-center text-2xl font-bold text-[#101828] md:text-3xl">
            {monthLabel(viewMonth)}
          </h2>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-[#364153] transition hover:bg-[#f3f4f6]"
            onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="mb-2 hidden grid-cols-7 gap-2 md:grid">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="px-1 py-2 text-center text-sm font-semibold uppercase tracking-wide text-[#6a7282] md:text-base"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 md:hidden">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
            <div key={label} className="py-1 text-center text-sm font-semibold text-[#6a7282]">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 md:gap-2">
          {monthGrid.map((day) => {
            const dayTasks = tasksByDay.get(day.iso) ?? [];
            const isToday = day.iso === todayIso;
            return (
              <div
                key={day.iso}
                className={cn(
                  "flex min-h-[100px] flex-col rounded-xl border p-2 transition md:min-h-[140px] md:p-2.5",
                  day.inMonth ? "border-[#e5e7eb] bg-white" : "border-transparent bg-[#f9fafb]/80",
                  isToday && "ring-2 ring-[#9810fa]/40",
                )}
              >
                <span
                  className={cn(
                    "mb-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold md:text-lg",
                    isToday && "bg-[#101828] text-white",
                    !isToday && day.inMonth && "text-[#101828]",
                    !isToday && !day.inMonth && "text-[#9a9ea6]",
                  )}
                >
                  {day.date.getDate()}
                </span>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayTasks.slice(0, 4).map((task) => {
                    const column = toUiColumn(task.stage);
                    const color = COLUMN_COLORS[column];
                    const selected = task.item_id === selectedItemId;
                    return (
                      <button
                        key={task.item_id}
                        type="button"
                        title={task.title}
                        onClick={() => onSelectTask(task.item_id)}
                        className={cn(
                          "w-full truncate rounded-md border px-1.5 py-1 text-left text-xs font-semibold leading-tight md:text-sm",
                          selected
                            ? "border-[#9810fa] bg-[#faf5ff] text-[#101828]"
                            : "border-transparent bg-[#f3f4f6] text-[#364153] hover:bg-[#e5e7eb]",
                        )}
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        {task.title}
                      </button>
                    );
                  })}
                  {dayTasks.length > 4 ? (
                    <span className="px-1 text-xs font-medium text-[#6a7282] md:text-sm">
                      +{dayTasks.length - 4} more
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#6a7282] md:text-base">
          {(["To Do", "In Progress", "In Review", "Done"] as const).map((col) => (
            <span key={col} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLUMN_COLORS[col] }}
              />
              {col}
            </span>
          ))}
        </div>
      </div>

      {undatedTasks.length > 0 ? (
        <section className="rounded-2xl border border-dashed border-[#d1d5db] bg-white p-4">
          <h3 className="mb-2 text-lg font-bold text-[#101828]">
            No due date ({undatedTasks.length})
          </h3>
          <ul className="flex flex-wrap gap-2">
            {undatedTasks.map((task) => (
              <li key={task.item_id}>
                <button
                  type="button"
                  onClick={() => onSelectTask(task.item_id)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-base font-medium transition",
                    task.item_id === selectedItemId
                      ? "border-[#9810fa] bg-[#faf5ff] text-[#101828]"
                      : "border-[#e5e7eb] bg-[#f9fafb] text-[#364153] hover:border-[#9810fa]",
                  )}
                >
                  {task.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
