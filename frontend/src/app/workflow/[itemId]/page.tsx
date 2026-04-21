"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getWorkflowItem, updateWorkflowItem } from "@/lib/workflow-api";
import type { WorkflowItem, WorkflowStage } from "@/types/api";

const stages: WorkflowStage[] = ["Idea", "Brief", "Production", "Review", "Publish"];

export default function WorkflowItemDetailPage() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId;

  const [item, setItem] = useState<WorkflowItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [linkedTrend, setLinkedTrend] = useState("");
  const [stage, setStage] = useState<WorkflowStage>("Idea");
  const [dueDate, setDueDate] = useState("");
  const [commentsInput, setCommentsInput] = useState("");
  const [linksInput, setLinksInput] = useState("");
  const [message, setMessage] = useState("Loading...");
  const [isBusy, setIsBusy] = useState(false);

  async function loadItem() {
    try {
      const response = await getWorkflowItem(itemId);
      setItem(response);
      setTitle(response.title);
      setDescription(response.description ?? "");
      setOwner(response.owner ?? "");
      setLinkedTrend(response.linked_trend ?? "");
      setStage(response.stage);
      setDueDate(response.due_date ?? "");
      setCommentsInput((response.comments ?? []).join("\n"));
      setLinksInput((response.links ?? []).join("\n"));
      setMessage("");
    } catch (error) {
      setMessage(`Failed to load item: ${String(error)}`);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    try {
      await updateWorkflowItem(itemId, {
        title: title.trim() || undefined,
        description,
        owner: owner.trim() || undefined,
        linked_trend: linkedTrend.trim() || undefined,
        due_date: dueDate || undefined,
        comments: commentsInput
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        links: linksInput
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      });
      setMessage("Saved successfully.");
      await loadItem();
    } catch (error) {
      setMessage(`Save failed: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  if (!item && message.startsWith("Loading")) {
    return <main className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">{message}</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Work Item Details</h1>
        <p className="text-sm text-muted-foreground">{itemId}</p>
      </section>

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSave}>
          <label className="space-y-2">
            <span className="text-sm font-medium">Title</span>
            <input className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Owner</span>
            <input className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={owner} onChange={(event) => setOwner(event.target.value)} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Description</span>
            <textarea className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Stage</span>
            <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={stage} onChange={(event) => setStage(event.target.value as WorkflowStage)} disabled>
              {stages.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Due Date</span>
            <input className="h-11 w-full rounded-md border bg-background px-3 text-sm" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Linked Context</span>
            <input className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={linkedTrend} onChange={(event) => setLinkedTrend(event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Created On</span>
            <input className="h-11 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground" value={item?.created_at ? new Date(item.created_at).toLocaleString() : "-"} readOnly />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Comments (one per line)</span>
            <textarea className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" value={commentsInput} onChange={(event) => setCommentsInput(event.target.value)} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Links (one per line)</span>
            <textarea className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" value={linksInput} onChange={(event) => setLinksInput(event.target.value)} />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button className={buttonVariants()} type="submit" disabled={isBusy}>
              Save Changes
            </button>
            <button className={buttonVariants({ variant: "outline" })} type="button" onClick={() => window.close()}>
              Close Tab
            </button>
          </div>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">{message || "Ready."}</p>
      </section>
    </main>
  );
}
