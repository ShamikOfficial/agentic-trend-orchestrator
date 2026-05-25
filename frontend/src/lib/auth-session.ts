const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

let cachedBearer: string | null = null;
let syncPromise: Promise<void> | null = null;

export class OAuthSyncError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OAuthSyncError";
  }
}

export function clearBearerCache() {
  cachedBearer = null;
  syncPromise = null;
}

export async function fetchBearerToken(): Promise<string> {
  if (cachedBearer) {
    return cachedBearer;
  }
  const res = await fetch("/api/auth/token", { cache: "no-store" });
  if (!res.ok) {
    return "";
  }
  const data = (await res.json()) as { token?: string };
  cachedBearer = data.token ?? "";
  return cachedBearer;
}

async function parseSyncError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    const detail = payload.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }
    if (detail && typeof detail === "object" && "detail" in detail) {
      const inner = (detail as { detail?: unknown }).detail;
      if (typeof inner === "string" && inner.trim()) {
        return inner.trim();
      }
    }
  } catch {
    // ignore parse errors
  }
  return `Backend sign-in failed (${response.status}).`;
}

export async function syncOAuthUser(bearer: string): Promise<void> {
  if (!bearer) {
    throw new OAuthSyncError("Could not read OAuth session. Try signing in again.");
  }
  if (!API_BASE_URL) {
    throw new OAuthSyncError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in Vercel or frontend/.env.local.",
    );
  }
  if (!syncPromise) {
    syncPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/oauth/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new OAuthSyncError(await parseSyncError(response), response.status);
      }
      const payload = (await response.json()) as {
        user?: { user_id: string; username: string; display_name: string };
      };
      if (!payload.user?.user_id) {
        throw new OAuthSyncError("Backend did not return a user profile after OAuth sync.");
      }
      const { setAuthUser } = await import("@/lib/auth-store");
      setAuthUser(payload.user);
    })().finally(() => {
      syncPromise = null;
    });
  }
  await syncPromise;
}

/** OAuth sign-in must succeed on FastAPI before the app treats the user as logged in. */
export async function ensureOAuthBackendSession(): Promise<void> {
  const bearer = await fetchBearerToken();
  await syncOAuthUser(bearer);
}

export async function resolveApiAuthHeaders(): Promise<Record<string, string>> {
  const legacy =
    typeof window !== "undefined" ? window.localStorage.getItem("ato_auth_token") ?? "" : "";
  if (legacy) {
    return { "x-auth-token": legacy };
  }
  const bearer = await fetchBearerToken();
  if (bearer) {
    await syncOAuthUser(bearer);
    return { Authorization: `Bearer ${bearer}` };
  }
  return {};
}
