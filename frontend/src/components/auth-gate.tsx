"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getAuthToken } from "@/lib/auth-store";
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

  useEffect(() => {
    if (!token && pathname !== "/") {
      router.replace(loginPathWithReason("login_required"));
    }
  }, [pathname, router, token]);

  const showShell = Boolean(token);

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
