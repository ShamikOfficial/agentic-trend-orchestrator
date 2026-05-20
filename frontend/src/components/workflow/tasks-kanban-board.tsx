"use client";

import { Calendar, MessageSquare } from "lucide-react";
import {
  COLUMN_COLORS,
  inferPriority,
  inferSource,
  PRIORITY_COLORS,
  SOURCE_COLORS,
  TASK_COLUMNS,
  type UiColumn,
} from "@/lib/workflow-task-utils";
import type { WorkflowItem } from "@/types/api";

type Props = {
  tasksByColumn: Record<UiColumn, WorkflowItem[]>;
  selectedItemId: string;
  dragOverColumn: UiColumn | null;
  onSelectTask: (itemId: string) => void;
  onDragStart: (itemId: string) => void;
  onDragEnd: () => void;
  onDragOverColumn: (column: UiColumn | null) => void;
  onDropOnColumn: (column: UiColumn) => void;
};

export function TasksKanbanBoard({
  tasksByColumn,
  selectedItemId,
  dragOverColumn,
  onSelectTask,
  onDragStart,
  onDragEnd,
  onDragOverColumn,
  onDropOnColumn,
}: Props) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 overflow-x-auto text-base lg:grid-cols-4">
      {TASK_COLUMNS.map((column) => {
        const columnTasks = tasksByColumn[column];
        const colColor = COLUMN_COLORS[column];
        return (
          <section
            key={column}
            className={`flex min-w-[240px] flex-col rounded-xl transition-colors ${dragOverColumn === column ? "bg-[#f3f4f6]/70" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              onDragOverColumn(column);
            }}
            onDragLeave={() => onDragOverColumn(null)}
            onDrop={(event) => {
              event.preventDefault();
              onDropOnColumn(column);
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base font-bold" style={{ color: colColor }}>
                {column}
              </span>
              <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-sm font-semibold text-[#6a7282]">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex-1 space-y-3">
              {columnTasks.map((task) => {
                const priority = inferPriority(task);
                const source = inferSource(task);
                const due = task.due_date
                  ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString()
                  : "No due date";
                const commentsCount = task.comments?.length ?? 0;
                return (
                  <button
                    key={task.item_id}
                    type="button"
                    onClick={() => onSelectTask(task.item_id)}
                    draggable
                    onDragStart={() => onDragStart(task.item_id)}
                    onDragEnd={onDragEnd}
                    className={`w-full rounded-xl border bg-white p-4 text-left transition-colors ${
                      selectedItemId === task.item_id
                        ? "border-[#9810fa] shadow-sm"
                        : "border-[#e5e7eb] hover:border-[#d1d5db]"
                    }`}
                  >
                    <p className="mb-2 text-base font-semibold leading-snug text-[#101828]">
                      {task.title}
                    </p>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-sm font-semibold ${PRIORITY_COLORS[priority]}`}
                      >
                        {priority}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-sm font-medium ${SOURCE_COLORS[source]}`}
                      >
                        {source}
                      </span>
                    </div>
                    <p className="mb-1 text-sm font-medium text-[#9810fa]">
                      {task.project || "General"}
                    </p>
                    <p className="mb-2 text-sm text-[#9a9ea6]">{task.owner || "Unassigned"}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#9a9ea6]">
                        <Calendar size={14} />
                        <span className="text-sm">{due}</span>
                      </div>
                      {commentsCount > 0 ? (
                        <div className="flex items-center gap-1 text-[#9a9ea6]">
                          <MessageSquare size={14} />
                          <span className="text-sm">{commentsCount}</span>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
              {columnTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d1d5db] bg-white px-3 py-5 text-base text-[#9a9ea6]">
                  No tasks
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
