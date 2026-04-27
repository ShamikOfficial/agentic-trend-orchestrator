"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CirclePlus,
  Home,
  Paperclip,
  LogOut,
  MessageCircle,
  Search,
  SendHorizontal,
  Users,
  Workflow,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  ChatApiError,
  createGroup,
  joinGroup,
  listGroupJoinRequests,
  listChatUsers,
  listDirectMessages,
  listGroupMessages,
  listGroups,
  respondToGroupJoinRequest,
  searchChat,
  sendDirectMessage,
  sendGroupMessage,
} from "@/lib/chat-api";
import { clearAuthToken, getAuthToken, getAuthUser } from "@/lib/auth-store";
import { loginPathWithReason } from "@/lib/auth-redirect";

type ChatMode = "dm" | "group";

type ChatUser = {
  user_id: string;
  username: string;
  display_name: string;
};

type ChatGroup = {
  group_id: string;
  name: string;
  description: string;
  member_count: number;
  joined: boolean;
  pending: boolean;
};

type ChatMessage = {
  message_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🙏"];

export default function ChatPage() {
  const router = useRouter();
  const [token, setToken] = useState(() => getAuthToken());
  const [currentUserId, setCurrentUserId] = useState(() => getAuthUser()?.user_id ?? "");
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeTargetId, setActiveTargetId] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("dm");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [composer, setComposer] = useState("");
  const [flash, setFlash] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<ChatUser[]>([]);
  const [searchGroups, setSearchGroups] = useState<ChatGroup[]>([]);
  const [groupRequests, setGroupRequests] = useState<ChatUser[]>([]);
  const [requestGroupId, setRequestGroupId] = useState("");
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [messageReactions, setMessageReactions] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [pickerMessageId, setPickerMessageId] = useState<string | null>(null);
  const composerFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const user = getAuthUser();
    setCurrentUserId(user?.user_id ?? "");
  }, []);

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace(loginPathWithReason("login_required"));
    }
  }, [router]);

  const handleApiError = useCallback(
    (error: unknown) => {
      if (error instanceof ChatApiError && error.status === 401) {
        clearAuthToken();
        setToken("");
        setCurrentUserId("");
        setUsers([]);
        setGroups([]);
        setMessages([]);
        window.dispatchEvent(new Event("auth-changed"));
        router.replace(loginPathWithReason("session_expired"));
        return;
      }
      setFlash(error instanceof Error ? error.message : String(error));
    },
    [router],
  );

  useEffect(() => {
    if (token) {
      void (async () => {
        try {
          const [usersResponse, groupsResponse] = await Promise.all([
            listChatUsers(token),
            listGroups(token),
          ]);
          setUsers(usersResponse.items);
          setGroups(groupsResponse.items);
          if (!activeTargetId) {
            if (usersResponse.items.length > 0) {
              const topDm = usersResponse.items[0];
              setActiveTargetId(topDm.user_id);
              setChatMode("dm");
              const dmResponse = await listDirectMessages(token, topDm.user_id);
              setMessages(dmResponse.items);
            } else if (groupsResponse.items.length > 0) {
              const topGroup = groupsResponse.items[0];
              setActiveTargetId(topGroup.group_id);
              setChatMode("group");
              const groupResponse = await listGroupMessages(token, topGroup.group_id);
              setMessages(groupResponse.items);
            }
          }
        } catch (error) {
          handleApiError(error);
        }
      })();
    }
  }, [token, handleApiError, activeTargetId]);

  async function refreshGroups(currentToken = token) {
    try {
      const response = await listGroups(currentToken);
      setGroups(response.items);
    } catch {
      setFlash("Unable to load groups right now.");
    }
  }

  async function loadMessages(targetId: string, mode: ChatMode) {
    try {
      setActiveTargetId(targetId);
      setChatMode(mode);
      const response =
        mode === "dm"
          ? await listDirectMessages(token, targetId)
          : await listGroupMessages(token, targetId);
      setMessages(response.items);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleSend() {
    if (!activeTargetId || !composer.trim()) return;
    try {
      if (chatMode === "dm") {
        await sendDirectMessage(token, activeTargetId, composer.trim());
        await loadMessages(activeTargetId, "dm");
      } else {
        await sendGroupMessage(token, activeTargetId, composer.trim());
        await loadMessages(activeTargetId, "group");
      }
      setComposer("");
      setComposerFiles([]);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) {
      setFlash("Group name is required.");
      return;
    }
    try {
      await createGroup(token, { name: groupName.trim(), description: groupDescription.trim() });
      setGroupName("");
      setGroupDescription("");
      await refreshGroups();
      setFlash("Group created.");
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleJoinGroup(groupId: string) {
    try {
      await joinGroup(token, groupId);
      await refreshGroups();
      setFlash("Join request sent.");
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleSearch() {
    try {
      const response = await searchChat(token, searchQuery);
      setSearchUsers(response.users);
      setSearchGroups(response.groups);
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleLoadRequests(groupId: string) {
    try {
      const response = await listGroupJoinRequests(token, groupId);
      setGroupRequests(response.items);
      setRequestGroupId(groupId);
    } catch {
      setGroupRequests([]);
      setRequestGroupId("");
      setFlash("Only group admin can review requests.");
    }
  }

  async function handleRequestAction(groupId: string, requesterUserId: string, approve: boolean) {
    try {
      await respondToGroupJoinRequest(token, groupId, requesterUserId, approve);
      await handleLoadRequests(groupId);
      await refreshGroups();
      setFlash(approve ? "Request approved." : "Request rejected.");
    } catch (error) {
      handleApiError(error);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-16 text-muted-foreground">
        Redirecting to sign in…
      </main>
    );
  }

  const activeUser = users.find((user) => user.user_id === activeTargetId);
  const activeGroup = groups.find((group) => group.group_id === activeTargetId);
  const activeTitle = chatMode === "dm" ? (activeUser?.display_name ?? "Direct Messages") : (activeGroup?.name ?? "Group Chat");
  const activeSubtitle =
    chatMode === "dm"
      ? activeUser
        ? `@${activeUser.username}`
        : "Select a user from the left list"
      : activeGroup
        ? `${activeGroup.member_count} members`
        : "Select or create a group";
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  );
  const groupAvatarLabels = useMemo(() => {
    if (chatMode !== "group" || !activeGroup) return [];
    const othersCount = Math.max(0, activeGroup.member_count - (activeGroup.joined ? 1 : 0));
    const visibleCount = Math.min(3, othersCount);
    if (visibleCount === 0) return [];
    const pool = users.filter((user) => user.user_id !== currentUserId);
    return Array.from({ length: visibleCount }, (_, idx) => {
      const candidate = pool[idx];
      return candidate ? initials(candidate.display_name) : `G${idx + 1}`;
    });
  }, [activeGroup, chatMode, currentUserId, users]);

  function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function initials(label: string) {
    return label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase() ?? "")
      .join("");
  }

  function toggleReaction(messageId: string, emoji: string) {
    const actor = currentUserId || "current-user";
    setMessageReactions((prev) => {
      const byMessage = prev[messageId] ?? {};
      const existingActors = byMessage[emoji] ?? [];
      const alreadyReacted = existingActors.includes(actor);
      const nextActors = alreadyReacted
        ? existingActors.filter((id) => id !== actor)
        : [...existingActors, actor];
      const nextByMessage = { ...byMessage };
      if (nextActors.length === 0) {
        delete nextByMessage[emoji];
      } else {
        nextByMessage[emoji] = nextActors;
      }
      return { ...prev, [messageId]: nextByMessage };
    });
  }

  function reactionStats(messageId: string) {
    const byMessage = messageReactions[messageId] ?? {};
    return Object.entries(byMessage).map(([emoji, actors]) => ({
      emoji,
      count: actors.length,
      mine: actors.includes(currentUserId || "current-user"),
    }));
  }

  function handleSignOut() {
    clearAuthToken();
    setToken("");
    setCurrentUserId("");
    window.dispatchEvent(new Event("auth-changed"));
    router.replace(loginPathWithReason("signed_out"));
  }

  function handlePickComposerFiles() {
    composerFileInputRef.current?.click();
  }

  function handleComposerFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    if (selected.length === 0) return;
    setComposerFiles((prev) => [...prev, ...selected]);
    event.target.value = "";
  }

  function removeComposerFile(index: number) {
    setComposerFiles((prev) => prev.filter((_, idx) => idx !== index));
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] bg-[#f6f6f6] px-3 py-4 md:px-6">
      <section className="grid min-h-[86vh] grid-cols-[56px_300px_1fr] overflow-hidden bg-transparent">
        <aside className="flex flex-col items-center justify-between border-r border-black/5 bg-[#f4f4f4] py-4">
          <div className="flex flex-col items-center gap-4">
            <div className="group relative">
              <button
                className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white text-base text-[#222] transition hover:bg-black/5"
                type="button"
                onClick={() => router.push("/")}
                aria-label="Home"
              >
                <Home className="h-5 w-5" />
              </button>
              <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 rounded-md bg-[#111] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                Home
              </span>
            </div>
            <div className="group relative">
              <button
                className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white text-base text-[#222] transition hover:bg-black/5"
                type="button"
                onClick={() => router.push("/team")}
                aria-label="Team"
              >
                <Users className="h-5 w-5" />
              </button>
              <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 rounded-md bg-[#111] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                Team
              </span>
            </div>
            <div className="group relative">
              <button
                className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-[#e8eefc] text-base text-[#22335f]"
                type="button"
                aria-label="Chat"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
              <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 rounded-md bg-[#111] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                Chat
              </span>
            </div>
            <div className="group relative">
              <button
                className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white text-base text-[#222] transition hover:bg-black/5"
                type="button"
                onClick={() => router.push("/workflow")}
                aria-label="Workflow"
              >
                <Workflow className="h-5 w-5" />
              </button>
              <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 rounded-md bg-[#111] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                Workflow
              </span>
            </div>
          </div>
          <div className="group relative">
            <button
              className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white text-base text-[#222] transition hover:bg-black/5"
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 rounded-md bg-[#111] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              Sign out
            </span>
          </div>
        </aside>

        <aside className="border-r border-black/5 bg-[#f7f7f7] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Chats</h2>
            <button className={buttonVariants({ variant: "outline", size: "sm" })} onClick={() => void refreshGroups()} type="button">
              Refresh
            </button>
          </div>

          <input
            className="mb-3 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects/groups"
          />

          {searchOpen ? (
            <div className="mb-3 rounded-xl border border-black/10 bg-white p-3">
              <button className={buttonVariants({ variant: "outline", size: "sm" })} type="button" onClick={() => void handleSearch()}>
                Run Search
              </button>
              <div className="mt-2 space-y-2">
                {searchUsers.map((user) => (
                  <button
                    key={user.user_id}
                    className="w-full rounded-lg border border-black/10 bg-[#f9f9f9] px-2 py-2 text-left text-xs"
                    type="button"
                    onClick={() => void loadMessages(user.user_id, "dm")}
                  >
                    {user.display_name}
                  </button>
                ))}
                {searchGroups.map((group) => (
                  <div key={group.group_id} className="rounded-lg border border-black/10 bg-[#f9f9f9] p-2 text-xs">
                    <p className="font-medium">{group.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button className={buttonVariants({ variant: "outline", size: "xs" })} type="button" onClick={() => void loadMessages(group.group_id, "group")}>
                        Open
                      </button>
                      {!group.joined && !group.pending ? (
                        <button className={buttonVariants({ size: "xs" })} type="button" onClick={() => void handleJoinGroup(group.group_id)}>
                          Join
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {createOpen ? (
            <div className="mb-3 rounded-xl border border-black/10 bg-white p-3">
              <h3 className="mb-2 text-sm font-semibold">Create Group</h3>
              <input
                className="mb-2 h-9 w-full rounded-lg border border-black/10 px-3 text-sm"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
              />
              <input
                className="mb-2 h-9 w-full rounded-lg border border-black/10 px-3 text-sm"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Description"
              />
              <button className={buttonVariants({ size: "sm" })} onClick={() => void handleCreateGroup()} type="button">
                Create
              </button>
            </div>
          ) : null}

          <div className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Direct</p>
          </div>
          <div className="space-y-1.5">
            {users.map((user) => (
              <button
                key={user.user_id}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition ${
                  chatMode === "dm" && activeTargetId === user.user_id
                    ? "bg-[#ececec]"
                    : "hover:bg-[#efefef]"
                }`}
                type="button"
                onClick={() => void loadMessages(user.user_id, "dm")}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-xs font-semibold text-muted-foreground">
                  {initials(user.display_name)}
                </span>
                <span className="truncate text-sm font-medium">{user.display_name}</span>
              </button>
            ))}
          </div>

          <div className="mb-2 mt-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Groups</p>
            <button className={buttonVariants({ variant: "outline", size: "xs" })} type="button" onClick={() => void refreshGroups()}>
              Sync
            </button>
          </div>
          <div className="space-y-1.5">
            {groups.map((group) => (
              <div key={group.group_id} className={`rounded-xl px-2 py-2 ${chatMode === "group" && activeTargetId === group.group_id ? "bg-[#ececec]" : "hover:bg-[#efefef]"}`}>
                <button className="flex w-full items-center justify-between text-left" type="button" onClick={() => void loadMessages(group.group_id, "group")}>
                  <span className="truncate pr-2 text-sm font-medium">{group.name}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground">{group.member_count}</span>
                </button>
                <div className="mt-2 flex flex-wrap gap-1">
                  {!group.joined && !group.pending ? (
                    <button className={buttonVariants({ size: "xs" })} type="button" onClick={() => void handleJoinGroup(group.group_id)}>
                      Request
                    </button>
                  ) : null}
                  <button className={buttonVariants({ variant: "outline", size: "xs" })} type="button" onClick={() => void handleLoadRequests(group.group_id)}>
                    Requests
                  </button>
                  {group.pending ? <span className="text-[10px] text-muted-foreground">Pending</span> : null}
                </div>
              </div>
            ))}
          </div>

          {groupRequests.length > 0 ? (
            <div className="mt-3 rounded-xl border border-black/10 bg-white p-2">
              <p className="mb-2 text-xs font-semibold">Join Requests</p>
              {groupRequests.map((requester) => (
                <div key={requester.user_id} className="mb-1 flex items-center justify-between text-xs">
                  <span>{requester.display_name}</span>
                  <div className="flex gap-1">
                    <button className={buttonVariants({ size: "xs" })} type="button" onClick={() => void handleRequestAction(requestGroupId, requester.user_id, true)}>
                      Approve
                    </button>
                    <button className={buttonVariants({ variant: "outline", size: "xs" })} type="button" onClick={() => void handleRequestAction(requestGroupId, requester.user_id, false)}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="flex flex-col bg-[#fdfdfd]">
          <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <div className="flex items-center gap-3">
              {groupAvatarLabels.length > 0 ? (
                <div className="flex -space-x-2">
                  {groupAvatarLabels.map((label, idx) => (
                    <span
                      key={`${label}-${idx}`}
                      className="grid h-8 w-8 place-items-center rounded-full border border-white bg-[#ececec] text-[11px] font-semibold text-[#4a4a4a]"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
              <div>
                <h3 className="text-base font-semibold">{activeTitle}</h3>
                <p className="text-xs text-muted-foreground">{activeSubtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#96a9d6] bg-[#dfe8fb] px-4 text-sm font-semibold text-[#1f3566] shadow-sm transition hover:bg-[#d3e0fb]"
                type="button"
                onClick={() => void handleSearch()}
                aria-label="Search in chats"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#1b2c53] bg-[#1f3566] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#172b58]"
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                aria-label="Create group"
              >
                <CirclePlus className="h-4 w-4" />
                <span>Add Group</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-[#f7f7f7] px-4 py-4">
            {sortedMessages.length === 0 ? (
              <div className="grid h-full place-items-center rounded-2xl border border-dashed border-black/10 bg-white text-sm text-muted-foreground">
                Select a user or group to start chatting.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedMessages.map((msg) => {
                  const mine = currentUserId !== "" && msg.sender_id === currentUserId;
                  const stats = reactionStats(msg.message_id);
                  return (
                    <div
                      key={msg.message_id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      onMouseEnter={() => setHoveredMessageId(msg.message_id)}
                      onMouseLeave={() => {
                        if (pickerMessageId !== msg.message_id) setHoveredMessageId(null);
                      }}
                    >
                      <div className={`max-w-[72%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                        {!mine ? (
                          <p className="text-[11px] font-medium text-[#5f6fcf]">{msg.sender_id}</p>
                        ) : null}
                        <div className="relative">
                          <div className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${mine ? "rounded-br-md bg-black text-white" : "rounded-bl-md bg-[#e8e8e8] text-[#222]"}`}>
                            {msg.content}
                          </div>
                          {hoveredMessageId === msg.message_id ? (
                            <div className={`absolute -top-9 ${mine ? "right-0" : "left-0"} flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1 shadow-sm`}>
                              {QUICK_REACTIONS.map((emoji) => (
                                <button
                                  key={`${msg.message_id}-${emoji}`}
                                  className="grid h-6 w-6 place-items-center rounded-full text-sm transition hover:bg-black/5"
                                  type="button"
                                  onClick={() => toggleReaction(msg.message_id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                className="grid h-6 w-6 place-items-center rounded-full text-xs text-muted-foreground transition hover:bg-black/5"
                                type="button"
                                onClick={() =>
                                  setPickerMessageId((prev) =>
                                    prev === msg.message_id ? null : msg.message_id,
                                  )
                                }
                                aria-label="Add emoji reaction"
                              >
                                +
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {pickerMessageId === msg.message_id ? (
                          <div className="mt-1 flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1 shadow-sm">
                            {["😀", "🎉", "✅", "😮", "😢"].map((emoji) => (
                              <button
                                key={`${msg.message_id}-picker-${emoji}`}
                                className="grid h-6 w-6 place-items-center rounded-full text-sm transition hover:bg-black/5"
                                type="button"
                                onClick={() => {
                                  toggleReaction(msg.message_id, emoji);
                                  setPickerMessageId(null);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {stats.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {stats.map((item) => (
                              <button
                                key={`${msg.message_id}-stat-${item.emoji}`}
                                type="button"
                                onClick={() => toggleReaction(msg.message_id, item.emoji)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${item.mine ? "border-black/30 bg-black/5 text-black" : "border-black/10 bg-white text-muted-foreground"}`}
                              >
                                {item.emoji} {item.count}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="border-t border-black/5 bg-white px-4 py-3">
            {flash ? <p className="mb-2 text-xs text-muted-foreground">{flash}</p> : null}
            {composerFiles.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {composerFiles.map((file, index) => (
                  <button
                    key={`${file.name}-${file.size}-${index}`}
                    type="button"
                    onClick={() => removeComposerFile(index)}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#f4f4f4] px-2 py-1 text-[11px] text-[#333] hover:bg-[#ececec]"
                    title="Click to remove"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-40 truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#fafafa] px-2 py-2">
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-black/5"
                type="button"
                onClick={handlePickComposerFiles}
                aria-label="Add attachments"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={composerFileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.rar"
                onChange={handleComposerFilesChange}
              />
              <input
                className="h-9 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/80"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Enter your message"
              />
              <button
                className="grid h-8 w-8 place-items-center rounded-full bg-[#d9d9d9] text-xs text-black transition hover:bg-[#cdcdcd] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleSend()}
                disabled={!activeTargetId || !composer.trim()}
                aria-label="Send message"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </section>
      </section>
    </main>
  );
}
