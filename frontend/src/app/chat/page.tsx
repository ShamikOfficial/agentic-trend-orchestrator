"use client";

import { ChangeEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  CirclePlus,
  FilePenLine,
  FolderOpen,
  ListTodo,
  Mic,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Paperclip,
  QrCode,
  Search,
  SendHorizontal,
  Smile,
  Sparkles,
  Trash2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChatApiError,
  applyTaskAction,
  askChatAi,
  createGroup,
  deleteChatConversation,
  deleteDirectMessage,
  deleteGroupMessage,
  extractChatTasks,
  joinGroup,
  listChatTaskAnalysisSections,
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
import { ChatInfoCalendar } from "@/components/chat/chat-info-calendar";
import { ChatSchedulePicker } from "@/components/chat/chat-schedule-picker";
import { SuggestionScheduleEditor } from "@/components/chat/suggestion-schedule-editor";
import {
  isAvailabilityQuestion,
  loadStoredExternalEvents,
  hasRequiredScheduleFields,
  mergeTaskSuggestions,
  reindexSuggestionRecord,
  enrichSuggestionWithSchedule,
  formatScheduleLabel,
  labelsFromScheduleFields,
  scheduleFieldsFromSuggestions,
  suggestionHasPrefilledSchedule,
  suggestionNeedsSchedule,
} from "@/lib/schedule-utils";
import { visibleChatAiActions } from "@/lib/feature-flags";
import type { ChatTaskAnalysisSection, ChatTaskSuggestion } from "@/types/api";

type ChatMode = "dm" | "group";

const CHAT_POLL_INTERVAL_MS = (() => {
  const raw = process.env.NEXT_PUBLIC_CHAT_POLL_SECONDS ?? "3";
  const seconds = Number(raw);
  return Math.max(2, Number.isFinite(seconds) ? seconds : 3) * 1000;
})();

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

function chatMessageThreadKey(items: ChatMessage[]): string {
  if (items.length === 0) return "";
  const last = items.at(-1);
  if (!last) return "";
  return `${items.length}:${last.message_id}:${last.content}`;
}

type ChatMessageSearchHit = {
  message_id: string;
  content: string;
  preview: string;
  chat_type: ChatMode;
  target_id: string;
  chat_name: string;
  created_at: string;
  sender_id: string;
};

type ListResponse<T> = { items: T[] };

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🙏"];

/** `@chat` anywhere in the message triggers Ask AI; question is the text with @chat tokens removed. */
function parseChatAiIntent(text: string): { isAskAi: boolean; question: string | null } {
  const trimmed = text.trim();
  if (!/@chat\b/i.test(trimmed)) {
    return { isAskAi: false, question: null };
  }
  const withoutTag = trimmed
    .replace(/@chat\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { isAskAi: true, question: withoutTag.length > 0 ? withoutTag : null };
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeTargetId, setActiveTargetId] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("dm");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [composer, setComposer] = useState("");
  const [flash, setFlash] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<ChatUser[]>([]);
  const [searchGroups, setSearchGroups] = useState<ChatGroup[]>([]);
  const [searchMessageHits, setSearchMessageHits] = useState<ChatMessageSearchHit[]>([]);
  const [listSearchBusy, setListSearchBusy] = useState(false);
  const [localSearchOpen, setLocalSearchOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [localSearchIndex, setLocalSearchIndex] = useState(0);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);
  const [groupRequests, setGroupRequests] = useState<ChatUser[]>([]);
  const [requestGroupId, setRequestGroupId] = useState("");
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [messageReactions, setMessageReactions] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [pickerMessageId, setPickerMessageId] = useState<string | null>(null);
  const composerFileInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextRef = useRef<HTMLInputElement | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement | null>(null);
  const localSearchInputRef = useRef<HTMLInputElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const skipLocalSearchResetRef = useRef(false);
  const isAnalyzingTasksRef = useRef(false);
  const lastSyncedMessageKeyRef = useRef("");
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [askAiBusy, setAskAiBusy] = useState(false);
  const [aiReply, setAiReply] = useState<{ content: string } | null>(null);
  const [showAIActions, setShowAIActions] = useState(false);
  const [taskSuggestions, setTaskSuggestions] = useState<ChatTaskSuggestion[]>([]);
  const [isAnalyzingTasks, setIsAnalyzingTasks] = useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const [workItemsRefreshKey, setWorkItemsRefreshKey] = useState(0);
  const [suggestionScheduleFields, setSuggestionScheduleFields] = useState<
    Record<number, Record<string, string>>
  >({});
  const [suggestionScheduleLabels, setSuggestionScheduleLabels] = useState<Record<number, string>>({});
  const [showAiSchedulePicker, setShowAiSchedulePicker] = useState(false);
  const [lastAvailabilityQuestion, setLastAvailabilityQuestion] = useState("");
  const [deleteChatBusy, setDeleteChatBusy] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [analysisSections, setAnalysisSections] = useState<ChatTaskAnalysisSection[]>([]);
  const [taskAnalysisBatchSize, setTaskAnalysisBatchSize] = useState(5);
  const [pendingTaskMessages, setPendingTaskMessages] = useState(0);

  const authed = sessionStatus === "authenticated" || Boolean(token);
  /** Empty string for OAuth: chat-api falls back to Bearer via resolveApiAuthHeaders. */
  const apiAuth = token;

  useEffect(() => {
    setToken(getAuthToken());
    setCurrentUserId(getAuthUser()?.user_id ?? "");
    setMounted(true);
  }, []);

  useEffect(() => {
    const onAuthChanged = () => {
      setToken(getAuthToken());
      setCurrentUserId(getAuthUser()?.user_id ?? "");
    };
    window.addEventListener("auth-changed", onAuthChanged);
    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, []);

  useEffect(() => {
    if (!mounted || sessionStatus === "loading") return;
    if (!authed) {
      router.replace(loginPathWithReason("login_required"));
    }
  }, [mounted, sessionStatus, authed, router]);

  useEffect(() => {
    setAiReply(null);
    setTaskSuggestions([]);
    setTaskPanelOpen(false);
    setSuggestionScheduleFields({});
    setSuggestionScheduleLabels({});
    setShowAiSchedulePicker(false);
    setLastAvailabilityQuestion("");
    setAnalysisSections([]);
    setPendingTaskMessages(0);
    lastSyncedMessageKeyRef.current = "";
    if (skipLocalSearchResetRef.current) {
      skipLocalSearchResetRef.current = false;
    } else {
      setLocalSearchOpen(false);
      setLocalSearchQuery("");
      setLocalSearchIndex(0);
      setPendingScrollMessageId(null);
    }
  }, [activeTargetId, chatMode]);

  const refreshAnalysisSections = useCallback(async () => {
    if (!activeTargetId) {
      setAnalysisSections([]);
      setPendingTaskMessages(0);
      return;
    }
    try {
      const data = await listChatTaskAnalysisSections(apiAuth, {
        chat_type: chatMode,
        target_id: activeTargetId,
      });
      setAnalysisSections(data.sections);
      setTaskAnalysisBatchSize(data.batch_size);
      setPendingTaskMessages(data.pending_count);
    } catch {
      setAnalysisSections([]);
    }
  }, [activeTargetId, apiAuth, chatMode]);

  useEffect(() => {
    isAnalyzingTasksRef.current = isAnalyzingTasks;
  }, [isAnalyzingTasks]);

  useEffect(() => {
    void refreshAnalysisSections();
  }, [refreshAnalysisSections, messages.length, workItemsRefreshKey]);

  const sectionStartIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of analysisSections) {
      if (s.first_message_id) set.add(s.first_message_id);
    }
    return set;
  }, [analysisSections]);

  const messageSectionIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of analysisSections) {
      for (const id of s.message_ids) {
        map.set(id, s.batch_index);
      }
    }
    return map;
  }, [analysisSections]);

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
    if (!authed) return;
    void (async () => {
      try {
        const [usersResponse, groupsResponse] = (await Promise.all([
          listChatUsers(apiAuth),
          listGroups(apiAuth),
        ])) as [{ items: ChatUser[] }, { items: ChatGroup[] }];
        setUsers(usersResponse.items);
        setGroups(groupsResponse.items);

        const chatFromUrl = searchParams.get("chat");
        const targetFromUrl = searchParams.get("target")?.trim() ?? "";
        if (targetFromUrl && (chatFromUrl === "dm" || chatFromUrl === "group")) {
          setActiveTargetId(targetFromUrl);
          setChatMode(chatFromUrl);
          const response = ((chatFromUrl === "dm"
            ? await listDirectMessages(apiAuth, targetFromUrl)
            : await listGroupMessages(apiAuth, targetFromUrl)) as ListResponse<ChatMessage>);
          setMessages(response.items);
          lastSyncedMessageKeyRef.current = chatMessageThreadKey(response.items);
          return;
        }

        if (!activeTargetId) {
          if (usersResponse.items.length > 0) {
            const topDm = usersResponse.items[0];
            setActiveTargetId(topDm.user_id);
            setChatMode("dm");
            const dmResponse = (await listDirectMessages(apiAuth, topDm.user_id)) as ListResponse<ChatMessage>;
            setMessages(dmResponse.items);
            lastSyncedMessageKeyRef.current = chatMessageThreadKey(dmResponse.items);
          } else if (groupsResponse.items.length > 0) {
            const topGroup = groupsResponse.items[0];
            setActiveTargetId(topGroup.group_id);
            setChatMode("group");
            const groupResponse = (await listGroupMessages(apiAuth, topGroup.group_id)) as ListResponse<ChatMessage>;
            setMessages(groupResponse.items);
            lastSyncedMessageKeyRef.current = chatMessageThreadKey(groupResponse.items);
          }
        }
      } catch (error) {
        handleApiError(error);
      }
    })();
  }, [authed, apiAuth, handleApiError, activeTargetId, searchParams]);

  async function refreshGroups(currentToken = apiAuth) {
    try {
      const response = (await listGroups(currentToken)) as ListResponse<ChatGroup>;
      setGroups(response.items);
    } catch {
      setFlash("Unable to load groups right now.");
    }
  }

  async function loadMessages(targetId: string, mode: ChatMode, scrollToMessageId?: string) {
    try {
      setActiveTargetId(targetId);
      setChatMode(mode);
      const response = ((mode === "dm"
        ? await listDirectMessages(apiAuth, targetId)
        : await listGroupMessages(apiAuth, targetId)) as ListResponse<ChatMessage>);
      setMessages(response.items);
      lastSyncedMessageKeyRef.current = chatMessageThreadKey(response.items);
      if (scrollToMessageId) {
        setPendingScrollMessageId(scrollToMessageId);
      }
    } catch (error) {
      handleApiError(error);
    }
  }

  const runUniversalSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setSearchUsers([]);
        setSearchGroups([]);
        setSearchMessageHits([]);
        return;
      }
      setListSearchBusy(true);
      try {
        const response = (await searchChat(apiAuth, trimmed)) as {
          users: ChatUser[];
          groups: ChatGroup[];
          messages: ChatMessageSearchHit[];
        };
        setSearchUsers(response.users ?? []);
        setSearchGroups(response.groups ?? []);
        setSearchMessageHits(response.messages ?? []);
      } catch (error) {
        handleApiError(error);
      } finally {
        setListSearchBusy(false);
      }
    },
    [apiAuth, handleApiError],
  );

  function openLocalSearch(initialQuery = "") {
    if (!activeTargetId) {
      setFlash("Select a chat first.");
      return;
    }
    setLocalSearchOpen(true);
    setLocalSearchQuery(initialQuery);
    setLocalSearchIndex(0);
    window.setTimeout(() => localSearchInputRef.current?.focus(), 0);
  }

  async function openMessageSearchHit(hit: ChatMessageSearchHit) {
    const q = listSearchQuery.trim();
    skipLocalSearchResetRef.current = true;
    await loadMessages(hit.target_id, hit.chat_type, hit.message_id);
    setLocalSearchQuery(q);
    setLocalSearchOpen(true);
    setLocalSearchIndex(0);
    window.setTimeout(() => localSearchInputRef.current?.focus(), 0);
  }

  async function handleSend() {
    if (!activeTargetId || !composer.trim()) return;
    const body = composer.trim();
    const { isAskAi, question } = parseChatAiIntent(body);
    if (isAskAi && question === null) {
      setFlash("Add your question after @chat (or use Ask AI below).");
      return;
    }
    if (isAskAi && question !== null) {
      setAskAiBusy(true);
      setFlash("");
      setShowAiSchedulePicker(false);
      try {
        const availability = isAvailabilityQuestion(question);
        const result = (await askChatAi(apiAuth, {
          chat_type: chatMode === "dm" ? "dm" : "group",
          target_id: activeTargetId,
          question,
          external_events: loadStoredExternalEvents(),
        })) as {
          answer: string;
          task_suggestions?: ChatTaskSuggestion[];
          show_schedule_picker?: boolean;
        };
        setAiReply({ content: result.answer });
        const aiSuggestions = result.task_suggestions;
        if (aiSuggestions && aiSuggestions.length > 0) {
          setTaskSuggestions((prev) => {
            const enriched = aiSuggestions.map((s) => enrichSuggestionWithSchedule(s));
            const merged = mergeTaskSuggestions(prev, enriched);
            const prefilled = scheduleFieldsFromSuggestions(merged);
            setSuggestionScheduleFields(prefilled);
            setSuggestionScheduleLabels(labelsFromScheduleFields(prefilled));
            return merged;
          });
          setTaskPanelOpen(true);
        }
        if (availability || result.show_schedule_picker) {
          setLastAvailabilityQuestion(question);
          setShowAiSchedulePicker(true);
        }
        if (chatMode === "dm") {
          await sendDirectMessage(apiAuth, activeTargetId, body);
          await loadMessages(activeTargetId, "dm");
        } else {
          await sendGroupMessage(apiAuth, activeTargetId, body);
          await loadMessages(activeTargetId, "group");
        }
        setComposer("");
        setComposerFiles([]);
      } catch (error) {
        handleApiError(error);
      } finally {
        setAskAiBusy(false);
      }
      return;
    }
    try {
      if (chatMode === "dm") {
        await sendDirectMessage(apiAuth, activeTargetId, body);
        await loadMessages(activeTargetId, "dm");
      } else {
        await sendGroupMessage(apiAuth, activeTargetId, body);
        await loadMessages(activeTargetId, "group");
      }
      setComposer("");
      setComposerFiles([]);
      void triggerTaskExtraction(false);
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
      await createGroup(apiAuth, { name: groupName.trim(), description: groupDescription.trim() });
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
      await joinGroup(apiAuth, groupId);
      await refreshGroups();
      setFlash("Join request sent.");
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleLoadRequests(groupId: string) {
    try {
      const response = (await listGroupJoinRequests(apiAuth, groupId)) as ListResponse<{
        user_id: string;
        username: string;
        display_name: string;
      }>;
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
      await respondToGroupJoinRequest(apiAuth, groupId, requesterUserId, approve);
      await handleLoadRequests(groupId);
      await refreshGroups();
      setFlash(approve ? "Request approved." : "Request rejected.");
    } catch (error) {
      handleApiError(error);
    }
  }

  function handleAiAction(label: string) {
    setShowAIActions(false);
    const normalized = label.toLowerCase();
    if (normalized.includes("summarize")) {
      setComposer((c) => (c.trim() ? `${c.trim()} ` : "") + "@chat summarize this conversation with key decisions and blockers");
      setFlash("Drafted @chat summary prompt. Press Enter to run.");
      composerTextRef.current?.focus();
      return;
    }
    if (normalized.includes("extract tasks")) {
      void triggerTaskExtraction(true);
      setFlash("Analyzing chat for tasks…");
      return;
    }
    if (normalized.includes("assign")) {
      setComposer(
        (c) =>
          (c.trim() ? `${c.trim()} ` : "") +
          "@chat assign owners to actionable tasks from this conversation",
      );
      setFlash("Drafted @chat assign prompt. Press Enter to run.");
      composerTextRef.current?.focus();
      return;
    }
    setFlash(`${label} is UI-only for now (backend workflow route not available).`);
  }

  const triggerTaskExtraction = useCallback(
    async (force: boolean, options?: { silent?: boolean }) => {
      if (!activeTargetId || isAnalyzingTasksRef.current) return;
      if (!options?.silent) {
        setIsAnalyzingTasks(true);
      }
      isAnalyzingTasksRef.current = true;
      try {
        const result = await extractChatTasks(apiAuth, {
          chat_type: chatMode,
          target_id: activeTargetId,
          force,
          client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        if (result.status === "already_analyzed") {
          setTaskSuggestions([]);
          setSuggestionScheduleFields({});
          setSuggestionScheduleLabels({});
          if (!options?.silent) {
            setFlash(result.message ?? "All messages already analyzed. Send a new message first.");
          }
          return;
        }
        if (result.status === "pending") {
          const need =
            result.pending_until_analyze ??
            Math.max(0, (result.threshold ?? taskAnalysisBatchSize) - result.unanalyzed_count);
          if (force && !options?.silent) {
            setFlash(
              `Need ${need} more message(s) to analyze the next section (${result.unanalyzed_count}/${result.threshold ?? taskAnalysisBatchSize} collected).`,
            );
          }
          return;
        }
        const extracted = result.suggestions ?? [];
        void refreshAnalysisSections();
        if (result.status === "analyzed" && extracted.length > 0) {
          setTaskSuggestions(() => {
            const enriched = extracted.map((s) => enrichSuggestionWithSchedule(s));
            const prefilled = scheduleFieldsFromSuggestions(enriched);
            setSuggestionScheduleFields(prefilled);
            setSuggestionScheduleLabels(labelsFromScheduleFields(prefilled));
            return enriched;
          });
          setTaskPanelOpen(true);
        } else if (result.status === "analyzed" && extracted.length === 0 && !options?.silent) {
          const batch = result.analysis_batch;
          setFlash(
            batch
              ? `Section #${batch.batch_index + 1} analyzed — no new task changes (already applied or up to date).`
              : "No new task changes — items already match the chat.",
          );
        }
      } catch (error) {
        if (force && !options?.silent) {
          handleApiError(error);
        }
      } finally {
        isAnalyzingTasksRef.current = false;
        if (!options?.silent) {
          setIsAnalyzingTasks(false);
        }
      }
    },
    [activeTargetId, apiAuth, chatMode, handleApiError, refreshAnalysisSections, taskAnalysisBatchSize],
  );

  const pollActiveChat = useCallback(async () => {
    if (!activeTargetId || document.visibilityState === "hidden") return;
    try {
      const response = ((chatMode === "dm"
        ? await listDirectMessages(apiAuth, activeTargetId)
        : await listGroupMessages(apiAuth, activeTargetId)) as ListResponse<ChatMessage>);
      const nextKey = chatMessageThreadKey(response.items);
      const changed = nextKey !== lastSyncedMessageKeyRef.current;
      if (changed) {
        lastSyncedMessageKeyRef.current = nextKey;
        setMessages(response.items);
      }

      const sectionsData = await listChatTaskAnalysisSections(apiAuth, {
        chat_type: chatMode,
        target_id: activeTargetId,
      });
      setAnalysisSections(sectionsData.sections);
      setTaskAnalysisBatchSize(sectionsData.batch_size);
      setPendingTaskMessages(sectionsData.pending_count);

      if (
        changed &&
        sectionsData.pending_count >= sectionsData.batch_size &&
        !isAnalyzingTasksRef.current
      ) {
        void triggerTaskExtraction(false, { silent: true });
      }
    } catch {
      // Background sync — ignore transient errors.
    }
  }, [activeTargetId, apiAuth, chatMode, triggerTaskExtraction]);

  useEffect(() => {
    if (!authed || !activeTargetId) return;
    const id = window.setInterval(() => {
      void pollActiveChat();
    }, CHAT_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [authed, activeTargetId, pollActiveChat]);

  async function handleAcceptSuggestion(index: number) {
    const suggestion = taskSuggestions[index];
    if (!suggestion) return;
    const scheduleFields = suggestionScheduleFields[index] ?? {};
    if (!hasRequiredScheduleFields(scheduleFields, suggestion)) {
      setFlash("Pick a date and time for this task before accepting.");
      return;
    }
    setApplyingIndex(index);
    try {
      const mergedUpdateFields: Record<string, string> = {
        ...(suggestion.update_fields ?? {}),
        ...scheduleFields,
      };
      const desc = (suggestion.description || mergedUpdateFields.description || "").trim();
      if (desc) {
        mergedUpdateFields.description = desc;
      }
      await applyTaskAction(apiAuth, {
        action: suggestion.action,
        title: suggestion.title || undefined,
        description: suggestion.description || undefined,
        owner: suggestion.owner || undefined,
        priority: suggestion.priority || undefined,
        existing_item_id: suggestion.existing_item_id || undefined,
        update_fields:
          Object.keys(mergedUpdateFields).length > 0 ? mergedUpdateFields : undefined,
        comment: suggestion.comment || undefined,
        chat_type: chatMode,
        target_id: activeTargetId,
        source_message_batch_index: suggestion.source_message_batch_index,
        source_message_ids: suggestion.source_message_ids,
        source_first_message_id: suggestion.source_first_message_id,
        source_last_message_id:
          suggestion.source_message_id ?? suggestion.source_last_message_id,
      });
      setTaskSuggestions((prev) => prev.filter((_, i) => i !== index));
      setSuggestionScheduleFields((prev) => reindexSuggestionRecord(prev, index));
      setSuggestionScheduleLabels((prev) => reindexSuggestionRecord(prev, index));
      setWorkItemsRefreshKey((k) => k + 1);
      const when = suggestionScheduleLabels[index];
      setFlash(
        when
          ? `Task saved with schedule: ${when}.`
          : `Task ${suggestion.action === "create" ? "created" : suggestion.action === "update" ? "updated" : suggestion.action === "close" ? "closed" : "commented"} successfully.`,
      );
    } catch (error) {
      handleApiError(error);
    } finally {
      setApplyingIndex(null);
    }
  }

  function handleRejectSuggestion(index: number) {
    setTaskSuggestions((prev) => prev.filter((_, i) => i !== index));
    setSuggestionScheduleFields((prev) => reindexSuggestionRecord(prev, index));
    setSuggestionScheduleLabels((prev) => reindexSuggestionRecord(prev, index));
  }

  async function handleDeleteMessage(messageId: string) {
    if (!activeTargetId || deletingMessageId) return;
    if (!window.confirm("Delete this message? This cannot be undone.")) return;

    const snapshot = messages;
    const mode = chatMode;
    const targetId = activeTargetId;

    setDeletingMessageId(messageId);

    try {
      const result = (mode === "dm"
        ? await deleteDirectMessage(apiAuth, targetId, messageId)
        : await deleteGroupMessage(apiAuth, targetId, messageId)) as { deleted?: boolean } | null;

      if (!result?.deleted) {
        throw new ChatApiError("Delete did not complete. Try again or redeploy the API.");
      }

      setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
      setMessageReactions((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      if (pickerMessageId === messageId) setPickerMessageId(null);
    } catch (error) {
      setMessages(snapshot);
      if (error instanceof ChatApiError && error.status === 404) {
        setFlash(
          "Delete failed: the API on port 8000 is an old build (missing delete routes). Stop all Python/uvicorn windows, start the API once, then hard-refresh this page.",
        );
      } else {
        handleApiError(error);
      }
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function handleDeleteChat() {
    if (!activeTargetId || deleteChatBusy) return;
    const label = chatMode === "dm" ? activeTitle : `group "${activeTitle}"`;
    const confirmed = window.confirm(
      `Delete all messages in this ${chatMode === "dm" ? "conversation" : "group chat"} with ${label}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleteChatBusy(true);
    try {
      const result = (await deleteChatConversation(apiAuth, {
        chat_type: chatMode,
        target_id: activeTargetId,
      })) as { messages_removed: number };
      setMessages([]);
      setAiReply(null);
      setShowAiSchedulePicker(false);
      setTaskSuggestions([]);
      setTaskPanelOpen(false);
      setSuggestionScheduleFields({});
      setSuggestionScheduleLabels({});
      setWorkItemsRefreshKey((k) => k + 1);
      setFlash(
        result.messages_removed > 0
          ? `Chat deleted (${result.messages_removed} message${result.messages_removed === 1 ? "" : "s"} removed).`
          : "Chat cleared.",
      );
    } catch (error) {
      handleApiError(error);
    } finally {
      setDeleteChatBusy(false);
    }
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

  const localSearchMatches = useMemo(() => {
    const q = localSearchQuery.trim().toLowerCase();
    if (!q || !localSearchOpen) return [];
    return sortedMessages.filter((msg) => msg.content.toLowerCase().includes(q));
  }, [localSearchOpen, localSearchQuery, sortedMessages]);

  const localSearchActiveId =
    localSearchMatches.length > 0
      ? localSearchMatches[Math.min(localSearchIndex, localSearchMatches.length - 1)]?.message_id
      : null;

  const listSearchHasResults =
    listSearchQuery.trim().length > 0 &&
    (searchUsers.length > 0 || searchGroups.length > 0 || searchMessageHits.length > 0);

  useEffect(() => {
    const trimmed = listSearchQuery.trim();
    if (!trimmed) {
      setSearchUsers([]);
      setSearchGroups([]);
      setSearchMessageHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void runUniversalSearch(trimmed);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [listSearchQuery, runUniversalSearch]);

  useEffect(() => {
    setLocalSearchIndex(0);
  }, [localSearchQuery]);

  useEffect(() => {
    if (!localSearchOpen || !localSearchActiveId) return;
    const el = messageRefs.current.get(localSearchActiveId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [localSearchActiveId, localSearchOpen, localSearchIndex]);

  useEffect(() => {
    if (!pendingScrollMessageId || !localSearchOpen) return;
    const idx = localSearchMatches.findIndex((msg) => msg.message_id === pendingScrollMessageId);
    if (idx >= 0) {
      setLocalSearchIndex(idx);
      setPendingScrollMessageId(null);
    }
  }, [pendingScrollMessageId, localSearchMatches, localSearchOpen, messages]);

  function stepLocalSearch(delta: number) {
    if (localSearchMatches.length === 0) return;
    setLocalSearchIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return localSearchMatches.length - 1;
      if (next >= localSearchMatches.length) return 0;
      return next;
    });
  }
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

  const extraMemberBadge = useMemo(() => {
    if (chatMode !== "group" || !activeGroup) return 0;
    const others = Math.max(0, activeGroup.member_count - (activeGroup.joined ? 1 : 0));
    return Math.max(0, others - groupAvatarLabels.length);
  }, [activeGroup, chatMode, groupAvatarLabels.length]);

  if (!mounted || sessionStatus === "loading") {
    return (
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-16 text-muted-foreground" />
    );
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-16 text-muted-foreground">
        Redirecting to sign in…
      </main>
    );
  }

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
    <main className="relative flex h-screen min-h-screen w-full flex-col overflow-hidden bg-[#f6f6f6] md:flex-row">
      {infoPanelOpen ? (
        <div
          role="presentation"
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] md:hidden"
          onClick={() => setInfoPanelOpen(false)}
        />
      ) : null}
      <section className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden bg-transparent md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-y-auto overflow-x-hidden border-r border-black/5 bg-[#f7f7f7] px-3 py-3 text-base">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Chats</h2>
            <button className={buttonVariants({ variant: "outline", size: "sm" })} onClick={() => void refreshGroups()} type="button">
              Refresh
            </button>
          </div>

          <input
            ref={listSearchInputRef}
            id="chat-list-search"
            className="mb-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-base"
            value={listSearchQuery}
            onChange={(e) => setListSearchQuery(e.target.value)}
            placeholder="Search groups, projects, or chat"
          />

          {listSearchQuery.trim() ? (
            <div className="mb-3 max-h-56 overflow-y-auto rounded-xl border border-black/10 bg-white p-2">
              {listSearchBusy ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">Searching…</p>
              ) : null}
              {!listSearchBusy && !listSearchHasResults ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">No matches.</p>
              ) : null}
              {searchUsers.length > 0 ? (
                <div className="mb-2">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">People</p>
                  <div className="space-y-1">
                    {searchUsers.map((user) => (
                      <button
                        key={user.user_id}
                        className="w-full rounded-lg border border-black/5 bg-[#f9f9f9] px-2 py-2 text-left text-xs hover:bg-[#f0f0f0]"
                        type="button"
                        onClick={() => void loadMessages(user.user_id, "dm")}
                      >
                        <span className="font-medium">{user.display_name}</span>
                        <span className="ml-1 text-muted-foreground">@{user.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {searchGroups.length > 0 ? (
                <div className="mb-2">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Groups</p>
                  <div className="space-y-1">
                    {searchGroups.map((group) => (
                      <div key={group.group_id} className="rounded-lg border border-black/5 bg-[#f9f9f9] p-2 text-xs">
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
              {searchMessageHits.length > 0 ? (
                <div>
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Messages</p>
                  <div className="space-y-1">
                    {searchMessageHits.map((hit) => (
                      <button
                        key={hit.message_id}
                        className="w-full rounded-lg border border-black/5 bg-[#f9f9f9] px-2 py-2 text-left text-xs hover:bg-[#f0f0f0]"
                        type="button"
                        onClick={() => void openMessageSearchHit(hit)}
                      >
                        <p className="font-medium text-[#1f3566]">{hit.chat_name}</p>
                        <p className="mt-0.5 line-clamp-2 text-[#444]">{hit.preview}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{formatTime(hit.created_at)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
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
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Direct</p>
          </div>
          <div className="space-y-0.5">
            {users.map((user) => (
              <button
                key={user.user_id}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                  chatMode === "dm" && activeTargetId === user.user_id
                    ? "bg-[#ececec]"
                    : "hover:bg-[#efefef]"
                }`}
                type="button"
                onClick={() => void loadMessages(user.user_id, "dm")}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-muted-foreground">
                  {initials(user.display_name)}
                </span>
                <span className="truncate text-base font-medium">{user.display_name}</span>
              </button>
            ))}
          </div>

          <div className="mb-1 mt-3 flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Groups</p>
            <button className={buttonVariants({ variant: "outline", size: "xs" })} type="button" onClick={() => void refreshGroups()}>
              Sync
            </button>
          </div>
          <div className="space-y-0.5">
            {groups.map((group) => (
              <div key={group.group_id} className={`rounded-lg px-2 py-1.5 ${chatMode === "group" && activeTargetId === group.group_id ? "bg-[#ececec]" : "hover:bg-[#efefef]"}`}>
                <button className="flex w-full items-center justify-between text-left" type="button" onClick={() => void loadMessages(group.group_id, "group")}>
                  <span className="truncate pr-2 text-base font-medium">{group.name}</span>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-sm text-muted-foreground">{group.member_count}</span>
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
                  {group.pending ? <span className="text-sm text-muted-foreground">Pending</span> : null}
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

        <section className="relative flex min-h-0 flex-1 flex-col bg-[#fdfdfd]">
          <header className="border-b border-black/5 px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-base text-[#9a9ea6]">
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Foodie Project</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-[#101828]">{activeTitle}</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-sm font-semibold text-[#16a34a]">
                  68% complete
                </span>
                <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-sm font-semibold text-[#d97706]">
                  {messages.length} msgs
                </span>
              </div>
            </div>
            <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              {groupAvatarLabels.length > 0 ? (
                <div className="flex -space-x-2">
                  {groupAvatarLabels.map((label, idx) => (
                    <span
                      key={`${label}-${idx}`}
                      className="grid h-8 w-8 place-items-center rounded-full border border-white bg-[#ececec] text-base font-semibold text-[#4a4a4a]"
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
            <div className={cn("flex flex-wrap items-center justify-end gap-2", infoPanelOpen && "pr-11 sm:pr-12")}>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#96a9d6] bg-[#dfe8fb] px-4 text-sm font-semibold text-[#1f3566] shadow-sm transition hover:bg-[#d3e0fb]"
                type="button"
                onClick={() => {
                  if (localSearchOpen) {
                    setLocalSearchOpen(false);
                    setLocalSearchQuery("");
                    setLocalSearchIndex(0);
                  } else {
                    openLocalSearch();
                  }
                }}
                aria-label="Search in this chat"
                aria-pressed={localSearchOpen}
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
              {!infoPanelOpen ? (
                <button
                  type="button"
                  onClick={() => setInfoPanelOpen(true)}
                  aria-label="Open Insights panel"
                  aria-expanded={false}
                  className="agent-panel-tab-glow inline-flex h-10 shrink-0 items-center gap-1.5 rounded-l-xl border border-r-0 border-[#c4b5fd]/90 bg-gradient-to-b from-[#f5f3ff] via-white to-[#faf5ff] px-2.5 text-[#5b21b6] transition-colors hover:border-[#a78bfa] hover:bg-[#ede9fe] sm:gap-2 sm:px-3"
                >
                  <ChevronLeft className="agent-panel-chevron-nudge h-5 w-5 shrink-0" strokeWidth={2.5} />
                  <span className="whitespace-nowrap text-xs font-bold uppercase tracking-wide">Insights</span>
                </button>
              ) : null}
            </div>
            {infoPanelOpen ? (
            <button
              type="button"
              onClick={() => setInfoPanelOpen(false)}
              aria-label="Collapse panel"
              aria-expanded={true}
              className="group absolute right-0 top-1/2 z-20 flex h-10 w-9 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-[#c4b5fd]/90 bg-gradient-to-b from-[#f5f3ff] via-white to-[#faf5ff] text-[#5b21b6] transition-colors hover:border-[#a78bfa] hover:bg-[#ede9fe] sm:h-11 sm:w-10"
            >
              <ChevronRight className="h-6 w-6 transition group-hover:translate-x-0.5" strokeWidth={2.5} />
            </button>
            ) : null}
            </div>
          </header>

          {localSearchOpen ? (
            <div className="border-b border-black/5 bg-white px-4 py-2">
              <div className="flex items-center gap-2">
                <input
                  ref={localSearchInputRef}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-black/10 px-3 text-sm"
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      stepLocalSearch(e.shiftKey ? -1 : 1);
                    }
                    if (e.key === "Escape") {
                      setLocalSearchOpen(false);
                      setLocalSearchQuery("");
                      setLocalSearchIndex(0);
                    }
                  }}
                  placeholder={`Search in ${activeTitle}`}
                />
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-muted-foreground transition hover:bg-black/[0.04] disabled:opacity-40"
                    onClick={() => stepLocalSearch(-1)}
                    disabled={localSearchMatches.length === 0}
                    aria-label="Previous match"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-muted-foreground transition hover:bg-black/[0.04] disabled:opacity-40"
                    onClick={() => stepLocalSearch(1)}
                    disabled={localSearchMatches.length === 0}
                    aria-label="Next match"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <span className="min-w-[4.5rem] text-center text-xs font-medium text-muted-foreground">
                    {localSearchMatches.length > 0
                      ? `${Math.min(localSearchIndex, localSearchMatches.length - 1) + 1} of ${localSearchMatches.length}`
                      : localSearchQuery.trim()
                        ? "0 of 0"
                        : "—"}
                  </span>
                </div>
              </div>
              {localSearchQuery.trim() ? (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-black/5 bg-[#fafafa]">
                  {localSearchMatches.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No messages match.</p>
                  ) : (
                    localSearchMatches.map((msg, idx) => (
                      <button
                        key={msg.message_id}
                        type="button"
                        className={cn(
                          "block w-full border-b border-black/5 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-white",
                          idx === localSearchIndex && "bg-[#fff7cc]",
                        )}
                        onClick={() => setLocalSearchIndex(idx)}
                      >
                        <p className="line-clamp-2 text-[#333]">{msg.content}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</p>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div ref={messagesScrollRef} className="flex-1 overflow-auto bg-[#f7f7f7] px-4 py-4">
            {sortedMessages.length === 0 ? (
              <div className="grid h-full place-items-center rounded-2xl border border-dashed border-black/10 bg-white text-sm text-muted-foreground">
                Select a user or group to start chatting.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedMessages.map((msg) => {
                  const mine = currentUserId !== "" && msg.sender_id === currentUserId;
                  const stats = reactionStats(msg.message_id);
                  const sectionIdx = messageSectionIndex.get(msg.message_id);
                  const showSectionStart = sectionStartIds.has(msg.message_id);
                  return (
                    <Fragment key={msg.message_id}>
                    {showSectionStart ? (
                      <div className="flex items-center gap-2 py-1 text-sm text-[#5b21b6]" role="separator">
                        <span className="h-px flex-1 bg-[#c4b5fd]" />
                        <span className="shrink-0 rounded-full bg-[#ede9fe] px-3 py-1 font-medium">
                          Task section #{(sectionIdx ?? 0) + 1} · analyzed
                        </span>
                        <span className="h-px flex-1 bg-[#c4b5fd]" />
                      </div>
                    ) : null}
                    <div
                      ref={(el) => {
                        if (el) messageRefs.current.set(msg.message_id, el);
                        else messageRefs.current.delete(msg.message_id);
                      }}
                      className={cn(
                        "flex scroll-mt-4",
                        mine ? "justify-end" : "justify-start",
                        localSearchActiveId === msg.message_id && "rounded-2xl ring-2 ring-[#facc15] ring-offset-2",
                      )}
                    >
                      <div className={`group max-w-[72%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                        {!mine ? (
                          <p className="text-base font-medium text-[#5f6fcf]">{msg.sender_id}</p>
                        ) : null}
                        <div className="relative pt-9">
                          <div
                            className={`pointer-events-none absolute top-0 z-10 flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 ${mine ? "right-0" : "left-0"}`}
                          >
                              {QUICK_REACTIONS.map((emoji) => (
                                <button
                                  key={`${msg.message_id}-${emoji}`}
                                  className="pointer-events-auto grid h-6 w-6 place-items-center rounded-full text-sm transition hover:bg-black/5"
                                  type="button"
                                  onClick={() => toggleReaction(msg.message_id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                className="pointer-events-auto grid h-6 w-6 place-items-center rounded-full text-xs text-muted-foreground transition hover:bg-black/5"
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
                              {mine ? (
                                <button
                                  className="pointer-events-auto grid h-6 w-6 place-items-center rounded-full text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                  type="button"
                                  disabled={deletingMessageId === msg.message_id}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDeleteMessage(msg.message_id);
                                  }}
                                  aria-label="Delete message"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                          </div>
                          <div className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${mine ? "rounded-br-md bg-black text-white" : "rounded-bl-md bg-[#e8e8e8] text-[#222]"}`}>
                            {msg.content}
                          </div>
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
                                className={`rounded-full border px-2 py-0.5 text-base ${item.mine ? "border-black/30 bg-black/5 text-black" : "border-black/10 bg-white text-muted-foreground"}`}
                              >
                                {item.emoji} {item.count}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-sm text-muted-foreground">{formatTime(msg.created_at)}</p>
                      </div>
                    </div>
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-black/5 bg-white">
            {taskPanelOpen && taskSuggestions.length > 0 ? (
              <div className="max-h-56 overflow-y-auto border-b border-purple-200 bg-purple-50 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-base font-semibold text-purple-900">
                    <ListTodo className="h-3.5 w-3.5 shrink-0" />
                    Task Suggestions ({taskSuggestions.length})
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-base text-purple-800 underline underline-offset-2 hover:text-purple-950"
                    onClick={() => { setTaskPanelOpen(false); setTaskSuggestions([]); }}
                  >
                    Dismiss All
                  </button>
                </div>
                <div className="space-y-1.5">
                  {taskSuggestions.map((suggestion, idx) => (
                    <div
                      key={`${suggestion.action}-${suggestion.title || suggestion.existing_item_id}-${idx}`}
                      className="rounded-lg border border-purple-200 bg-white p-2"
                    >
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className={`rounded-full px-1.5 py-0.5 text-sm font-semibold ${
                          suggestion.action === "create"
                            ? "bg-green-100 text-green-800"
                            : suggestion.action === "update"
                              ? "bg-amber-100 text-amber-800"
                              : suggestion.action === "close"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                        }`}>
                          {suggestion.action.toUpperCase()}
                        </span>
                        {suggestion.title ? (
                          <span className="text-base font-medium text-[#222]">{suggestion.title}</span>
                        ) : null}
                        {suggestion.existing_item_id ? (
                          <span className="text-sm text-muted-foreground">Item: {suggestion.existing_item_id}</span>
                        ) : null}
                      </div>
                      {suggestion.description ? (
                        <p className="mb-0.5 text-base text-[#555]">{suggestion.description}</p>
                      ) : null}
                      {suggestion.comment ? (
                        <p className="mb-0.5 text-base italic text-[#555]">&ldquo;{suggestion.comment}&rdquo;</p>
                      ) : null}
                      {suggestion.source_message_batch_index != null ? (
                        <p className="mb-1 text-sm font-medium text-purple-800">
                          From message section #{(suggestion.source_message_batch_index ?? 0) + 1}
                          {suggestion.source_message_ids?.length
                            ? ` (${suggestion.source_message_ids.length} messages)`
                            : ""}
                        </p>
                      ) : null}
                      {suggestion.reasoning ? (
                        <p className="mb-1 text-sm text-muted-foreground">{suggestion.reasoning}</p>
                      ) : null}
                      {suggestion.owner || suggestion.priority ? (
                        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                          {suggestion.owner ? <span>Owner: {suggestion.owner}</span> : null}
                          {suggestion.priority ? <span>Priority: {suggestion.priority}</span> : null}
                        </div>
                      ) : null}
                      {suggestion.update_fields && Object.keys(suggestion.update_fields).length > 0 ? (
                        <div className="mb-1 text-sm text-muted-foreground">
                          Updates:{" "}
                          {Object.entries(suggestion.update_fields)
                            .filter(([k]) => !["scheduled_start", "scheduled_end", "due_date"].includes(k))
                            .map(([k, v]) => `${k}→${v}`)
                            .join(", ")}
                          {suggestionHasPrefilledSchedule(suggestion) ? (
                            <span className="ml-1 font-medium text-indigo-800">
                              · {formatScheduleLabel({
                                due_date: suggestion.update_fields.due_date,
                                scheduled_start: suggestion.update_fields.scheduled_start ?? "",
                                scheduled_end: suggestion.update_fields.scheduled_end ?? "",
                              })}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {activeTargetId && suggestionNeedsSchedule(suggestion) ? (
                        <div className="mb-1.5 rounded-md border border-indigo-100 bg-indigo-50/80 p-2">
                          <p className="mb-1.5 text-sm font-semibold text-indigo-900">
                            {suggestionHasPrefilledSchedule(suggestion) ||
                            hasRequiredScheduleFields(suggestionScheduleFields[idx], suggestion)
                              ? "Date & time (edit if needed)"
                              : "Date & time (required)"}
                          </p>
                          <SuggestionScheduleEditor
                            apiAuth={apiAuth}
                            chatType={chatMode}
                            targetId={activeTargetId}
                            suggestion={suggestion}
                            fields={suggestionScheduleFields[idx]}
                            onChange={(fields, label) => {
                              setSuggestionScheduleFields((prev) => ({ ...prev, [idx]: fields }));
                              setSuggestionScheduleLabels((prev) => ({ ...prev, [idx]: label }));
                            }}
                          />
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="rounded-md bg-purple-600 px-2.5 py-0.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
                          onClick={() => void handleAcceptSuggestion(idx)}
                          disabled={
                            applyingIndex === idx ||
                            !hasRequiredScheduleFields(suggestionScheduleFields[idx], suggestion)
                          }
                          title={
                            hasRequiredScheduleFields(suggestionScheduleFields[idx], suggestion)
                              ? undefined
                              : "Select date and time first"
                          }
                        >
                          {applyingIndex === idx ? "Applying…" : "Accept"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-black/10 bg-white px-2.5 py-0.5 text-sm font-semibold text-[#333] transition hover:bg-black/5"
                          onClick={() => handleRejectSuggestion(idx)}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="px-4 py-2">
            {flash ? <p className="mb-1 text-base text-muted-foreground">{flash}</p> : null}
            {askAiBusy ? (
              <p className="mb-1 flex items-center gap-2 text-base text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Asking AI using this chat as context…
              </p>
            ) : null}
            {aiReply ? (
              <div className="mb-2 rounded-lg border border-indigo-200/90 bg-indigo-50 px-3 py-2 text-indigo-950 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-base font-semibold text-indigo-900">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    Chat AI
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
                    onClick={() => {
                      setAiReply(null);
                      setShowAiSchedulePicker(false);
                    }}
                  >
                    Dismiss
                  </button>
                </div>
                <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-base leading-relaxed">{aiReply.content}</p>
                {showAiSchedulePicker && activeTargetId ? (
                  <div className="mt-2 border-t border-indigo-200/80 pt-2">
                    <ChatSchedulePicker
                      apiAuth={apiAuth}
                      chatType={chatMode}
                      targetId={activeTargetId}
                      taskTitle="Meeting"
                      taskDescription={lastAvailabilityQuestion}
                      messageText={lastAvailabilityQuestion}
                      compact
                      onSelect={(_fields, label) => {
                        setFlash(`Selected: ${label}. Mention this time in chat or accept a task suggestion to save it.`);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            {composerFiles.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {composerFiles.map((file, index) => (
                  <button
                    key={`${file.name}-${file.size}-${index}`}
                    type="button"
                    onClick={() => removeComposerFile(index)}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#f4f4f4] px-2 py-1 text-base text-[#333] hover:bg-[#ececec]"
                    title="Click to remove"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-40 truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="relative flex items-center gap-2 rounded-xl border border-black/10 bg-[#fafafa] px-3 py-2.5">
              <button
                className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition hover:bg-black/5"
                type="button"
                onClick={handlePickComposerFiles}
                aria-label="Add attachments"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition hover:bg-black/5"
                type="button"
                onClick={() => setShowAIActions((open) => !open)}
                aria-label="AI actions"
              >
                <Sparkles className="h-4 w-4" />
              </button>
              {showAIActions ? (
                <div className="absolute bottom-12 left-11 z-10 w-72 rounded-xl border border-black/10 bg-white p-2 shadow-lg">
                  {visibleChatAiActions().map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-base text-[#222] transition hover:bg-black/5"
                      onClick={() => handleAiAction(action)}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#9810fa]" />
                      <span>{action}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <input
                ref={composerFileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.rar"
                onChange={handleComposerFilesChange}
              />
              <input
                ref={composerTextRef}
                className="h-11 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground/80"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder='Message… type @chat and your question, or use "Ask AI"'
              />
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition hover:bg-black/5"
                onClick={() => setFlash("Voice input is UI-only for now.")}
                aria-label="Voice input"
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition hover:bg-black/5"
                onClick={() => setFlash("Emoji picker is UI-only for now.")}
                aria-label="Emoji picker"
              >
                <Smile className="h-4 w-4" />
              </button>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-[#d9d9d9] text-base text-black transition hover:bg-[#cdcdcd] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleSend()}
                disabled={!activeTargetId || !composer.trim() || askAiBusy}
                aria-label="Send message"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
            </div>
          </footer>

        </section>
      </section>

      <aside
        className={cn(
          "relative flex min-h-0 flex-col border-l border-black/5 bg-white shadow-[-6px_0_24px_rgba(0,0,0,0.04)]",
          "fixed inset-y-0 right-0 z-50 w-[min(100%,380px)] max-w-[380px] transition-[transform,width] duration-300 ease-out",
          infoPanelOpen ? "translate-x-0" : "translate-x-full",
          "md:relative md:inset-auto md:z-0 md:h-auto md:max-w-none md:shadow-none",
          infoPanelOpen ? "md:w-[380px] md:translate-x-0" : "md:w-0 md:translate-x-0 md:border-l-0 md:overflow-hidden",
          !infoPanelOpen && "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col transition-opacity duration-200",
            !infoPanelOpen && "md:opacity-0",
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex items-center justify-center gap-1">
              {chatMode === "group" && activeGroup && activeGroup.member_count > 0 ? (
                <>
                  <div className="flex -space-x-2">
                    {groupAvatarLabels.length > 0 ? (
                      groupAvatarLabels.map((label, idx) => (
                        <span
                          key={`rp-${label}-${idx}`}
                          className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#ececec] text-base font-semibold text-[#4a4a4a]"
                        >
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#ececec] text-base font-semibold text-[#4a4a4a]">
                        {initials(activeGroup.name)}
                      </span>
                    )}
                  </div>
                  {extraMemberBadge > 0 ? (
                    <span className="z-10 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#ddd] text-base font-semibold text-[#333]">
                      +{extraMemberBadge}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="z-10 grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-black/20 bg-white text-lg font-light text-muted-foreground transition hover:border-black/30 hover:bg-black/[0.03]"
                    onClick={() => setFlash("Invite members — coming soon.")}
                    aria-label="Add members"
                  >
                    +
                  </button>
                </>
              ) : chatMode === "dm" && activeUser ? (
                <span className="grid h-14 w-14 place-items-center rounded-full border border-black/10 bg-[#ececec] text-sm font-semibold text-[#4a4a4a]">
                  {initials(activeUser.display_name)}
                </span>
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-full border border-dashed border-black/15 bg-[#fafafa] text-base text-muted-foreground">
                  —
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-[#111]">{activeTitle}</h2>
            <p className="mt-1 text-base text-muted-foreground">
              {chatMode === "group" && activeGroup
                ? activeGroup.description.trim() || "No description yet."
                : chatMode === "dm" && activeUser
                  ? `@${activeUser.username}`
                  : "Select a chat"}
            </p>
            {chatMode === "group" && activeGroup?.name ? (
              <p className="mt-1 text-base text-muted-foreground/90">#{activeGroup.name.replace(/\s+/g, "")}</p>
            ) : null}
          </div>

          <nav className="flex flex-col gap-0.5 border-t border-black/5 pt-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-base text-[#222] transition hover:bg-black/[0.04]"
              onClick={() => {
                openLocalSearch();
                if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
                  setInfoPanelOpen(false);
                }
              }}
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Search in this chat</span>
            </button>
            {chatMode === "group" ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-base text-[#222] transition hover:bg-black/[0.04]"
                  onClick={() => setFlash("Group QR code — coming soon.")}
                >
                  <QrCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Group QR code</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-base text-[#222] transition hover:bg-black/[0.04]"
                  onClick={() => setFlash("Group notice — coming soon.")}
                >
                  <FilePenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Group notice</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-base text-[#222] transition hover:bg-black/[0.04]"
                onClick={() => setFlash("Shared media — coming soon.")}
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>Shared media</span>
              </button>
            )}
            {activeTargetId ? (
              <button
                type="button"
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-base text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                onClick={() => void handleDeleteChat()}
                disabled={deleteChatBusy}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span>{deleteChatBusy ? "Deleting chat…" : "Delete chat"}</span>
              </button>
            ) : null}
          </nav>

          {activeTargetId ? (
            <ChatInfoCalendar
              apiAuth={apiAuth}
              chatType={chatMode}
              targetId={activeTargetId}
              taskSuggestions={taskSuggestions}
              refreshKey={workItemsRefreshKey}
            />
          ) : null}

          <div>
            <p className="mb-2 text-base font-semibold uppercase tracking-wide text-muted-foreground">Project Status</p>
            <div className="rounded-xl bg-[#f9fafb] p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-base font-bold text-[#101828]">68%</span>
                <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-sm font-semibold text-[#16a34a]">Editing phase</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#e5e7eb]">
                <div className="h-full w-[68%] rounded-full bg-[#9810fa]" />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-base font-bold text-[#101828]">{messages.length}</p><p className="text-sm text-[#9a9ea6]">Messages</p></div>
                <div><p className="text-base font-bold text-[#101828]">{groups.length}</p><p className="text-sm text-[#9a9ea6]">Groups</p></div>
                <div><p className="text-base font-bold text-[#101828]">{users.length}</p><p className="text-sm text-[#9a9ea6]">Peers</p></div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-base font-semibold uppercase tracking-wide text-muted-foreground">Highlights</p>
            <div className="rounded-xl border border-dashed border-black/10 bg-[#fafafa] px-3 py-6 text-center text-base text-muted-foreground">
              Pinned highlights and key moments will show here.
            </div>
          </div>

        </div>

        <div className="shrink-0 border-t border-black/5 p-5">
          <button
            type="button"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#7c3aed] bg-[#ede9fe] py-3.5 text-base font-semibold text-[#5b21b6] shadow-sm transition hover:bg-[#ddd6fe] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!activeTargetId || isAnalyzingTasks}
            onClick={() => void triggerTaskExtraction(true)}
          >
            <ListTodo className="h-4 w-4" />
            {isAnalyzingTasks ? "Extracting tasks…" : "Extract Tasks"}
          </button>
          <button
            type="button"
            className="w-full rounded-full bg-black py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-black/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!activeTargetId || askAiBusy}
            onClick={() => {
              setComposer((c) => (c.trim() ? `${c.trim()} ` : "") + "@chat ");
              setFlash("");
              composerTextRef.current?.focus();
              if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
                setInfoPanelOpen(false);
              }
            }}
          >
            Ask AI
          </button>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Inserts <code className="rounded bg-black/5 px-1">@chat</code> — add your question, then send.
          </p>
        </div>
        </div>
      </aside>
    </main>
  );
}
