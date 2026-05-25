export type AuthRedirectReason =
  | "login_required"
  | "session_expired"
  | "logged_out"
  | "backend_sync_failed";

/** Default route after sign-in (dashboard at `/` is disabled for now). */
export const DEFAULT_AUTHENTICATED_PATH = "/app/chat";

export const LOGIN_PATH = "/login";

export function messageForAuthReason(reason: string | null): string | null {
  switch (reason) {
    case "session_expired":
      return "Your session expired or is no longer valid. Please sign in again.";
    case "login_required":
      return "Please sign in to continue.";
    case "logged_out":
      return "You have been signed out.";
    case "backend_sync_failed":
      return "Google sign-in succeeded, but the backend could not create your account. Check API URL, AUTH_JWT_SECRET, and Railway logs, then try again.";
    default:
      return null;
  }
}

export function authReasonIsError(reason: string | null): boolean {
  return (
    reason === "session_expired" ||
    reason === "login_required" ||
    reason === "backend_sync_failed"
  );
}

export function loginPathWithReason(reason: AuthRedirectReason): string {
  return `${LOGIN_PATH}?reason=${encodeURIComponent(reason)}`;
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === LOGIN_PATH || pathname === "/") {
    return true;
  }
  return pathname.startsWith("/api/auth");
}

export function shouldRedirectAuthedAwayFromAuthPages(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === "/";
}
