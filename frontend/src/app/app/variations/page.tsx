"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { summarizeTeamContent } from "@/lib/team-api";

export default function ScriptVariationsPage() {
  const [baseScript, setBaseScript] = useState("");
  const [tone, setTone] = useState("Professional");
  const [variation, setVariation] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [flashMessage, setFlashMessage] = useState("Ready.");

  async function generateVariation(event: FormEvent) {
    event.preventDefault();
    if (!baseScript.trim()) {
      setFlashMessage("Base script is required.");
      return;
    }
    setIsBusy(true);
    try {
      const response = await summarizeTeamContent({
        source_type: "chat",
        title: "Script Variation",
        content: `Rewrite the following script in ${tone} tone:\n\n${baseScript}`,
      });
      setVariation(response.summary || "No variation returned.");
      setFlashMessage("Variation generated.");
    } catch (error) {
      setFlashMessage(`Variation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Script Variations</h1>
        <p className="mt-1 text-sm text-[#64748b]">Generate simple tone-based script alternatives.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/app/editor" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#364153]">
            Back to Editor
          </Link>
          <Link href="/app/storyboard" className="rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-semibold text-white">
            Go to Storyboard
          </Link>
        </div>

        <form onSubmit={generateVariation} className="mt-5 space-y-3">
          <select
            value={tone}
            onChange={(event) => setTone(event.target.value)}
            className="h-10 w-full rounded-lg border border-[#cbd5e1] px-3 text-sm"
          >
            <option>Professional</option>
            <option>Friendly</option>
            <option>Energetic</option>
            <option>Humorous</option>
          </select>
          <textarea
            value={baseScript}
            onChange={(event) => setBaseScript(event.target.value)}
            placeholder="Paste your base script..."
            className="min-h-44 w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isBusy ? "Generating..." : "Generate Variation"}
          </button>
        </form>

        <pre className="mt-6 whitespace-pre-wrap rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs text-[#334155]">
          {variation || "No variation yet."}
        </pre>

        <p className="mt-4 rounded-lg border border-[#fde68a] bg-[#fefce8] px-3 py-2 text-xs text-[#854d0e]">
          Feature in development: multi-variation batch generation and side-by-side compare view.
        </p>
        <p className="mt-3 text-xs text-[#64748b]">{flashMessage}</p>
      </div>
    </main>
  );
}
