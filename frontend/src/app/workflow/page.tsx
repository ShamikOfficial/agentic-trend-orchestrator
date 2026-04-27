"use client";

import { FormEvent, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  createWorkflowItem,
  deleteWorkflowItem,
  listWorkflowActivityLogs,
  listWorkflowItems,
  uploadWorkflowAttachment,
  updateWorkflowItem,
  updateWorkflowStage,
} from "@/lib/workflow-api";
import type { WorkflowActivityLog, WorkflowItem, WorkflowStage } from "@/types/api";

const stages: WorkflowStage[] = ["Idea", "Brief", "Production", "Review", "Publish"];
const stageTheme: Record<
  WorkflowStage,
  {
    column: string;
    badge: string;
    select: string;
    accent: string;
  }
> = {
  Idea: {
    column: "border-sky-200 bg-sky-50/70",
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    select: "border-sky-300 bg-sky-100/80 text-sky-800",
    accent: "border-sky-400",
  },
  Brief: {
    column: "border-violet-200 bg-violet-50/70",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    select: "border-violet-300 bg-violet-100/80 text-violet-800",
    accent: "border-violet-400",
  },
  Production: {
    column: "border-amber-200 bg-amber-50/80",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    select: "border-amber-300 bg-amber-100/80 text-amber-900",
    accent: "border-amber-500",
  },
  Review: {
    column: "border-fuchsia-200 bg-fuchsia-50/80",
    badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    select: "border-fuchsia-300 bg-fuchsia-100/80 text-fuchsia-900",
    accent: "border-fuchsia-500",
  },
  Publish: {
    column: "border-emerald-200 bg-emerald-50/80",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    select: "border-emerald-300 bg-emerald-100/80 text-emerald-900",
    accent: "border-emerald-500",
  },
};

export default function WorkflowPage() {
  const [activeTab, setActiveTab] = useState<"create" | "dashboard" | "logs">("create");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [project, setProject] = useState("General");
  const [linkedTrend, setLinkedTrend] = useState("");
  const [stage, setStage] = useState<WorkflowStage>("Idea");
  const [dueDate, setDueDate] = useState("");
  const [commentsInput, setCommentsInput] = useState("");
  const [linksInput, setLinksInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<WorkflowActivityLog[]>([]);
  const [editingItemId, setEditingItemId] = useState<string>("");
  const [editTitle, setEditTitle] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editProject, setEditProject] = useState("General");
  const [editDescription, setEditDescription] = useState("");
  const [editLinkedTrend, setEditLinkedTrend] = useState("");
  const [editStage, setEditStage] = useState<WorkflowStage>("Idea");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCommentsInput, setEditCommentsInput] = useState("");
  const [editLinksInput, setEditLinksInput] = useState("");
  const [editAttachments, setEditAttachments] = useState<string[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<WorkflowStage | null>(null);
  const [flashMessage, setFlashMessage] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);

  async function refreshBoard() {
    const response = await listWorkflowItems();
    setItems(response.items);
  }

  async function refreshLogs() {
    const response = await listWorkflowActivityLogs();
    setActivityLogs(response.items);
  }

  async function handleCreateItem(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setFlashMessage("Title is required.");
      return;
    }
    setIsBusy(true);
    try {
      await createWorkflowItem({
        title: title.trim(),
        description: description.trim(),
        owner: owner.trim() || undefined,
        project: project.trim() || "General",
        linked_trend: linkedTrend.trim() || undefined,
        stage,
        due_date: dueDate || undefined,
        comments: commentsInput
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        links: linksInput
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        attachments,
      });
      setTitle("");
      setDescription("");
      setOwner("");
      setProject("General");
      setLinkedTrend("");
      setStage("Idea");
      setDueDate("");
      setCommentsInput("");
      setLinksInput("");
      setAttachments([]);
      await refreshBoard();
      await refreshLogs();
      setFlashMessage("Workflow item created.");
      setActiveTab("dashboard");
    } catch (error) {
      setFlashMessage(`Create failed: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStageChange(item: WorkflowItem, toStage: WorkflowStage) {
    if (item.stage === toStage) {
      return;
    }
    setIsBusy(true);
    try {
      await updateWorkflowStage(item.item_id, {
        to_stage: toStage,
        note: "Stage changed from workflow board dashboard.",
      });
      await refreshBoard();
      await refreshLogs();
      setFlashMessage(`Moved "${item.title}" to ${toStage}.`);
    } catch (error) {
      setFlashMessage(`Stage update failed: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(itemId: string) {
    setIsBusy(true);
    try {
      await deleteWorkflowItem(itemId);
      await refreshBoard();
      await refreshLogs();
      setFlashMessage("Workflow item deleted.");
    } catch (error) {
      setFlashMessage(`Delete failed: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  function beginEdit(item: WorkflowItem) {
    setEditingItemId(item.item_id);
    setEditTitle(item.title);
    setEditOwner(item.owner ?? "");
    setEditProject(item.project ?? "General");
    setEditDescription(item.description ?? "");
    setEditLinkedTrend(item.linked_trend ?? "");
    setEditStage(item.stage);
    setEditDueDate(item.due_date ?? "");
    setEditCommentsInput((item.comments ?? []).join("\n"));
    setEditLinksInput((item.links ?? []).join("\n"));
    setEditAttachments(item.attachments ?? []);
  }

  async function handleCreateUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const response = await uploadWorkflowAttachment(file);
        uploaded.push(response.url);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
      setFlashMessage("Files uploaded.");
    } catch (error) {
      setFlashMessage(`Upload failed: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEditUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const response = await uploadWorkflowAttachment(file);
        uploaded.push(response.url);
      }
      setEditAttachments((prev) => [...prev, ...uploaded]);
      setFlashMessage("Files uploaded.");
    } catch (error) {
      setFlashMessage(`Upload failed: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  function onDragStart(itemId: string) {
    setDraggedItemId(itemId);
  }

  function onDragEnd() {
    setDraggedItemId(null);
    setDropStage(null);
  }

  async function onDropStage(stage: WorkflowStage) {
    if (!draggedItemId) {
      return;
    }
    const item = items.find((entry) => entry.item_id === draggedItemId);
    if (!item) {
      return;
    }
    await handleStageChange(item, stage);
    onDragEnd();
  }

  async function handleSaveEdit() {
    if (!editingItemId) {
      return;
    }
    setIsBusy(true);
    try {
      const existing = items.find((entry) => entry.item_id === editingItemId);
      if (existing && existing.stage !== editStage) {
        await updateWorkflowStage(editingItemId, {
          to_stage: editStage,
          note: "Stage updated from edit popup.",
        });
      }
      await updateWorkflowItem(editingItemId, {
        title: editTitle.trim() || undefined,
        owner: editOwner.trim() || undefined,
        project: editProject.trim() || "General",
        description: editDescription,
        linked_trend: editLinkedTrend.trim() || undefined,
        due_date: editDueDate || undefined,
        comments: editCommentsInput
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        links: editLinksInput
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        attachments: editAttachments,
      });
      await refreshBoard();
      await refreshLogs();
      setEditingItemId("");
      setFlashMessage("Workflow item updated.");
    } catch (error) {
      setFlashMessage(`Update failed: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  const itemsByStage = stages.map((stage) => ({
    stage,
    items: items.filter((item) => item.stage === stage),
  }));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Workflow Management</h1>
        <p className="text-muted-foreground">
          Plan, track, and manage work items with structured metadata and stage transitions.
        </p>
      </section>

      <section className="flex gap-2">
        <button
          className={buttonVariants({ variant: activeTab === "create" ? "default" : "outline" })}
          type="button"
          onClick={() => setActiveTab("create")}
        >
          Create Work Item
        </button>
        <button
          className={buttonVariants({ variant: activeTab === "dashboard" ? "default" : "outline" })}
          type="button"
          onClick={() => {
            setActiveTab("dashboard");
            void refreshBoard();
          }}
        >
          Dashboard
        </button>
        <button
          className={buttonVariants({ variant: activeTab === "logs" ? "default" : "outline" })}
          type="button"
          onClick={() => {
            setActiveTab("logs");
            void refreshLogs();
          }}
        >
          Logs
        </button>
      </section>

      {activeTab === "create" ? (
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Create Work Item</h2>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateItem}>
            <label className="space-y-2">
              <span className="text-sm font-medium">Title</span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Define work item title"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Owner</span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="Assignee name"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Project</span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={project}
                onChange={(event) => setProject(event.target.value)}
                placeholder="Project name"
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Description</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Detailed context, acceptance criteria, expected outcome"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Stage</span>
              <select
                className={`h-11 w-full rounded-md border px-3 text-sm font-semibold ${stageTheme[stage].select}`}
                value={stage}
                onChange={(event) => setStage(event.target.value as WorkflowStage)}
              >
                {stages.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Due Date</span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Linked Context</span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={linkedTrend}
                onChange={(event) => setLinkedTrend(event.target.value)}
                placeholder="Related trend, epic, or module"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Created On</span>
              <input
                className="h-11 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground"
                value={new Date().toLocaleDateString()}
                readOnly
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Comments (one per line)</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                value={commentsInput}
                onChange={(event) => setCommentsInput(event.target.value)}
                placeholder="Initial notes, clarifications, or review comments"
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Links (one URL per line)</span>
              <textarea
                className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                value={linksInput}
                onChange={(event) => setLinksInput(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Media / Docs Upload</span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
                type="file"
                multiple
                onChange={(event) => void handleCreateUpload(event.target.files)}
              />
              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((fileUrl) => (
                    <span key={fileUrl} className="rounded bg-muted px-2 py-1 text-xs">
                      {fileUrl}
                    </span>
                  ))}
                </div>
              ) : null}
            </label>
            <div className="flex gap-2 md:col-span-2">
              <button className={buttonVariants()} type="submit" disabled={isBusy}>
                Save Work Item
              </button>
              <button
                className={buttonVariants({ variant: "outline" })}
                type="button"
                onClick={() => {
                  setTitle("");
                  setDescription("");
                  setOwner("");
                  setProject("General");
                  setLinkedTrend("");
                  setDueDate("");
                  setCommentsInput("");
                  setLinksInput("");
                  setAttachments([]);
                  setStage("Idea");
                }}
                disabled={isBusy}
              >
                Clear
              </button>
            </div>
          </form>
          <p className="mt-3 text-sm text-muted-foreground">{flashMessage || "Ready."}</p>
        </section>
      ) : null}

      {activeTab === "dashboard" ? (
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Workflow Board</h2>
            <button
              className={buttonVariants({ variant: "outline" })}
              type="button"
              onClick={() => void refreshBoard()}
              disabled={isBusy}
            >
              Refresh Board
            </button>
          </div>
          <p className="mb-2 text-sm text-muted-foreground">{flashMessage || "Ready."}</p>

          <section className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {itemsByStage.map(({ stage, items: stageItems }) => (
                <article
                  key={stage}
                  className={`h-[70vh] min-h-[560px] w-[320px] rounded-xl border p-4 shadow-sm transition-colors md:w-[360px] ${stageTheme[stage].column} ${dropStage === stage ? stageTheme[stage].accent : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropStage(stage);
                  }}
                  onDragLeave={() => setDropStage((current) => (current === stage ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    void onDropStage(stage);
                  }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{stage}</h3>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${stageTheme[stage].badge}`}>
                      {stageItems.length} items
                    </span>
                  </div>
                  <div className="h-[calc(70vh-100px)] min-h-[450px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                      {stageItems.map((item) => (
                        <div
                          key={item.item_id}
                          className={`rounded-lg border bg-background p-2 shadow-sm ${draggedItemId === item.item_id ? "opacity-60" : ""}`}
                          draggable
                          onDragStart={() => onDragStart(item.item_id)}
                          onDragEnd={onDragEnd}
                        >
                          <p className="truncate text-xs font-semibold">{item.title}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {item.owner || "Unassigned"}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {item.project || "General"} •{" "}
                            {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                          </p>
                          <div className="mt-2 flex flex-col gap-1">
                            <select
                              className={`h-8 w-full rounded-md border px-2 text-[11px] font-semibold ${stageTheme[item.stage].select}`}
                              value={item.stage}
                              onChange={(event) => void handleStageChange(item, event.target.value as WorkflowStage)}
                              onClick={(event) => event.stopPropagation()}
                              disabled={isBusy}
                            >
                              {stages.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-1">
                              <button
                                className={buttonVariants({ variant: "outline", size: "xs" })}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  beginEdit(item);
                                }}
                                disabled={isBusy}
                              >
                                Edit
                              </button>
                              <button
                                className={buttonVariants({ variant: "destructive", size: "xs" })}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDelete(item.item_id);
                                }}
                                disabled={isBusy}
                              >
                                Del
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {stageItems.length === 0 ? (
                      <p className="rounded-lg border border-dashed bg-white/60 p-4 text-sm text-muted-foreground">
                        Drop workflow items here
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "logs" ? (
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Activity Logs</h2>
            <button
              className={buttonVariants({ variant: "outline" })}
              type="button"
              onClick={() => void refreshLogs()}
              disabled={isBusy}
            >
              Refresh Logs
            </button>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Captures all workflow changes for the default single user.
          </p>
          <div className="max-h-[65vh] overflow-auto rounded-lg border">
            {activityLogs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No activity logged yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Details</th>
                    <th className="px-3 py-2">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((log) => (
                    <tr key={log.log_id} className="border-t">
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-medium">{log.action}</td>
                      <td className="px-3 py-2">{log.item_title || log.item_id || "-"}</td>
                      <td className="px-3 py-2">{log.details}</td>
                      <td className="px-3 py-2">{log.actor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}

      {editingItemId ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-lg border bg-card shadow-xl">
            <h2 className="mb-3 font-semibold">Edit Workflow Item</h2>
            <div className="max-h-[75vh] overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Title</span>
                  <input
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Owner</span>
                  <input
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                    value={editOwner}
                    onChange={(event) => setEditOwner(event.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Project</span>
                  <input
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                    value={editProject}
                    onChange={(event) => setEditProject(event.target.value)}
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium">Description</span>
                  <textarea
                    className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Stage</span>
                  <select
                    className={`h-11 w-full rounded-md border px-3 text-sm font-semibold ${stageTheme[editStage].select}`}
                    value={editStage}
                    onChange={(event) => setEditStage(event.target.value as WorkflowStage)}
                  >
                    {stages.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Due Date</span>
                  <input
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                    type="date"
                    value={editDueDate}
                    onChange={(event) => setEditDueDate(event.target.value)}
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium">Linked Context</span>
                  <input
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                    value={editLinkedTrend}
                    onChange={(event) => setEditLinkedTrend(event.target.value)}
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium">Comments (one per line)</span>
                  <textarea
                    className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                    value={editCommentsInput}
                    onChange={(event) => setEditCommentsInput(event.target.value)}
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium">Links (one per line)</span>
                  <textarea
                    className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                    value={editLinksInput}
                    onChange={(event) => setEditLinksInput(event.target.value)}
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium">Media / Docs Upload</span>
                  <input
                    className="h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    type="file"
                    multiple
                    onChange={(event) => void handleEditUpload(event.target.files)}
                  />
                  {editAttachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {editAttachments.map((fileUrl) => (
                        <span key={fileUrl} className="rounded bg-muted px-2 py-1 text-xs">
                          {fileUrl}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </label>
              </div>
            </div>
            <div className="border-t p-5">
              <div className="flex gap-2">
              <button className={buttonVariants()} type="button" onClick={() => void handleSaveEdit()} disabled={isBusy}>
                Save
              </button>
              <button
                className={buttonVariants({ variant: "outline" })}
                type="button"
                onClick={() => setEditingItemId("")}
                disabled={isBusy}
              >
                Cancel
              </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
