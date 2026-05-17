"use client";

import { FormEvent, useState } from "react";
import { getTrendClusters } from "@/lib/trend-api";

export default function TrendDetectionPage() {
  const [niche, setNiche] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [flash, setFlash] = useState("Type a niche and run trend detection.");
  const [data, setData] = useState<Awaited<ReturnType<typeof getTrendClusters>> | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!niche.trim()) {
      setFlash("Niche is required.");
      return;
    }
    setIsBusy(true);
    setFlash("Detecting trends from all clusters...");
    try {
      const response = await getTrendClusters(niche);
      setData(response);
      setFlash(
        response.clusters.length
          ? `Detected ${response.clusters.length} cluster(s).`
          : `No clusters found for niche "${niche.trim()}". Upload videos first.`,
      );
    } catch (error) {
      setFlash(error instanceof Error ? error.message : String(error));
      setData(null);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-2xl border border-[#e2e8f0] bg-gradient-to-br from-white to-[#f8fbff] p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[#0f172a]">Trend Detection</h1>
          <p className="mt-1 text-sm text-[#64748b]">Run cluster detection by niche and explore every detected cluster.</p>
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={niche}
              onChange={(event) => setNiche(event.target.value)}
              placeholder="Type niche (e.g. cooking)"
              className="h-10 flex-1 rounded-lg border border-[#cbd5e1] px-3 text-sm"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isBusy ? "Running..." : "Find Niche"}
            </button>
          </form>
          <p className="mt-3 text-xs text-[#64748b]">{flash}</p>
        </section>

        {data?.clusters.length ? (
          <section className="mt-6 space-y-5">
            {data.clusters.map((cluster) => (
              <article
                key={cluster.cluster_index}
                className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm"
              >
                <div className="border-b border-[#e2e8f0] bg-gradient-to-r from-[#eef2ff] via-[#f8faff] to-white px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#4f46e5]">
                    Cluster #{cluster.cluster_index} • {cluster.video_count} video{cluster.video_count === 1 ? "" : "s"}
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0f172a]">{cluster.trend || "Unknown trend"}</h2>
                </div>

                <div className="px-6 py-5">
                  <div className="rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#2563eb]">Why This Is Trending</p>
                    <p className="mt-2 text-base leading-relaxed text-[#1e293b]">
                      {cluster.why || "No explanation provided."}
                    </p>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-xl border border-[#e2e8f0]">
                    <table className="min-w-full divide-y divide-[#e2e8f0]">
                      <thead className="bg-[#f8fafc]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#475569]">
                            Topic
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#475569]">
                            Summary
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0] bg-white">
                        {cluster.items.map((item) => (
                          <tr key={`${cluster.cluster_index}-${item.file_id}`}>
                            <td className="px-4 py-3 text-sm font-semibold text-[#0f172a]">{item.topic || "-"}</td>
                            <td className="px-4 py-3 text-sm leading-relaxed text-[#334155]">{item.summary || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
