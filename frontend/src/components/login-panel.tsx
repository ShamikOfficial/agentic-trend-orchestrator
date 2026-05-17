"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import { ChatApiError, loginUser, registerUser } from "@/lib/chat-api";
import { setAuthToken, setAuthUser } from "@/lib/auth-store";

const allowPasswordAuth = process.env.NEXT_PUBLIC_ALLOW_PASSWORD_AUTH !== "false";

type LoginPanelProps = {
  bannerMessage?: string | null;
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

            <div className="mb-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void signIn("google", { callbackUrl: "/" })}
                className="rounded-xl border border-[#e5e7eb] px-4 py-2.5 text-[13px] font-medium text-[#364153] hover:bg-[#f9fafb]"
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => void signIn("github", { callbackUrl: "/" })}
                className="rounded-xl border border-[#e5e7eb] px-4 py-2.5 text-[13px] font-medium text-[#364153] hover:bg-[#f9fafb]"
              >
                GitHub
              </button>
            </div>

            {allowPasswordAuth ? (
              <>
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
                </div>

                <div className="mb-5">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#364153]">Password</label>
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
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-[#9a9ea6] hover:text-[#101828]"
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
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#101828] py-3 text-[14px] font-semibold text-white hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loginLoading ? "Logging in…" : "Log in"}
                </button>

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
            ) : null}
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
                className="w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5 text-[14px] text-[#101828] outline-none focus:border-[#101828]"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-[13px] font-semibold text-[#364153]">Display name (optional)</label>
              <input
                type="text"
                value={regDisplayName}
                onChange={(e) => setRegDisplayName(e.target.value)}
                placeholder="How we greet you"
                className="w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5 text-[14px] text-[#101828] outline-none focus:border-[#101828]"
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
                  className="w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] py-2.5 pr-11 pl-4 text-[14px] text-[#101828] outline-none focus:border-[#101828]"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-[#9a9ea6] hover:text-[#101828]"
                >
                  {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleRegister()}
              disabled={regLoading || regUsername.trim().length < 3 || regPassword.length < 3}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#101828] py-3 text-[14px] font-semibold text-white hover:bg-[#1e293b] disabled:opacity-50"
            >
              {regLoading ? "Creating…" : "Create account"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
