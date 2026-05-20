import type { WorkflowItem, WorkflowStage } from "@/types/api";

export type UiColumn = "To Do" | "In Progress" | "In Review" | "Done";

export const TASK_COLUMNS: UiColumn[] = ["To Do", "In Progress", "In Review", "Done"];

export const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-[#fee2e2] text-[#dc2626]",
  Medium: "bg-[#fff7ed] text-[#f54900]",
  Low: "bg-[#f3f4f6] text-[#6a7282]",
};

export const SOURCE_COLORS: Record<string, string> = {
  Chat: "bg-[#e0f2fe] text-[#0284c7]",
  Script: "bg-[#dcfce7] text-[#16a34a]",
  AI: "bg-[#faf5ff] text-[#9810fa]",
  "Video Report": "bg-[#fef3c7] text-[#d97706]",
  "Project Progress": "bg-[#f3f4f6] text-[#6a7282]",
};

export const COLUMN_COLORS: Record<UiColumn, string> = {
  "To Do": "#6a7282",
  "In Progress": "#0ea5e9",
  "In Review": "#9810fa",
  Done: "#16a34a",
};

export function toUiColumn(stage: WorkflowStage): UiColumn {
  if (stage === "Production") return "In Progress";
  if (stage === "Review") return "In Review";
  if (stage === "Publish") return "Done";
  return "To Do";
}

export function defaultStageForColumn(column: UiColumn): WorkflowStage {
  if (column === "In Progress") return "Production";
  if (column === "In Review") return "Review";
  if (column === "Done") return "Publish";
  return "Idea";
}

export function inferPriority(item: WorkflowItem): "High" | "Medium" | "Low" {
  if (!item.due_date) return "Medium";
  const due = new Date(`${item.due_date}T00:00:00`);
  const today = new Date();
  const ms = due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 1) return "High";
  if (days <= 4) return "Medium";
  return "Low";
}

export function inferSource(
  item: WorkflowItem,
): "Chat" | "Script" | "AI" | "Video Report" | "Project Progress" {
  const linked = (item.linked_trend ?? "").toLowerCase();
  if (linked.includes("chat")) return "Chat";
  if (linked.includes("script")) return "Script";
  if (linked.includes("video") || linked.includes("report")) return "Video Report";
  if (linked.includes("progress")) return "Project Progress";
  return "AI";
}

/** Date used to place a task on the month calendar (due date preferred). */
export function taskCalendarIso(item: WorkflowItem): string | null {
  if (item.due_date) return item.due_date;
  if (item.scheduled_start) return item.scheduled_start.slice(0, 10);
  return null;
}
