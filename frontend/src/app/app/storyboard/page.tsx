"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type StoryScene = {
  id: string;
  heading: string;
  visual: string;
  voiceover: string;
};

export default function StoryboardPage() {
  const [script, setScript] = useState("");
  const [scenes, setScenes] = useState<StoryScene[]>([]);
  const [flashMessage, setFlashMessage] = useState("Ready.");

  function generateScenes(event: FormEvent) {
    event.preventDefault();
    if (!script.trim()) {
      setFlashMessage("Paste script lines first.");
      return;
    }
    const lines = script
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);
    setScenes(
      lines.map((line, index) => ({
        id: `scene-${index + 1}`,
        heading: `Scene ${index + 1}`,
        visual: `Visual concept for: ${line}`,
        voiceover: line,
      })),
    );
    setFlashMessage("Storyboard draft created locally.");
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-5xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Storyboard</h1>
        <p className="mt-1 text-sm text-[#64748b]">Create scene cards from script lines.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/app/editor" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#364153]">
            Back to Editor
          </Link>
          <Link href="/app/save" className="rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-semibold text-white">
            Save Project
          </Link>
        </div>

        <form onSubmit={generateScenes} className="mt-5">
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            placeholder="Paste script, one sentence per line for best results."
            className="min-h-36 w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm"
          />
          <button type="submit" className="mt-3 rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white">
            Generate Scenes
          </button>
        </form>

        <section className="mt-6 grid gap-3 md:grid-cols-2">
          {scenes.length ? (
            scenes.map((scene) => (
              <article key={scene.id} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <h2 className="text-sm font-bold text-[#0f172a]">{scene.heading}</h2>
                <p className="mt-2 text-xs text-[#334155]">
                  <span className="font-semibold">Visual:</span> {scene.visual}
                </p>
                <p className="mt-1 text-xs text-[#334155]">
                  <span className="font-semibold">Voiceover:</span> {scene.voiceover}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-[#cbd5e1] p-4 text-sm text-[#64748b]">
              No storyboard scenes yet.
            </p>
          )}
        </section>

        <p className="mt-4 rounded-lg border border-[#fde68a] bg-[#fefce8] px-3 py-2 text-xs text-[#854d0e]">
          Feature in development: shot list generation, frame thumbnails, and timeline export.
        </p>
        <p className="mt-3 text-xs text-[#64748b]">{flashMessage}</p>
      </div>
    </main>
  );
}
