"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { ChatApiError, loginUser, registerUser } from "@/lib/chat-api";
import { setAuthToken, setAuthUser } from "@/lib/auth-store";

type LoginPanelProps = {
  /** Shown above the form (e.g. session expired, must log in). */
  bannerMessage?: string | null;
  /** When false, banner uses neutral styling (e.g. signed out). */
  bannerIsError?: boolean;
};

export function LoginPanel({ bannerMessage, bannerIsError = true }: LoginPanelProps) {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(false);
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

  async function handleLogin() {
    setFormError("");
    setSuccessMessage("");
    setLoginLoading(true);
    try {
      const response = await loginUser({ username: loginUsername.trim(), password: loginPassword });
      setAuthToken(response.token);
      setAuthUser(response.user);
      window.dispatchEvent(new Event("auth-changed"));
      setLoginPassword("");
      router.replace("/");
    } catch (error) {
      if (error instanceof ChatApiError && error.status === 401) {
        setFormError("Invalid username or password. Try again or create an account.");
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
      setSuccessMessage("Account created. You can sign in above.");
      setShowRegister(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#101828]">
          <span className="text-[17px] font-extrabold tracking-tight text-white">TP</span>
        </div>
        <h1 className="mb-2 text-[26px] font-extrabold tracking-tight text-[#101828]">TrendPilot</h1>
        <p className="text-[14px] leading-normal text-[#6a7282]">
          AI-powered video production workspace
          <br />
          for creator teams
        </p>
      </div>

      {successMessage ? (
        <p
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-[13px] text-emerald-900"
        >
          {successMessage}
        </p>
      ) : null}
      {alertMessage ? (
        <p
          role={bannerIsError ? "alert" : "status"}
          className={`mb-4 rounded-xl border px-4 py-3 text-center text-[13px] ${
            bannerIsError
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-[#e5e7eb] bg-[#fafafa] text-[#364153]"
          }`}
        >
          {alertMessage}
        </p>
      ) : null}

      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        {!showRegister ? (
          <>
            <h2 className="mb-6 text-[18px] font-bold text-[#101828]">Log in to your workspace</h2>

            <div className="mb-4">
              <label className="mb-1.5 block text-[13px] font-semibold text-[#364153]">Email address</label>
              <input
                type="text"
                autoComplete="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="you@creatorteam.com"
                className="w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5 text-[14px] text-[#101828] outline-none transition-colors placeholder:text-[#9a9ea6] focus:border-[#101828]"
              />
              <p className="mt-1 text-[11px] text-[#9a9ea6]">Use the username you registered with (often an email-style id).</p>
            </div>

            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[13px] font-semibold text-[#364153]">Password</label>
                <button type="button" className="text-[12px] font-medium text-[#9810fa] hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] py-2.5 pr-11 pl-4 text-[14px] text-[#101828] outline-none transition-colors placeholder:text-[#9a9ea6] focus:border-[#101828]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-[#9a9ea6] transition-colors hover:text-[#101828]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loginLoading || !loginUsername.trim() || !loginPassword}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#101828] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : null}
              {loginLoading ? "Logging in…" : "Log in"}
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#e5e7eb]" />
              <span className="text-[12px] text-[#9a9ea6]">or continue with</span>
              <div className="h-px flex-1 bg-[#e5e7eb]" />
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] px-4 py-2.5 text-[13px] font-medium text-[#364153] transition-colors hover:bg-[#f9fafb]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
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
                Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] px-4 py-2.5 text-[13px] font-medium text-[#364153] transition-colors hover:bg-[#f9fafb]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                </svg>
                Apple
              </button>
            </div>

            <p className="text-center text-[13px] text-[#6a7282]">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="font-semibold text-[#101828] hover:underline"
                onClick={() => {
                  setFormError("");
                  setShowRegister(true);
                }}
              >
                Create an account
              </button>
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              className="mb-4 text-[13px] font-medium text-[#9810fa] hover:underline"
              onClick={() => {
                setFormError("");
                setShowRegister(false);
              }}
            >
              ← Back to sign in
            </button>
            <h2 className="mb-6 text-[18px] font-bold text-[#101828]">Create your workspace account</h2>
            <div className="mb-4">
              <label className="mb-1.5 block text-[13px] font-semibold text-[#364153]">Username</label>
              <input
                type="text"
                autoComplete="username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="min 3 characters"
                className="w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5 text-[14px] text-[#101828] outline-none transition-colors placeholder:text-[#9a9ea6] focus:border-[#101828]"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-[13px] font-semibold text-[#364153]">Display name (optional)</label>
              <input
                type="text"
                value={regDisplayName}
                onChange={(e) => setRegDisplayName(e.target.value)}
                placeholder="How we greet you"
                className="w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5 text-[14px] text-[#101828] outline-none transition-colors placeholder:text-[#9a9ea6] focus:border-[#101828]"
              />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-[13px] font-semibold text-[#364153]">Password</label>
              <div className="relative">
                <input
                  type={showRegPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="min 3 characters"
                  className="w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] py-2.5 pr-11 pl-4 text-[14px] text-[#101828] outline-none transition-colors placeholder:text-[#9a9ea6] focus:border-[#101828]"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-[#9a9ea6] transition-colors hover:text-[#101828]"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#101828] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {regLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : null}
              {regLoading ? "Creating…" : "Create account"}
            </button>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-[#9a9ea6]">
        By continuing, you agree to our{" "}
        <span className="cursor-pointer underline">Terms of Service</span> and{" "}
        <span className="cursor-pointer underline">Privacy Policy</span>
      </p>
    </div>
  );
}
