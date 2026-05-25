"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getAuthToken } from "@/lib/auth-store";
import {
  DEFAULT_AUTHENTICATED_PATH,
  isPublicPath,
  loginPathWithReason,
  shouldRedirectAuthedAwayFromAuthPages,
} from "@/lib/auth-redirect";
import { clearBearerCache, ensureOAuthBackendSession } from "@/lib/auth-session";

function subscribeAuth(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("auth-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("auth-changed", onStoreChange);
  };
}

type OAuthBackendState = "idle" | "syncing" | "ready" | "failed";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const legacyToken = useSyncExternalStore(subscribeAuth, getAuthToken, () => "");
  const { status } = useSession();
  const [oauthBackend, setOauthBackend] = useState<OAuthBackendState>("idle");

  const legacyAuthed = Boolean(legacyToken);
  const oauthAuthed = status === "authenticated" && oauthBackend === "ready";
  const authed = legacyAuthed || oauthAuthed;
  const oauthSyncing =
    status === "authenticated" && !legacyAuthed && oauthBackend === "syncing";
  const sessionReady = status !== "loading";
  const publicRoute = isPublicPath(pathname);

  useEffect(() => {
    if (status !== "authenticated" || legacyAuthed) {
      if (status !== "authenticated") {
        setOauthBackend("idle");
      }
      return;
    }

    let cancelled = false;
    setOauthBackend("syncing");

    void (async () => {
      try {
        await ensureOAuthBackendSession();
        if (!cancelled) {
          setOauthBackend("ready");
          window.dispatchEvent(new Event("auth-changed"));
        }
      } catch {
        if (cancelled) {
          return;
        }
        setOauthBackend("failed");
        clearBearerCache();
        await signOut({ callbackUrl: loginPathWithReason("backend_sync_failed") });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, legacyAuthed]);

  useEffect(() => {
    if (!sessionReady || oauthSyncing) {
      return;
    }

    if (!authed && !publicRoute) {
      router.replace(loginPathWithReason("login_required"));
      return;
    }

    if (authed && shouldRedirectAuthedAwayFromAuthPages(pathname)) {
      router.replace(DEFAULT_AUTHENTICATED_PATH);
    }
  }, [sessionReady, oauthSyncing, authed, publicRoute, pathname, router]);

  const showShell = authed && !shouldRedirectAuthedAwayFromAuthPages(pathname);

  if ((oauthSyncing || (!sessionReady && !publicRoute)) && !publicRoute) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-16 text-muted-foreground">
        {oauthSyncing ? "Connecting to workspace…" : "Loading…"}
      </main>
    );
  }

  return (
    <div
      className={
        showShell
          ? "flex min-h-screen w-full flex-1 flex-row bg-background"
          : "min-h-screen w-full flex-1"
      }
    >
      {showShell ? <AppSidebar /> : null}
      <div className={showShell ? "min-h-0 min-w-0 flex-1 overflow-auto" : "min-h-screen w-full"}>
        {children}
      </div>
    </div>
  );
}
