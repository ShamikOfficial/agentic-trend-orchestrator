const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

function readToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("ato_auth_token") ?? "";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(readToken() ? { "x-auth-token": readToken() } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ApiError(
      `Network error while calling ${API_BASE_URL}${path}. Confirm backend is running/CORS and check auth session if backend restarted. (${detail})`,
      0,
      error,
    );
  }

  const raw = await response.text();
  const data = raw ? (JSON.parse(raw) as unknown) : null;

  if (!response.ok) {
    throw new ApiError(
      `Request failed: ${response.status}`,
      response.status,
      data,
    );
  }

  return data as TResponse;
}
