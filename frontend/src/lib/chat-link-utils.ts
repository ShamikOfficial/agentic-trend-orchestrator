import type { WorkflowItem } from "@/types/api";

export type ParsedChatLink = {
  chatType: "dm" | "group";
  targetId: string;
  dmUserIds?: [string, string];
};

type ChatUserLike = { user_id: string; display_name: string; username?: string };
type ChatGroupLike = { group_id: string; name: string };

/** Parse `source_chat_key` (`dm:a:b`) or `linked_trend` (`chat:dm:a:b`). */
export function parseChatLinkRaw(raw: string | undefined | null): ParsedChatLink | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  let key = trimmed.toLowerCase();
  if (key.startsWith("chat:")) key = key.slice(5);

  if (key.startsWith("dm:")) {
    const parts = key.split(":");
    if (parts.length >= 3) {
      return { chatType: "dm", targetId: "", dmUserIds: [parts[1], parts[2]] };
    }
    return null;
  }

  if (key.startsWith("group:")) {
    const idx = trimmed.toLowerCase().indexOf("group:");
    const groupId = trimmed.slice(idx + 6);
    if (!groupId) return null;
    return { chatType: "group", targetId: groupId };
  }

  return null;
}

export function chatLinkFromWorkflowItem(item: WorkflowItem): ParsedChatLink | null {
  return parseChatLinkRaw(item.source_chat_key) ?? parseChatLinkRaw(item.linked_trend);
}

export function resolveChatTargetId(
  link: ParsedChatLink,
  currentUserId: string,
): ParsedChatLink {
  if (link.chatType !== "dm" || !link.dmUserIds) {
    return link;
  }
  const [a, b] = link.dmUserIds;
  const targetId = a === currentUserId ? b : b === currentUserId ? a : b;
  return { ...link, targetId };
}

export function buildChatHref(link: ParsedChatLink, currentUserId: string): string {
  const resolved = resolveChatTargetId(link, currentUserId);
  const params = new URLSearchParams({
    chat: resolved.chatType,
    target: resolved.targetId,
  });
  return `/app/chat?${params.toString()}`;
}

export function resolveChatLabel(
  link: ParsedChatLink,
  currentUserId: string,
  users: ChatUserLike[],
  groups: ChatGroupLike[],
): string {
  const resolved = resolveChatTargetId(link, currentUserId);
  if (resolved.chatType === "group") {
    const group = groups.find((g) => g.group_id === resolved.targetId);
    return group?.name ?? "Group chat";
  }
  const peer = users.find((u) => u.user_id === resolved.targetId);
  if (peer) return peer.display_name || peer.username || "Direct message";
  if (resolved.dmUserIds) {
    const other = resolved.dmUserIds.find((id) => id !== currentUserId) ?? resolved.dmUserIds[0];
    const fallback = users.find((u) => u.user_id === other);
    return fallback?.display_name ?? fallback?.username ?? "Direct message";
  }
  return "Direct message";
}

export function workflowItemHasChatLink(item: WorkflowItem): boolean {
  return chatLinkFromWorkflowItem(item) !== null;
}
