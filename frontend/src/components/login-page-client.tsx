"use client";

import { useSearchParams } from "next/navigation";
import { LoginPanel } from "@/components/login-panel";
import { authReasonIsError, messageForAuthReason } from "@/lib/auth-redirect";

export function LoginPageClient() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const oauthError = searchParams.get("error");
  const bannerMessage =
    messageForAuthReason(reason) ||
    (oauthError === "Configuration"
      ? "OAuth is not configured on this deployment (check Vercel env vars)."
      : oauthError
        ? `Sign-in failed (${oauthError}). Try again or use email/password.`
        : null);
  const bannerIsError = authReasonIsError(reason) || Boolean(oauthError);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f5f5f5] px-4 py-8">
      <LoginPanel bannerMessage={bannerMessage} bannerIsError={bannerIsError} />
    </main>
  );
}
