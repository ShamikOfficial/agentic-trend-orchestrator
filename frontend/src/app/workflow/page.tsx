"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart2,
  Calendar,
  CheckSquare,
  Clock,
  ExternalLink,
  MessageSquare,
  RotateCcw,
  X,
} from "lucide-react";
import {
  createWorkflowItem,
  listWorkflowActivityLogs,
  listWorkflowItems,
  updateWorkflowStage,
} from "@/lib/workflow-api";
import type { WorkflowActivityLog, WorkflowItem, WorkflowStage } from "@/types/api";

type UiColumn = "To Do" | "In Progress" | "In Review" | "Done";

const COLUMNS: UiColumn[] = ["To Do", "In Progress", "In Review", "Done"];
const STAGE_OPTIONS: WorkflowStage[] = ["Idea", "Brief", "Production", "Review", "Publish"];

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-[#fee2e2] text-[#dc2626]",
  Medium: "bg-[#fff7ed] text-[#f54900]",
  Low: "bg-[#f3f4f6] text-[#6a7282]",
};

const SOURCE_COLORS: Record<string, string> = {
  Chat: "bg-[#e0f2fe] text-[#0284c7]",
  Script: "bg-[#dcfce7] text-[#16a34a]",
  AI: "bg-[#faf5ff] text-[#9810fa]",
  "Video Report": "bg-[#fef3c7] text-[#d97706]",
  "Project Progress": "bg-[#f3f4f6] text-[#6a7282]",
};

function toUiColumn(stage: WorkflowStage): UiColumn {
  if (stage === "Production") return "In Progress";
  if (stage === "Review") return "In Review";
  if (stage === "Publish") return "Done";
  return "To Do";
}

function defaultStageForColumn(column: UiColumn): WorkflowStage {
  if (column === "In Progress") return "Production";
  if (column === "In Review") return "Review";
  if (column === "Done") return "Publish";
  return "Idea";
}

function inferPriority(item: WorkflowItem): "High" | "Medium" | "Low" {
  if (!item.due_date) return "Medium";
  const due = new Date(`${item.due_date}T00:00:00`);
  const today = new Date();
  const ms = due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 1) return "High";
  if (days <= 4) return "Medium";
  return "Low";
}

function inferSource(item: WorkflowItem): "Chat" | "Script" | "AI" | "Video Report" | "Project Progress" {
  const linked = (item.linked_trend ?? "").toLowerCase();
  if (linked.includes("chat")) return "Chat";
  if (linked.includes("script")) return "Script";
  if (linked.includes("video") || linked.includes("report")) return "Video Report";
  if (linked.includes("progress")) return "Project Progress";
  return "AI";
}

export default function WorkflowPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [logs, setLogs] = useState<WorkflowActivityLog[]>([]);
  const [selectedProject, setSelectedProject] = useState("All Projects");
  const [selectedGroup, setSelectedGroup] = useState("All Groups");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [detailDismissed, setDetailDismissed] = useState(false);
  const [detailTargetStage, setDetailTargetStage] = useState<WorkflowStage>("Idea");
  const [showLogs, setShowLogs] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createProject, setCreateProject] = useState("General");
  const [createOwner, setCreateOwner] = useState("");
  const [createDueDate, setCreateDueDate] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<UiColumn | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [flashMessage, setFlashMessage] = useState("");

  async function refreshItems() {
    const response = await listWorkflowItems();
    setItems(response.items);
  }

  async function refreshLogs() {
    const response = await listWorkflowActivityLogs();
    setLogs(response.items);
  }

  useEffect(() => {
    void (async () => {
      setIsBusy(true);
      try {
        await Promise.all([refreshItems(), refreshLogs()]);
      } catch (error) {
        setFlashMessage(`Load failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsBusy(false);
      }
    })();
  }, []);

  const projectFilters = useMemo(() => {
    const projects = Array.from(new Set(items.map((i) => i.project || "General"))).sort((a, b) => a.localeCompare(b));
    return ["All Projects", ...projects];
  }, [items]);

  const groupFilters = useMemo(() => {
    const owners = Array.from(new Set(items.map((i) => i.owner || "Unassigned"))).sort((a, b) => a.localeCompare(b));
    return ["All Groups", ...owners];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const project = item.project || "General";
      const owner = item.owner || "Unassigned";
      const projectOk = selectedProject === "All Projects" || project === selectedProject;
      const groupOk = selectedGroup === "All Groups" || owner === selectedGroup;
      return projectOk && groupOk;
    });
  }, [items, selectedProject, selectedGroup]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedItemId("");
      setDetailDismissed(false);
      return;
    }
    const exists = filteredItems.some((item) => item.item_id === selectedItemId);
    if (!exists && !detailDismissed) {
      setSelectedItemId(filteredItems[0].item_id);
    }
  }, [filteredItems, selectedItemId, detailDismissed]);

  const selectedItem = filteredItems.find((item) => item.item_id === selectedItemId) ?? null;
  useEffect(() => {
    if (selectedItem) {
      setDetailTargetStage(selectedItem.stage);
    }
  }, [selectedItem]);

  const summary = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const dueToday = filteredItems.filter((i) => i.due_date === todayIso).length;
    const inProgress = filteredItems.filter((i) => i.stage === "Production").length;
    const inReview = filteredItems.filter((i) => i.stage === "Review").length;
    const overdue = filteredItems.filter((i) => i.due_date && i.stage !== "Publish" && i.due_date < todayIso).length;
    return { dueToday, inProgress, inReview, overdue };
  }, [filteredItems]);

  const tasksByColumn = useMemo(() => {
    const grouped: Record<UiColumn, WorkflowItem[]> = {
      "To Do": [],
      "In Progress": [],
      "In Review": [],
      "Done": [],
    };
    for (const item of filteredItems) {
      grouped[toUiColumn(item.stage)].push(item);
    }
    return grouped;
  }, [filteredItems]);

  async function handleMoveToStage(item: WorkflowItem, toStage: WorkflowStage, note: string) {
    if (item.stage === toStage) {
      setFlashMessage(`Task is already in ${toStage}.`);
      return;
    }
    setIsBusy(true);
    try {
      await updateWorkflowStage(item.item_id, { to_stage: toStage, note });
      await Promise.all([refreshItems(), refreshLogs()]);
      setFlashMessage(`Task moved to ${toStage}.`);
    } catch (error) {
      setFlashMessage(`Update failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
      setDragOverColumn(null);
    }
  }

  async function handleMarkDone(item: WorkflowItem) {
    await handleMoveToStage(item, "Publish", "Marked as done from tasks UI.");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!createTitle.trim()) {
      setFlashMessage("Title is required.");
      return;
    }
    setIsBusy(true);
    try {
      await createWorkflowItem({
        title: createTitle.trim(),
        description: createDescription.trim(),
        project: createProject.trim() || "General",
        owner: createOwner.trim() || undefined,
        due_date: createDueDate || undefined,
        stage: "Idea",
      });
      setCreateTitle("");
      setCreateDescription("");
      setCreateProject("General");
      setCreateOwner("");
      setCreateDueDate("");
      setShowCreate(false);
      await Promise.all([refreshItems(), refreshLogs()]);
      setFlashMessage("Workflow item created.");
    } catch (error) {
      setFlashMessage(`Create failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  function showNoBackendNotice(feature: string) {
    setFlashMessage(`${feature} is a UI-only control for now (no backend endpoint yet).`);
  }

  return (
    <main className="min-h-full bg-[#f9fafb] px-8 py-7">
      <div className="mx-auto flex w-full max-w-[1500px] min-w-0 flex-col">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="mb-1 text-[32px] font-bold text-[#101828]">My Tasks</h1>
            <p className="text-[15px] text-[#6a7282]">Track all tasks assigned to you across projects and groups.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-xl border border-[#101828] bg-[#101828] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#1e293b]"
            >
              New Task
            </button>
            <button
              type="button"
              onClick={() => setShowLogs(true)}
              className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-2 text-[12px] font-semibold text-[#364153] transition-colors hover:bg-[#f3f4f6]"
            >
              Activity Log
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff7ed] text-[#f54900]"><Calendar size={16} /></div>
            <div><p className="text-[24px] font-extrabold text-[#f54900]">{summary.dueToday}</p><p className="text-[12px] text-[#6a7282]">Due today</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e0f2fe] text-[#0ea5e9]"><Clock size={16} /></div>
            <div><p className="text-[24px] font-extrabold text-[#0ea5e9]">{summary.inProgress}</p><p className="text-[12px] text-[#6a7282]">In progress</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faf5ff] text-[#9810fa]"><RotateCcw size={16} /></div>
            <div><p className="text-[24px] font-extrabold text-[#9810fa]">{summary.inReview}</p><p className="text-[12px] text-[#6a7282]">Waiting for review</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fee2e2] text-[#dc2626]"><AlertCircle size={16} /></div>
            <div><p className="text-[24px] font-extrabold text-[#dc2626]">{summary.overdue}</p><p className="text-[12px] text-[#6a7282]">Overdue</p></div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {projectFilters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSelectedProject(f)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                selectedProject === f
                  ? "border-[#101828] bg-[#101828] text-white"
                  : "border-[#e5e7eb] bg-white text-[#364153] hover:border-[#101828]"
              }`}
            >
              {f}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-[#e5e7eb]" />
          {groupFilters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSelectedGroup(f)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                selectedGroup === f
                  ? "border-[#9810fa] bg-[#9810fa] text-white"
                  : "border-[#e5e7eb] bg-white text-[#364153] hover:border-[#9810fa]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 gap-5">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 overflow-x-auto lg:grid-cols-4">
            {COLUMNS.map((column) => {
              const columnTasks = tasksByColumn[column];
              const colColor: Record<UiColumn, string> = {
                "To Do": "#6a7282",
                "In Progress": "#0ea5e9",
                "In Review": "#9810fa",
                "Done": "#16a34a",
              };
              return (
                <section
                  key={column}
                  className={`flex min-w-[220px] flex-col rounded-xl transition-colors ${dragOverColumn === column ? "bg-[#f3f4f6]/70" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverColumn(column);
                  }}
                  onDragLeave={() => setDragOverColumn((current) => (current === column ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    const itemId = draggedItemId;
                    setDraggedItemId(null);
                    setDragOverColumn(null);
                    if (!itemId) return;
                    const item = items.find((entry) => entry.item_id === itemId);
                    if (!item) return;
                    void handleMoveToStage(
                      item,
                      defaultStageForColumn(column),
                      `Dragged task to ${column} column.`,
                    );
                  }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[13px] font-bold" style={{ color: colColor[column] }}>{column}</span>
                    <span className="rounded-full bg-[#f3f4f6] px-1.5 py-0.5 text-[11px] font-semibold text-[#6a7282]">{columnTasks.length}</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    {columnTasks.map((task) => {
                      const priority = inferPriority(task);
                      const source = inferSource(task);
                      const due = task.due_date ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString() : "No due date";
                      const commentsCount = task.comments?.length ?? 0;
                      return (
                        <button
                          key={task.item_id}
                          type="button"
                          onClick={() => {
                            setSelectedItemId(task.item_id);
                            setDetailDismissed(false);
                          }}
                          draggable
                          onDragStart={() => setDraggedItemId(task.item_id)}
                          onDragEnd={() => {
                            setDraggedItemId(null);
                            setDragOverColumn(null);
                          }}
                          className={`w-full rounded-xl border bg-white p-3 text-left transition-colors ${
                            selectedItemId === task.item_id
                              ? "border-[#9810fa] shadow-sm"
                              : "border-[#e5e7eb] hover:border-[#d1d5db]"
                          }`}
                        >
                          <p className="mb-2 text-[12px] font-semibold leading-snug text-[#101828]">{task.title}</p>
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${PRIORITY_COLORS[priority]}`}>{priority}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${SOURCE_COLORS[source]}`}>{source}</span>
                          </div>
                          <p className="mb-1 text-[10px] font-medium text-[#9810fa]">{task.project || "General"}</p>
                          <p className="mb-2 text-[10px] text-[#9a9ea6]">{task.owner || "Unassigned"}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[#9a9ea6]"><Calendar size={10} /><span className="text-[10px]">{due}</span></div>
                            {commentsCount > 0 ? (
                              <div className="flex items-center gap-0.5 text-[#9a9ea6]"><MessageSquare size={10} /><span className="text-[10px]">{commentsCount}</span></div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                    {columnTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#d1d5db] bg-white px-3 py-5 text-[12px] text-[#9a9ea6]">No tasks</div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>

          {selectedItem ? (
            <aside className="sticky top-6 h-fit w-[268px] shrink-0 rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-[13px] font-bold leading-snug text-[#101828]">{selectedItem.title}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemId("");
                    setDetailDismissed(true);
                  }}
                  className="ml-2 shrink-0 text-[#9a9ea6] transition-colors hover:text-[#101828]"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[inferPriority(selectedItem)]}`}>{inferPriority(selectedItem)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SOURCE_COLORS[inferSource(selectedItem)]}`}>From {inferSource(selectedItem)}</span>
              </div>

              <p className="mb-4 text-[12px] leading-relaxed text-[#6a7282]">{selectedItem.description || "No description provided."}</p>

              <div className="mb-4 space-y-2 text-[12px]">
                <div><span className="text-[#9a9ea6]">Assignee: </span><span className="font-medium text-[#101828]">{selectedItem.owner || "Unassigned"}</span></div>
                <div><span className="text-[#9a9ea6]">Due: </span><span className="font-medium text-[#101828]">{selectedItem.due_date ? new Date(`${selectedItem.due_date}T00:00:00`).toLocaleDateString() : "No due date"}</span></div>
                <div><span className="text-[#9a9ea6]">Project: </span><span className="font-medium text-[#9810fa]">{selectedItem.project || "General"}</span></div>
                {selectedItem.linked_trend ? (
                  <div><span className="text-[#9a9ea6]">Linked: </span><span className="font-medium text-[#101828]">{selectedItem.linked_trend}</span></div>
                ) : null}
                <div className="flex items-center gap-1.5 rounded-lg bg-[#fef3c7] px-2 py-1">
                  <BarChart2 size={11} className="text-[#d97706]" />
                  <span className="text-[11px] font-semibold text-[#d97706]">Current stage: {selectedItem.stage}</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#f3f4f6] pt-3">
                <button
                  type="button"
                  onClick={() => void handleMarkDone(selectedItem)}
                  disabled={isBusy}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#101828] py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckSquare size={13} />
                  Mark as Done
                </button>
                <div className="space-y-1 rounded-xl border border-[#e5e7eb] p-2">
                  <label className="block text-[11px] font-semibold text-[#6a7282]">Change status</label>
                  <div className="flex gap-2">
                    <select
                      className="h-8 flex-1 rounded-lg border border-[#e5e7eb] bg-white px-2 text-[12px] text-[#101828]"
                      value={detailTargetStage}
                      onChange={(event) => setDetailTargetStage(event.target.value as WorkflowStage)}
                    >
                      {STAGE_OPTIONS.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isBusy || detailTargetStage === selectedItem.stage}
                      onClick={() => void handleMoveToStage(selectedItem, detailTargetStage, "Updated from task detail panel.")}
                      className="rounded-lg border border-[#101828] bg-[#101828] px-3 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Apply
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showNoBackendNotice("Open source chat")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#e5e7eb] py-2 text-[12px] font-medium text-[#364153] transition-colors hover:bg-[#f3f4f6]"
                >
                  <MessageSquare size={13} />
                  Open Source Chat
                </button>
                <button
                  type="button"
                  onClick={() => showNoBackendNotice("Open related script")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#e5e7eb] py-2 text-[12px] font-medium text-[#364153] transition-colors hover:bg-[#f3f4f6]"
                >
                  <ExternalLink size={13} />
                  Open Related Script
                </button>
              </div>
            </aside>
          ) : null}
        </div>

        <p className="mt-4 text-[12px] text-[#6a7282]">{isBusy ? "Working..." : flashMessage || "Ready."}</p>
      </div>

      {showCreate ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <form onSubmit={handleCreate} className="w-full max-w-[560px] rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-[20px] font-bold text-[#101828]">Create Task</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-[12px] text-[#364153]">Title
                <input className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-3 text-[13px]" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} />
              </label>
              <label className="text-[12px] text-[#364153]">Owner
                <input className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-3 text-[13px]" value={createOwner} onChange={(e) => setCreateOwner(e.target.value)} />
              </label>
              <label className="text-[12px] text-[#364153]">Project
                <input className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-3 text-[13px]" value={createProject} onChange={(e) => setCreateProject(e.target.value)} />
              </label>
              <label className="text-[12px] text-[#364153]">Due Date
                <input type="date" className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-3 text-[13px]" value={createDueDate} onChange={(e) => setCreateDueDate(e.target.value)} />
              </label>
              <label className="text-[12px] text-[#364153] md:col-span-2">Description
                <textarea className="mt-1 min-h-20 w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-[13px]" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-[#e5e7eb] px-4 py-2 text-[12px] font-semibold text-[#364153]" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" disabled={isBusy} className="rounded-xl border border-[#101828] bg-[#101828] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-60">Create</button>
            </div>
          </form>
        </section>
      ) : null}

      {showLogs ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[880px] rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[20px] font-bold text-[#101828]">Workflow Activity Log</h2>
              <button type="button" className="text-[#6a7282] hover:text-[#101828]" onClick={() => setShowLogs(false)}><X size={18} /></button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-[#e5e7eb]">
              {logs.length === 0 ? (
                <p className="p-4 text-[13px] text-[#6a7282]">No activity logs yet.</p>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-[#f9fafb]"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Details</th></tr></thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.log_id} className="border-t border-[#f3f4f6]">
                        <td className="px-3 py-2 text-[#6a7282]">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2 font-semibold text-[#101828]">{log.action}</td>
                        <td className="px-3 py-2 text-[#101828]">{log.item_title || log.item_id || "-"}</td>
                        <td className="px-3 py-2 text-[#364153]">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
