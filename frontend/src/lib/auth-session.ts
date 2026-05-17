const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

let cachedBearer: string | null = null;
let syncPromise: Promise<void> | null = null;

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

export async function syncOAuthUser(bearer: string): Promise<void> {
  if (!bearer || !API_BASE_URL) {
    return;
  }
  if (!syncPromise) {
    syncPromise = fetch(`${API_BASE_URL}/auth/oauth/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          user?: { user_id: string; username: string; display_name: string };
        };
        if (payload.user) {
          const { setAuthUser } = await import("@/lib/auth-store");
          setAuthUser(payload.user);
        }
      })
      .finally(() => {
        syncPromise = null;
      });
  }
  await syncPromise;
}

export async function resolveApiAuthHeaders(): Promise<Record<string, string>> {
  const legacy = typeof window !== "undefined" ? window.localStorage.getItem("ato_auth_token") ?? "" : "";
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
