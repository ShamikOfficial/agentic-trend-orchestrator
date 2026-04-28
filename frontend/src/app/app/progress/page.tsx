"use client";

import { useEffect, useMemo, useState } from "react";
import { listWorkflowActivityLogs, listWorkflowItems } from "@/lib/workflow-api";
import type { WorkflowActivityLog, WorkflowItem } from "@/types/api";

type ProjectProgress = {
  project: string;
  total: number;
  done: number;
  inFlight: number;
  overdue: number;
  progressPercent: number;
};

function inProgressStage(stage: WorkflowItem["stage"]) {
  return stage === "Brief" || stage === "Production" || stage === "Review";
}

export default function ProjectProgressPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [logs, setLogs] = useState<WorkflowActivityLog[]>([]);
  const [flashMessage, setFlashMessage] = useState("Loading project progress...");
  const [selectedProject, setSelectedProject] = useState("All Projects");

  useEffect(() => {
    void (async () => {
      try {
        const [itemsResponse, logsResponse] = await Promise.all([
          listWorkflowItems(),
          listWorkflowActivityLogs(),
        ]);
        setItems(itemsResponse.items);
        setLogs(logsResponse.items);
        setFlashMessage("Project progress loaded.");
      } catch (error) {
        setFlashMessage(`Unable to load project progress: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
  }, []);

  const projects = useMemo(() => {
    const names = Array.from(new Set(items.map((item) => item.project || "General"))).sort((a, b) =>
      a.localeCompare(b),
    );
    return ["All Projects", ...names];
  }, [items]);

  const projectSummary = useMemo(() => {
    const map = new Map<string, WorkflowItem[]>();
    const todayIso = new Date().toISOString().slice(0, 10);

    for (const item of items) {
      const project = item.project || "General";
      if (!map.has(project)) map.set(project, []);
      map.get(project)?.push(item);
    }

    const list: ProjectProgress[] = [];
    for (const [project, projectItems] of map.entries()) {
      const total = projectItems.length;
      const done = projectItems.filter((item) => item.stage === "Publish").length;
      const inFlight = projectItems.filter((item) => inProgressStage(item.stage)).length;
      const overdue = projectItems.filter(
        (item) => item.due_date && item.stage !== "Publish" && item.due_date < todayIso,
      ).length;
      const progressPercent = total ? Math.round((done / total) * 100) : 0;
      list.push({ project, total, done, inFlight, overdue, progressPercent });
    }

    return list.sort((a, b) => b.progressPercent - a.progressPercent);
  }, [items]);

  const visibleSummary = useMemo(() => {
    if (selectedProject === "All Projects") return projectSummary;
    return projectSummary.filter((row) => row.project === selectedProject);
  }, [projectSummary, selectedProject]);

  const visibleItems = useMemo(() => {
    if (selectedProject === "All Projects") return items;
    return items.filter((item) => (item.project || "General") === selectedProject);
  }, [items, selectedProject]);

  function showDevNotice(feature: string) {
    setFlashMessage(`${feature} is in development (backend link is not available yet).`);
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-[#0f172a]">Project Progress</h1>
        <p className="mt-2 text-sm text-[#64748b]">
          Progress is calculated from workflow task stages. Missing deep links are available as development placeholders.
        </p>

        <section className="mt-5 flex flex-wrap gap-2">
          {projects.map((project) => (
            <button
              key={project}
              type="button"
              onClick={() => setSelectedProject(project)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                selectedProject === project
                  ? "border-[#0f172a] bg-[#0f172a] text-white"
                  : "border-[#cbd5e1] bg-white text-[#334155]"
              }`}
            >
              {project}
            </button>
          ))}
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleSummary.length ? (
            visibleSummary.map((row) => (
              <article key={row.project} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#0f172a]">{row.project}</h2>
                  <span className="text-xs font-semibold text-[#64748b]">{row.progressPercent}% complete</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[#e2e8f0]">
                  <div className="h-2 rounded-full bg-[#22c55e]" style={{ width: `${row.progressPercent}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#334155]">
                  <p>Total: {row.total}</p>
                  <p>Done: {row.done}</p>
                  <p>In progress: {row.inFlight}</p>
                  <p>Overdue: {row.overdue}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-[#cbd5e1] bg-white p-4 text-sm text-[#64748b]">
              No project data available.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0f172a]">Tasks Snapshot</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => showDevNotice("Open linked report")}
                className="rounded-lg border border-[#cbd5e1] px-3 py-1.5 text-xs font-semibold text-[#334155]"
              >
                Open Linked Report
              </button>
              <button
                type="button"
                onClick={() => showDevNotice("Open linked upload")}
                className="rounded-lg border border-[#cbd5e1] px-3 py-1.5 text-xs font-semibold text-[#334155]"
              >
                Open Linked Upload
              </button>
            </div>
          </div>
          <div className="max-h-[350px] overflow-auto rounded-lg border border-[#e2e8f0]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#f8fafc]">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.item_id} className="border-t border-[#f1f5f9]">
                    <td className="px-3 py-2 text-[#0f172a]">{item.title}</td>
                    <td className="px-3 py-2 text-[#334155]">{item.project || "General"}</td>
                    <td className="px-3 py-2 text-[#334155]">{item.stage}</td>
                    <td className="px-3 py-2 text-[#334155]">{item.due_date || "-"}</td>
                  </tr>
                ))}
                {visibleItems.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-[#64748b]" colSpan={4}>
                      No tasks for this selection.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#0f172a]">Recent Activity</h2>
          <p className="text-xs text-[#64748b]">Wired from backend `/workflow/logs`.</p>
          <div className="mt-3 space-y-2">
            {logs.slice(0, 8).map((log) => (
              <div key={log.log_id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                <p className="text-xs font-semibold text-[#0f172a]">{log.action}</p>
                <p className="text-xs text-[#334155]">{log.item_title || log.item_id || "Workflow item"}</p>
                <p className="text-[11px] text-[#64748b]">{new Date(log.created_at).toLocaleString()}</p>
              </div>
            ))}
            {logs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#cbd5e1] p-3 text-xs text-[#64748b]">
                No activity logs available.
              </p>
            ) : null}
          </div>
        </section>

        <p className="mt-4 text-xs text-[#64748b]">{flashMessage}</p>
      </div>
    </main>
  );
}
