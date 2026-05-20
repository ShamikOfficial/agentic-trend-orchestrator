"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth-redirect";
import { isPathAllowed } from "@/lib/feature-flags";

/** Redirects direct URL hits to disabled MVP surfaces back to chat. */
export function DisabledFeatureRedirect({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isPathAllowed(pathname)) {
      router.replace(DEFAULT_AUTHENTICATED_PATH);
    }
  }, [pathname, router]);

  if (!isPathAllowed(pathname)) {
    return null;
  }

  return <>{children}</>;
}
