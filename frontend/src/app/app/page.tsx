"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listWorkflowItems } from "@/lib/workflow-api";
import type { WorkflowItem } from "@/types/api";

export default function ScriptHomePage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [flashMessage, setFlashMessage] = useState("Loading dashboard...");

  useEffect(() => {
    void (async () => {
      try {
        const response = await listWorkflowItems();
        setItems(response.items.slice(0, 6));
        setFlashMessage("Dashboard ready.");
      } catch (error) {
        setFlashMessage(`Workflow feed unavailable: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
  }, []);

  const quickLinks = [
    { label: "Script Brief", href: "/app/brief" },
    { label: "Script Editor", href: "/app/editor" },
    { label: "Script Variations", href: "/app/variations" },
    { label: "Storyboard", href: "/app/storyboard" },
    { label: "Project Progress", href: "/app/progress" },
    { label: "Save Project", href: "/app/save" },
  ];
  const chatFlowLinks = [
    { label: "Open Chat", href: "/app/chat" },
    { label: "Script from Chat", href: "/app/chat-brief" },
    { label: "Extract Tasks", href: "/app/chat-tasks" },
    { label: "Sync to Progress", href: "/app/progress" },
  ];

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-[#0f172a]">Script Home</h1>
        <p className="mt-2 text-sm text-[#64748b]">
          Start your script workflow from brief to save. Missing backend actions show a development notice.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:border-[#0f172a]"
            >
              {item.label}
            </Link>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#0f172a]">Group Chat Sync Actions</h2>
          <p className="text-xs text-[#64748b]">Wired to the same screen flow as the provided Figma prototype.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chatFlowLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-semibold text-[#364153] transition hover:bg-[#f3f4f6]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#0f172a]">Recent Workflow Items</h2>
          <p className="text-xs text-[#64748b]">Data wired from backend `/workflow/items`.</p>
          <div className="mt-4 space-y-2">
            {items.length ? (
              items.map((item) => (
                <div key={item.item_id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                  <p className="text-sm font-semibold text-[#0f172a]">{item.title}</p>
                  <p className="text-xs text-[#64748b]">
                    Stage: {item.stage} | Project: {item.project || "General"}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[#cbd5e1] p-4 text-sm text-[#64748b]">
                No workflow items available yet.
              </p>
            )}
          </div>
        </section>

        <p className="mt-4 text-xs text-[#64748b]">{flashMessage}</p>
      </div>
    </main>
  );
}
