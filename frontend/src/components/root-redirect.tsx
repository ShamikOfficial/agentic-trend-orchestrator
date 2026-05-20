"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_AUTHENTICATED_PATH,
  loginPathWithReason,
} from "@/lib/auth-redirect";
import { getAuthToken } from "@/lib/auth-store";

function subscribeAuth(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("auth-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("auth-changed", onStoreChange);
  };
}

/** `/` sends users to login or the main app — no home dashboard. */
export function RootRedirect() {
  const router = useRouter();
  const { status } = useSession();
  const token = useSyncExternalStore(subscribeAuth, getAuthToken, () => "");

  useEffect(() => {
    if (status === "loading") return;
    const authed = status === "authenticated" || Boolean(token);
    router.replace(authed ? DEFAULT_AUTHENTICATED_PATH : loginPathWithReason("login_required"));
  }, [router, status, token]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-16 text-muted-foreground">
      Loading…
    </main>
  );
}
