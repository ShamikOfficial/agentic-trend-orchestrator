"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { clearAuthToken, getAuthToken } from "@/lib/auth-store";
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

export default function ChatPage() {
  const router = useRouter();
  const [token, setToken] = useState(() => getAuthToken());
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
        } catch (error) {
          handleApiError(error);
        }
      })();
    }
  }, [token, handleApiError]);

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
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleCreateGroup() {
    try {
      await createGroup(token, { name: groupName, description: groupDescription });
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-8 md:px-8">
      <p className="text-sm text-muted-foreground">{flash || "Chat"}</p>

      <section className="grid gap-4 lg:grid-cols-4">
        <aside className="rounded-xl border bg-card p-4 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button className={buttonVariants({ variant: "outline", size: "sm" })} type="button" onClick={() => setSearchOpen((v) => !v)}>
              Search
            </button>
            <button className={buttonVariants({ size: "sm" })} type="button" onClick={() => setCreateOpen((v) => !v)}>
              Create
            </button>
          </div>
          {searchOpen ? (
            <div className="mb-3 rounded-lg border p-2">
              <input
                className="mb-2 h-9 w-full rounded border px-2 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users or groups"
              />
              <button className={buttonVariants({ variant: "outline", size: "sm" })} type="button" onClick={() => void handleSearch()}>
                Run Search
              </button>
              <div className="mt-2 space-y-2">
                {searchUsers.map((user) => (
                  <button
                    key={user.user_id}
                    className="w-full rounded border px-2 py-1 text-left text-xs"
                    type="button"
                    onClick={() => void loadMessages(user.user_id, "dm")}
                  >
                    User: {user.display_name}
                  </button>
                ))}
                {searchGroups.map((group) => (
                  <div key={group.group_id} className="rounded border p-2 text-xs">
                    <p>{group.name}</p>
                    <div className="mt-1 flex gap-1">
                      <button className={buttonVariants({ variant: "outline", size: "xs" })} type="button" onClick={() => void loadMessages(group.group_id, "group")}>
                        Open
                      </button>
                      {!group.joined && !group.pending ? (
                        <button className={buttonVariants({ size: "xs" })} type="button" onClick={() => void handleJoinGroup(group.group_id)}>
                          Request Join
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            {users.map((user) => (
              <button
                key={user.user_id}
                className="w-full rounded border px-3 py-2 text-left text-sm"
                type="button"
                onClick={() => void loadMessages(user.user_id, "dm")}
              >
                {user.display_name} (@{user.username})
              </button>
            ))}
          </div>
          {createOpen ? (
            <>
              <hr className="my-4" />
              <h3 className="mb-2 font-semibold">Create Group</h3>
              <input className="mb-2 h-10 w-full rounded border px-3 text-sm" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="group name" />
              <input
                className="mb-2 h-10 w-full rounded border px-3 text-sm"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="description"
              />
              <button className={buttonVariants({ size: "sm" })} onClick={() => void handleCreateGroup()} type="button">
                Create
              </button>
            </>
          ) : null}
          <hr className="my-4" />
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Groups</h3>
            <button className={buttonVariants({ variant: "outline", size: "sm" })} onClick={() => void refreshGroups()} type="button">
              Refresh
            </button>
          </div>
          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.group_id} className="rounded border p-2 text-sm">
                <p className="font-medium">{group.name}</p>
                <p className="text-xs text-muted-foreground">{group.description}</p>
                <div className="mt-2 flex gap-2">
                  <button className={buttonVariants({ variant: "outline", size: "xs" })} type="button" onClick={() => void loadMessages(group.group_id, "group")}>
                    Open
                  </button>
                  {!group.joined && !group.pending ? (
                    <button className={buttonVariants({ size: "xs" })} type="button" onClick={() => void handleJoinGroup(group.group_id)}>
                      Request
                    </button>
                  ) : null}
                  {group.pending ? <span className="text-[10px] text-muted-foreground">Pending</span> : null}
                  <button className={buttonVariants({ variant: "outline", size: "xs" })} type="button" onClick={() => void handleLoadRequests(group.group_id)}>
                    Requests
                  </button>
                </div>
              </div>
            ))}
          </div>
          {groupRequests.length > 0 ? (
            <div className="mt-3 rounded border p-2">
              <p className="mb-1 text-xs font-semibold">Join Requests</p>
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

        <section className="rounded-xl border bg-card p-4 lg:col-span-3">
          <h3 className="font-semibold">
            Conversation {chatMode.toUpperCase()} {activeTargetId ? `(${activeTargetId})` : ""}
          </h3>
          <div className="mt-3 h-[55vh] overflow-auto rounded border bg-muted/30 p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Select a user or group to chat.</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.message_id} className="mb-2 rounded bg-background p-2">
                  <p className="text-xs text-muted-foreground">{msg.sender_id}</p>
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="h-10 flex-1 rounded border px-3 text-sm" value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Type message..." />
            <button className={buttonVariants()} type="button" onClick={() => void handleSend()} disabled={!activeTargetId}>
              Send
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
