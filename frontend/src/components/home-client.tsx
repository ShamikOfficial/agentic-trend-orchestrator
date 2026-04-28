"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LoginPanel } from "@/components/login-panel";
import { getAuthToken } from "@/lib/auth-store";
import { authReasonIsError, messageForAuthReason } from "@/lib/auth-redirect";

function subscribeAuth(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("auth-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("auth-changed", onStoreChange);
  };
}

export function HomeClient() {
  const searchParams = useSearchParams();
  const token = useSyncExternalStore(subscribeAuth, getAuthToken, () => "");
  const reason = searchParams.get("reason");
  const bannerMessage = messageForAuthReason(reason);
  const bannerIsError = authReasonIsError(reason);

  if (!token) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-[#f5f5f5] px-4 py-8">
        <LoginPanel bannerMessage={bannerMessage} bannerIsError={bannerIsError} />
      </main>
    );
  }

  const modules: Array<{
    title: string;
    href: string;
    accent: string;
    cta: string;
  }> = [
    {
      title: "Team Assistant",
      href: "/team",
      accent: "from-cyan-500/20 to-blue-500/20",
      cta: "Open workspace",
    },
    {
      title: "Workflow",
      href: "/workflow",
      accent: "from-violet-500/20 to-fuchsia-500/20",
      cta: "Open board",
    },
    {
      title: "Chat",
      href: "/chat",
      accent: "from-emerald-500/20 to-lime-500/20",
      cta: "Open inbox",
    },
  ];

  return (
    <main className="flex min-h-full w-full flex-col gap-6 px-4 py-8 md:px-10">
      <section className="rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-slate-100 shadow-lg md:p-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Welcome back</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200/90">Your workspace is ready. Open a module below or use the menu on the left.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {modules.map((module) => (
          <Link
            key={module.title}
            href={module.href}
            className={`group rounded-2xl border bg-gradient-to-br ${module.accent} p-5 transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <p className="text-lg font-semibold">{module.title}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{module.cta}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Overview</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Active now</p>
              <p className="text-lg font-semibold">--</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-semibold">--</p>
            </div>
          </div>
        </article>
        <article className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upcoming Widgets</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Personal stats</div>
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Recent activity</div>
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Weekly progress</div>
          </div>
        </article>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">This home dashboard is prepared for per-user analytics and widgets.</p>
      </section>
    </main>
  );
}
