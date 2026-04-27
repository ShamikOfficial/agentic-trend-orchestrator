export type AuthRedirectReason =
  | "login_required"
  | "session_expired"
  | "logged_out";

export function messageForAuthReason(reason: string | null): string | null {
  switch (reason) {
    case "session_expired":
      return "Your session expired or is no longer valid. Please sign in again.";
    case "login_required":
      return "Please sign in to continue.";
    case "logged_out":
      return "You have been signed out.";
    default:
      return null;
  }
}

export function authReasonIsError(reason: string | null): boolean {
  return reason === "session_expired" || reason === "login_required";
}

export function loginPathWithReason(reason: AuthRedirectReason): string {
  return `/?reason=${encodeURIComponent(reason)}`;
}
