const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export class ChatApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ChatApiError";
  }
}

import { resolveApiAuthHeaders } from "@/lib/auth-session";

async function buildAuthHeaders(token?: string) {
  const base = { "Content-Type": "application/json" };
  if (token) {
    return { ...base, "x-auth-token": token };
  }
  return { ...base, ...(await resolveApiAuthHeaders()) };
}

async function parseErrorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    const detail =
      typeof payload?.detail === "string" && payload.detail.trim()
        ? payload.detail.trim()
        : fallback;
    return detail;
  } catch {
    return fallback;
  }
}

async function requestJson(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      const detail = await parseErrorMessage(response, `Request failed: ${response.status}`);
      throw new ChatApiError(detail, response.status);
    }
    return response.json();
  } catch (error) {
    if (error instanceof ChatApiError) {
      throw error;
    }
    const hint =
      error instanceof Error && error.message
        ? ` (${error.message})`
        : "";
    throw new ChatApiError(
      `Unable to reach backend API.${hint} Check the API URL (NEXT_PUBLIC_API_BASE_URL / root .env APP_ENV + API_BASE_URL_*), CORS, and that the server is running.`,
    );
  }
}

export async function registerUser(payload: {
  username: string;
  password: string;
  display_name?: string;
}) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: { username: string; password: string }) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listChatUsers(token: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/users`, {
    headers: await buildAuthHeaders(token),
  });
}

export async function sendDirectMessage(token: string, targetUserId: string, content: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/dm/${targetUserId}`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify({ content }),
  });
}

export async function listDirectMessages(token: string, targetUserId: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/dm/${targetUserId}`, {
    headers: await buildAuthHeaders(token),
  });
}

export async function createGroup(token: string, payload: { name: string; description?: string }) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/groups`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function listGroups(token: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/groups`, {
    headers: await buildAuthHeaders(token),
  });
}

export async function joinGroup(token: string, groupId: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/groups/${groupId}/request-join`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
  });
}

export async function searchChat(token: string, q: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/search?q=${encodeURIComponent(q)}`, {
    headers: await buildAuthHeaders(token),
  });
}

export async function listGroupJoinRequests(token: string, groupId: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/groups/${groupId}/requests`, {
    headers: await buildAuthHeaders(token),
  });
}

export async function respondToGroupJoinRequest(
  token: string,
  groupId: string,
  requesterUserId: string,
  approve: boolean,
) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/groups/${groupId}/requests/action`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify({ requester_user_id: requesterUserId, approve }),
  });
}

export async function sendGroupMessage(token: string, groupId: string, content: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/groups/${groupId}/messages`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify({ content }),
  });
}

export async function listGroupMessages(token: string, groupId: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/groups/${groupId}/messages`, {
    headers: await buildAuthHeaders(token),
  });
}

export async function askChatAi(
  token: string,
  payload: { chat_type: "dm" | "group"; target_id: string; question: string },
): Promise<{ answer: string }> {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/ask-ai`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function extractChatTasks(
  token: string,
  payload: { chat_type: "dm" | "group"; target_id: string; force?: boolean },
) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/extract-tasks`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function applyTaskAction(
  token: string,
  payload: {
    action: "create" | "update" | "comment" | "close";
    title?: string;
    description?: string;
    owner?: string;
    priority?: string;
    existing_item_id?: string;
    update_fields?: Record<string, string>;
    comment?: string;
  },
) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/apply-task-action`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });
}
