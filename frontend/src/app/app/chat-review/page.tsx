import Link from "next/link";

export default function ScriptReviewPage() {
  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Script Review</h1>
        <p className="mt-2 text-sm text-[#64748b]">
          Feature in development: collaborative line-by-line review from group chat feedback.
        </p>
        <div className="mt-5 flex gap-2">
          <Link href="/app/editor" className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-semibold text-white">
            Open Editor
          </Link>
          <Link href="/app/chat-tasks" className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#364153]">
            Extract Tasks
          </Link>
        </div>
      </div>
    </main>
  );
}
