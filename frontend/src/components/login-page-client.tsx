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
      ? "Google sign-in is not configured on this deployment (check Vercel env vars)."
      : oauthError
        ? `Sign-in failed (${oauthError}). Try Google or email sign-in again.`
        : null);
  const bannerIsError = authReasonIsError(reason) || Boolean(oauthError);

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(139,92,246,0.18),transparent)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#f8f7ff] via-[#f5f7fb] to-[#eef2ff]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-1/4 -bottom-16 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[420px]">
        <LoginPanel bannerMessage={bannerMessage} bannerIsError={bannerIsError} />
      </div>
    </main>
  );
}
