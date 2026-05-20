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

import { fetchBearerToken, syncOAuthUser } from "@/lib/auth-session";

async function buildAuthHeaders(token?: string) {
  const base = { "Content-Type": "application/json" };
  const bearer = await fetchBearerToken();
  if (bearer) {
    await syncOAuthUser(bearer);
    return { ...base, Authorization: `Bearer ${bearer}` };
  }
  const legacy =
    token ||
    (typeof window !== "undefined" ? window.localStorage.getItem("ato_auth_token") ?? "" : "");
  if (legacy) {
    return { ...base, "x-auth-token": legacy };
  }
  return base;
}

function detailFromPayload(payload: unknown, fallback: string): string {
  const d = (payload as { detail?: unknown })?.detail;
  if (typeof d === "string" && d.trim()) {
    return d.trim();
  }
  if (d && typeof d === "object") {
    const obj = d as Record<string, unknown>;
    const inner = obj.detail;
    if (typeof inner === "string" && inner.trim()) {
      const used = obj.tokens_used;
      const budget = obj.token_budget;
      if (typeof used === "number" && typeof budget === "number") {
        return `${inner.trim()} (${used.toLocaleString()} / ${budget.toLocaleString()} tokens this month)`;
      }
      return inner.trim();
    }
  }
  return fallback;
}

async function parseErrorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    return detailFromPayload(payload, fallback);
  } catch {
    return fallback;
  }
}

async function requestJson(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      ...init,
    });
    if (!response.ok) {
      const detail = await parseErrorMessage(response, `Request failed: ${response.status}`);
      throw new ChatApiError(detail, response.status);
    }
    const text = await response.text();
    if (!text.trim()) {
      return null;
    }
    return JSON.parse(text) as unknown;
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

export async function deleteDirectMessage(token: string, targetUserId: string, messageId: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  const base = `${API_BASE_URL}/chat/dm/${encodeURIComponent(targetUserId)}/messages/${encodeURIComponent(messageId)}`;
  const headers = await buildAuthHeaders(token);
  try {
    return (await requestJson(base, { method: "DELETE", headers })) as {
      deleted: boolean;
      message_id: string;
      already_gone?: boolean;
    };
  } catch (error) {
    if (error instanceof ChatApiError && error.status === 404) {
      return (await requestJson(`${base}/delete`, { method: "POST", headers })) as {
        deleted: boolean;
        message_id: string;
        already_gone?: boolean;
      };
    }
    throw error;
  }
}

export async function deleteGroupMessage(token: string, groupId: string, messageId: string) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  const base = `${API_BASE_URL}/chat/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}`;
  const headers = await buildAuthHeaders(token);
  try {
    return (await requestJson(base, { method: "DELETE", headers })) as {
      deleted: boolean;
      message_id: string;
      already_gone?: boolean;
    };
  } catch (error) {
    if (error instanceof ChatApiError && error.status === 404) {
      return (await requestJson(`${base}/delete`, { method: "POST", headers })) as {
        deleted: boolean;
        message_id: string;
        already_gone?: boolean;
      };
    }
    throw error;
  }
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

export async function deleteChatConversation(
  token: string,
  params: { chat_type: "dm" | "group"; target_id: string },
) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  const qs = new URLSearchParams({
    chat_type: params.chat_type,
    target_id: params.target_id,
  });
  return requestJson(`${API_BASE_URL}/chat/conversation?${qs.toString()}`, {
    method: "DELETE",
    headers: await buildAuthHeaders(token),
  }) as Promise<{ deleted: boolean; messages_removed: number }>;
}

export async function askChatAi(
  token: string,
  payload: {
    chat_type: "dm" | "group";
    target_id: string;
    question: string;
    external_events?: import("@/types/api").CalendarIcsEvent[];
  },
): Promise<{
  answer: string;
  show_schedule_picker?: boolean;
  intent?: string;
  task_suggestions?: import("@/types/api").ChatTaskSuggestion[];
}> {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/ask-ai`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify(payload),
  }) as Promise<{
    answer: string;
    show_schedule_picker?: boolean;
    intent?: string;
    task_suggestions?: import("@/types/api").ChatTaskSuggestion[];
  }>;
}

export async function listChatTaskAnalysisSections(
  token: string,
  params: { chat_type: "dm" | "group"; target_id: string },
) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  const q = new URLSearchParams({
    chat_type: params.chat_type,
    target_id: params.target_id,
  });
  return requestJson(`${API_BASE_URL}/chat/task-analysis-sections?${q}`, {
    headers: await buildAuthHeaders(token),
  }) as Promise<import("@/types/api").ChatTaskAnalysisSectionsResponse>;
}

export async function extractChatTasks(
  token: string,
  payload: {
    chat_type: "dm" | "group";
    target_id: string;
    force?: boolean;
    client_timezone?: string;
  },
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
  }) as Promise<import("@/types/api").ChatExtractTasksResponse>;
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
    chat_type?: "dm" | "group";
    target_id?: string;
    source_message_batch_index?: number;
    source_message_ids?: string[];
    source_first_message_id?: string;
    source_last_message_id?: string;
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

export async function listChatWorkItems(
  token: string,
  params: { chat_type: "dm" | "group"; target_id: string },
) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  const qs = new URLSearchParams({
    chat_type: params.chat_type,
    target_id: params.target_id,
  });
  return requestJson(`${API_BASE_URL}/chat/work-items?${qs.toString()}`, {
    headers: await buildAuthHeaders(token),
  }) as Promise<import("@/types/api").ChatWorkItemsResponse>;
}

export async function fetchCalendarIcs(
  token: string,
  payload: { ics_url?: string; ics_text?: string },
) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/calendar/fetch-ics`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify(payload),
  }) as Promise<import("@/types/api").FetchCalendarIcsResponse>;
}

export async function suggestTimeSlots(
  token: string,
  payload: {
    chat_type: "dm" | "group";
    target_id: string;
    task_title: string;
    task_description?: string;
    duration_minutes?: number;
    preferred_date?: string;
    message_text?: string;
    external_events?: import("@/types/api").CalendarIcsEvent[];
  },
) {
  if (!API_BASE_URL) {
    throw new ChatApiError(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local or Vercel environment variables.",
    );
  }
  return requestJson(`${API_BASE_URL}/chat/suggest-time-slots`, {
    method: "POST",
    headers: await buildAuthHeaders(token),
    body: JSON.stringify(payload),
  }) as Promise<import("@/types/api").SuggestTimeSlotsResponse>;
}
