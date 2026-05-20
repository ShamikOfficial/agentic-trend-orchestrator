"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useSyncExternalStore } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getAuthToken } from "@/lib/auth-store";
import {
  DEFAULT_AUTHENTICATED_PATH,
  isPublicPath,
  loginPathWithReason,
  shouldRedirectAuthedAwayFromAuthPages,
} from "@/lib/auth-redirect";
import { fetchBearerToken, syncOAuthUser } from "@/lib/auth-session";

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
  const legacyToken = useSyncExternalStore(subscribeAuth, getAuthToken, () => "");
  const { status } = useSession();

  const authed = status === "authenticated" || Boolean(legacyToken);
  const sessionReady = status !== "loading";
  const publicRoute = isPublicPath(pathname);

  useEffect(() => {
    if (status === "authenticated") {
      void (async () => {
        const bearer = await fetchBearerToken();
        if (bearer) {
          await syncOAuthUser(bearer);
          window.dispatchEvent(new Event("auth-changed"));
        }
      })();
    }
  }, [status]);

  useEffect(() => {
    if (!sessionReady) return;

    if (!authed && !publicRoute) {
      router.replace(loginPathWithReason("login_required"));
      return;
    }

    if (authed && shouldRedirectAuthedAwayFromAuthPages(pathname)) {
      router.replace(DEFAULT_AUTHENTICATED_PATH);
    }
  }, [sessionReady, authed, publicRoute, pathname, router]);

  const showShell = authed && !shouldRedirectAuthedAwayFromAuthPages(pathname);

  if (!sessionReady && !publicRoute) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-16 text-muted-foreground">
        Loading…
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
