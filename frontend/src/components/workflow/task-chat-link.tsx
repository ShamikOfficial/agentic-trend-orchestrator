"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import {
  buildChatHref,
  chatLinkFromWorkflowItem,
  resolveChatLabel,
} from "@/lib/chat-link-utils";
import type { WorkflowItem } from "@/types/api";

type ChatUserLike = { user_id: string; display_name: string; username?: string };
type ChatGroupLike = { group_id: string; name: string };

type TaskChatLinkProps = {
  item: WorkflowItem;
  currentUserId: string;
  users: ChatUserLike[];
  groups: ChatGroupLike[];
  className?: string;
};

export function TaskChatLink({ item, currentUserId, users, groups, className }: TaskChatLinkProps) {
  const link = chatLinkFromWorkflowItem(item);
  if (!link || !currentUserId) return null;

  const href = buildChatHref(link, currentUserId);
  const label = resolveChatLabel(link, currentUserId, users, groups);
  const prefix = link.chatType === "group" ? "Group" : "Chat with";

  return (
    <div className={className}>
      <span className="text-[#9a9ea6]">Linked chat: </span>
      <Link
        href={href}
        className="inline-flex items-center gap-1 font-medium text-[#1f3566] underline decoration-[#96a9d6]/60 underline-offset-2 hover:text-[#172b58] hover:decoration-[#1f3566]"
      >
        <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {prefix} {label}
        </span>
      </Link>
    </div>
  );
}
