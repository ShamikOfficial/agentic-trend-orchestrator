"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listWorkflowItems } from "@/lib/workflow-api";

export default function VideoReportPage() {
  const [score, setScore] = useState(82);

  useEffect(() => {
    void (async () => {
      try {
        const response = await listWorkflowItems();
        const base = response.items.length ? 70 + Math.min(25, response.items.length) : 82;
        setScore(base);
      } catch {
        setScore(82);
      }
    })();
  }, []);

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Video Report</h1>
        <p className="mt-1 text-sm text-[#64748b]">Simple report panel connected to current workflow volume.</p>
        <div className="mt-5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
          <p className="text-sm text-[#64748b]">Current Viral Potential</p>
          <p className="text-4xl font-extrabold text-[#16a34a]">{score}/100</p>
          <p className="mt-2 text-xs text-[#64748b]">Feature in development: frame-level analytics and model breakdown.</p>
        </div>
        <div className="mt-5 flex gap-2">
          <Link href="/app/report-chat" className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#364153]">
            Share in Chat
          </Link>
          <Link href="/app/progress" className="rounded-lg border border-[#9810fa] bg-[#faf5ff] px-4 py-2 text-sm font-semibold text-[#9810fa]">
            Sync to Progress
          </Link>
          <Link href="/app/tasks" className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-semibold text-white">
            Create Tasks
          </Link>
        </div>
      </div>
    </main>
  );
}
