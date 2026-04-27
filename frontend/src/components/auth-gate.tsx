"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { clearAuthToken, getAuthToken, getAuthUser } from "@/lib/auth-store";
import { loginPathWithReason } from "@/lib/auth-redirect";

function subscribeAuth(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("auth-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("auth-changed", onStoreChange);
  };
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = useSyncExternalStore(subscribeAuth, getAuthToken, () => "");
  const displayName = useSyncExternalStore(
    subscribeAuth,
    () => getAuthUser()?.display_name ?? "",
    () => "",
  );

  useEffect(() => {
    if (!token && pathname !== "/") {
      router.replace(loginPathWithReason("login_required"));
    }
  }, [pathname, router, token]);

  const showNav = Boolean(token);

  const initials = displayName
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("") || "U";

  return (
    <>
      {showNav ? (
        <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/95 backdrop-blur">
          <nav className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 md:px-8">
            <p className="text-sm font-semibold tracking-wide">Agentic Trend Orchestrator</p>
            <div className="flex items-center gap-2 text-sm">
              <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/">
                Home
              </Link>
              <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/team">
                Team
              </Link>
              <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/workflow">
                Workflow
              </Link>
              <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/chat">
                Chat
              </Link>
              <div className="ml-2 flex items-center gap-2 rounded-md border px-2 py-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </span>
                <span className="max-w-32 truncate text-xs">{displayName || "User"}</span>
              </div>
              <button
                className="rounded-md px-3 py-1.5 hover:bg-muted"
                type="button"
                onClick={() => {
                  clearAuthToken();
                  window.dispatchEvent(new Event("auth-changed"));
                  router.replace(loginPathWithReason("logged_out"));
                }}
              >
                Logout
              </button>
            </div>
          </nav>
        </header>
      ) : null}
      <div className={showNav ? "pt-16" : ""}>{children}</div>
    </>
  );
}
