import Link from "next/link";

export default function ReportInChatPage() {
  return (
    <main className="min-h-full bg-[#f8fafc] px-6 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#e2e8f0] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#0f172a]">Report in Chat</h1>
        <p className="mt-2 text-sm text-[#64748b]">
          Feature in development: structured sharing of video report insights into group chat thread.
        </p>
        <div className="mt-5 flex gap-2">
          <Link href="/app/report" className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#364153]">
            Open Video Report
          </Link>
          <Link href="/app/progress" className="rounded-lg border border-[#9810fa] bg-[#faf5ff] px-4 py-2 text-sm font-semibold text-[#9810fa]">
            Update Progress
          </Link>
          <Link href="/app/chat" className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-semibold text-white">
            Back to Chat
          </Link>
        </div>
      </div>
    </main>
  );
}
