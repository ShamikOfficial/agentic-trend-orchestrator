"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { signIn } from "next-auth/react";
import { ChatApiError, loginUser, registerUser } from "@/lib/chat-api";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth-redirect";
import { setAuthToken, setAuthUser } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

type LoginPanelProps = {
  bannerMessage?: string | null;
  bannerIsError?: boolean;
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const inputClassName =
  "w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-[14px] text-[#0f172a] outline-none transition-all duration-200 placeholder:text-[#94a3b8] focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100";

export function LoginPanel({ bannerMessage, bannerIsError = true }: LoginPanelProps) {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const alertMessage = bannerMessage || formError;

  async function handleGoogleSignIn() {
    setFormError("");
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: DEFAULT_AUTHENTICATED_PATH });
    } catch {
      setGoogleLoading(false);
    }
  }

  async function handleLogin() {
    setFormError("");
    setSuccessMessage("");
    setLoginLoading(true);
    try {
      const response = (await loginUser({
        username: loginUsername.trim(),
        password: loginPassword,
      })) as { token: string; user: Parameters<typeof setAuthUser>[0] };
      setAuthToken(response.token);
      setAuthUser(response.user);
      window.dispatchEvent(new Event("auth-changed"));
      setLoginPassword("");
      router.replace(DEFAULT_AUTHENTICATED_PATH);
    } catch (error) {
      if (error instanceof ChatApiError && error.status === 401) {
        setFormError("Invalid email or password. Try again or create an account.");
        return;
      }
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister() {
    setFormError("");
    setSuccessMessage("");
    setRegLoading(true);
    try {
      await registerUser({
        username: regUsername.trim(),
        password: regPassword,
        display_name: regDisplayName.trim() || undefined,
      });
      setRegUsername("");
      setRegPassword("");
      setRegDisplayName("");
      setSuccessMessage("Account created. Sign in with your email below.");
      setShowRegister(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="login-fade-up w-full max-w-[420px]">
      <div className="mb-8 text-center">
        <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#a855f7] opacity-90 blur-md" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4f46e5] via-[#7c3aed] to-[#9333ea] shadow-lg shadow-violet-500/25">
            <Sparkles className="h-6 w-6 text-white" strokeWidth={2.25} />
          </div>
        </div>
        <h1 className="mb-2 bg-gradient-to-r from-[#101828] via-[#312e81] to-[#4c1d95] bg-clip-text text-[28px] font-extrabold tracking-tight text-transparent">
          TrendPilot
        </h1>
        <p className="text-[15px] leading-relaxed text-[#64748b]">
          Your AI-powered workspace for creator teams
        </p>
      </div>

      {successMessage ? (
        <p
          role="status"
          className="mb-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-center text-[13px] text-emerald-900"
        >
          {successMessage}
        </p>
      ) : null}

      {alertMessage ? (
        <p
          role={bannerIsError ? "alert" : "status"}
          className={cn(
            "mb-5 rounded-2xl border px-4 py-3 text-center text-[13px] leading-relaxed backdrop-blur-sm",
            bannerIsError
              ? "border-red-200/80 bg-red-50/90 text-red-900"
              : "border-[#e2e8f0] bg-white/80 text-[#334155]",
          )}
        >
          {alertMessage}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-8 shadow-[0_20px_60px_-12px_rgba(79,70,229,0.18)] backdrop-blur-xl">
        {!showRegister ? (
          <>
            <div className="mb-6 text-center">
              <h2 className="text-[20px] font-bold tracking-tight text-[#0f172a]">Welcome back</h2>
              <p className="mt-1.5 text-[14px] text-[#64748b]">Sign in with Google or your email</p>
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={googleLoading || loginLoading}
              className={cn(
                "group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white px-5 py-3.5",
                "text-[15px] font-semibold text-[#1e293b] shadow-sm",
                "transition-all duration-300 ease-out",
                "hover:border-[#cbd5e1] hover:bg-[#fafafa] hover:shadow-md hover:-translate-y-0.5",
                "active:translate-y-0 active:shadow-sm",
                "disabled:pointer-events-none disabled:opacity-70",
              )}
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#64748b]" aria-hidden="true" />
              ) : (
                <GoogleIcon className="h-5 w-5 shrink-0" />
              )}
              <span>{googleLoading ? "Redirecting to Google…" : "Continue with Google"}</span>
            </button>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-[#e2e8f0]" />
              <span className="text-[12px] font-medium uppercase tracking-wide text-[#94a3b8]">or</span>
              <span className="h-px flex-1 bg-[#e2e8f0]" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#475569]">Email</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="you@creatorteam.com"
                  className={inputClassName}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#475569]">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={cn(inputClassName, "pr-11")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && loginUsername.trim() && loginPassword) {
                        void handleLogin();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-[#475569]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleLogin()}
                disabled={loginLoading || googleLoading || !loginUsername.trim() || !loginPassword}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] py-3 text-[14px] font-semibold text-white shadow-md shadow-violet-500/20",
                  "transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5",
                  "active:translate-y-0 disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  "Sign in with email"
                )}
              </button>
            </div>

            <p className="mt-6 text-center text-[13px] text-[#64748b]">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="font-semibold text-violet-700 transition-colors hover:text-violet-900 hover:underline"
                onClick={() => {
                  setFormError("");
                  setShowRegister(true);
                }}
              >
                Create one
              </button>
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              className="mb-4 text-[13px] font-medium text-violet-700 transition-colors hover:text-violet-900 hover:underline"
              onClick={() => {
                setFormError("");
                setShowRegister(false);
              }}
            >
              ← Back to sign in
            </button>
            <div className="mb-6">
              <h2 className="text-[20px] font-bold tracking-tight text-[#0f172a]">Create your account</h2>
              <p className="mt-1.5 text-[14px] text-[#64748b]">Use email and password to join your workspace</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#475569]">Email</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="you@creatorteam.com"
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#475569]">
                  Display name <span className="font-normal text-[#94a3b8]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="How we greet you"
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#475569]">Password</label>
                <div className="relative">
                  <input
                    type={showRegPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min. 3 characters"
                    className={cn(inputClassName, "pr-11")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                    aria-label={showRegPassword ? "Hide password" : "Show password"}
                  >
                    {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleRegister()}
                disabled={regLoading || regUsername.trim().length < 3 || regPassword.length < 3}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] py-3 text-[14px] font-semibold text-white shadow-md shadow-violet-500/20",
                  "transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5",
                  "active:translate-y-0 disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {regLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
