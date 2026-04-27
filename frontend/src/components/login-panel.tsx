"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
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
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleLogin() {
    setFormError("");
    setSuccessMessage("");
    try {
      const response = await loginUser({ username: loginUsername, password: loginPassword });
      setAuthToken(response.token);
      setAuthUser(response.user);
      window.dispatchEvent(new Event("auth-changed"));
      setLoginPassword("");
      router.replace("/");
    } catch (error) {
      if (error instanceof ChatApiError && error.status === 401) {
        setFormError("Invalid username or password. Try again or register below.");
        return;
      }
      setFormError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRegister() {
    setFormError("");
    setSuccessMessage("");
    try {
      await registerUser({
        username: regUsername,
        password: regPassword,
        display_name: regDisplayName || undefined,
      });
      setRegUsername("");
      setRegPassword("");
      setRegDisplayName("");
      setSuccessMessage("Account created. You can sign in above.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  }

  const alertMessage = bannerMessage || formError;

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <article className="rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-7 text-slate-100 shadow-lg">
        <h1 className="text-3xl font-semibold leading-tight md:text-4xl">Sign in to your workspace</h1>
        <p className="mt-4 text-sm text-slate-200/90">
          Use one account for Team, Workflow, and Chat. After signing in you will return to the home dashboard.
        </p>
      </article>
      <article className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold">Welcome</h2>
        <p className="mb-4 text-sm text-muted-foreground">Sign in or create an account.</p>
        {successMessage ? (
          <p role="status" className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
            {successMessage}
          </p>
        ) : null}
        {alertMessage ? (
          <p
            role={bannerIsError ? "alert" : "status"}
            className={
              bannerIsError
                ? "mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                : "mb-4 rounded-md border border-muted-foreground/30 bg-muted/50 px-3 py-2 text-sm text-foreground"
            }
          >
            {alertMessage}
          </p>
        ) : null}
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Login</h3>
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded border px-3 text-sm"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
          />
          <input
            className="h-10 w-full rounded border px-3 text-sm"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="password"
            type="password"
            autoComplete="current-password"
          />
        </div>
        <button className={`${buttonVariants()} mt-3`} type="button" onClick={() => void handleLogin()}>
          Sign in
        </button>
        <hr className="my-5" />
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Create account</h3>
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded border px-3 text-sm"
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
          />
          <input
            className="h-10 w-full rounded border px-3 text-sm"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            placeholder="password"
            type="password"
            autoComplete="new-password"
          />
          <input
            className="h-10 w-full rounded border px-3 text-sm"
            value={regDisplayName}
            onChange={(e) => setRegDisplayName(e.target.value)}
            placeholder="display name (optional)"
          />
        </div>
        <button className={`${buttonVariants({ variant: "outline" })} mt-3`} type="button" onClick={() => void handleRegister()}>
          Register
        </button>
      </article>
    </section>
  );
}
