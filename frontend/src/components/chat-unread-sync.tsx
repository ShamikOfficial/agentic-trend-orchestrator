"use client";

import { useEffect } from "react";
import { listChatUsers, listDirectMessages, listGroupMessages, listGroups } from "@/lib/chat-api";
import { getAuthUser } from "@/lib/auth-store";
import {
  countUnreadMessages,
  setChatUnreadTotal,
  toChatKey,
} from "@/lib/chat-unread-store";

const POLL_MS = (() => {
  const raw = process.env.NEXT_PUBLIC_CHAT_POLL_SECONDS ?? "3";
  const seconds = Number(raw);
  return Math.max(2, Number.isFinite(seconds) ? seconds : 3) * 1000;
})();

/** Background poll so sidebar unread badge stays current on every module. */
export function ChatUnreadSync() {
  useEffect(() => {
    let cancelled = false;

    async function pollUnread() {
      if (document.visibilityState === "hidden") return;

      const currentUserId = getAuthUser()?.user_id ?? "";
      try {
        const [usersResponse, groupsResponse] = (await Promise.all([
          listChatUsers(""),
          listGroups(""),
        ])) as [{ items: { user_id: string }[] }, { items: { group_id: string; joined: boolean }[] }];

        const dmUsers = usersResponse.items.filter((u) => u.user_id !== currentUserId);
        const joinedGroups = groupsResponse.items.filter((g) => g.joined);

        const counts = await Promise.all([
          ...dmUsers.map(async (user) => {
            const response = (await listDirectMessages("", user.user_id)) as {
              items: { message_id: string; sender_id: string }[];
            };
            return countUnreadMessages(toChatKey("dm", user.user_id), response.items, currentUserId);
          }),
          ...joinedGroups.map(async (group) => {
            const response = (await listGroupMessages("", group.group_id)) as {
              items: { message_id: string; sender_id: string }[];
            };
            return countUnreadMessages(toChatKey("group", group.group_id), response.items, currentUserId);
          }),
        ]);

        if (!cancelled) {
          setChatUnreadTotal(counts.reduce((sum, n) => sum + n, 0));
        }
      } catch {
        // Ignore background sync errors.
      }
    }

    void pollUnread();
    const intervalId = window.setInterval(() => {
      void pollUnread();
    }, POLL_MS);

    const onRefresh = () => {
      if (document.visibilityState === "visible") {
        void pollUnread();
      }
    };
    document.addEventListener("visibilitychange", onRefresh);
    window.addEventListener("chat-unread-changed", onRefresh);
    window.addEventListener("auth-changed", onRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onRefresh);
      window.removeEventListener("chat-unread-changed", onRefresh);
      window.removeEventListener("auth-changed", onRefresh);
    };
  }, []);

  return null;
}
