const LAST_SEEN_KEY = "tp_chat_last_seen";

export type ChatConversationMode = "dm" | "group";

export function toChatKey(mode: ChatConversationMode, targetId: string): string {
  return `${mode}:${targetId}`;
}

type MessageLike = { message_id: string; sender_id: string };

function loadLastSeenMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveLastSeenMap(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
}

let globalUnreadTotal = 0;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("chat-unread-changed"));
  }
}

export function subscribeChatUnread(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChatUnreadTotal(): number {
  return globalUnreadTotal;
}

export function setChatUnreadTotal(total: number) {
  const next = Math.max(0, total);
  if (next === globalUnreadTotal) return;
  globalUnreadTotal = next;
  emitChange();
}

export function getLastSeenMessageId(chatKey: string): string | null {
  return loadLastSeenMap()[chatKey] ?? null;
}

export function markConversationRead(chatKey: string, lastMessageId: string) {
  if (!lastMessageId) return;
  const map = loadLastSeenMap();
  if (map[chatKey] === lastMessageId) return;
  map[chatKey] = lastMessageId;
  saveLastSeenMap(map);
  emitChange();
}

export function clearChatUnreadState() {
  globalUnreadTotal = 0;
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(LAST_SEEN_KEY);
  }
  emitChange();
}

export function countUnreadMessages(
  chatKey: string,
  messages: MessageLike[],
  currentUserId: string,
  options?: { seedBaselineIfMissing?: boolean },
): number {
  if (messages.length === 0) return 0;

  const lastSeenId = getLastSeenMessageId(chatKey);
  const latestId = messages[messages.length - 1]?.message_id;

  if (!lastSeenId) {
    if (options?.seedBaselineIfMissing && latestId) {
      markConversationRead(chatKey, latestId);
    }
    return 0;
  }

  const idx = messages.findIndex((m) => m.message_id === lastSeenId);
  if (idx < 0) {
    if (options?.seedBaselineIfMissing && latestId) {
      markConversationRead(chatKey, latestId);
    }
    return 0;
  }

  const unseen = messages.slice(idx + 1);
  return unseen.filter((m) => currentUserId === "" || m.sender_id !== currentUserId).length;
}
