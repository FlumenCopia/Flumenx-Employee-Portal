"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  Globe,
  Heart,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  ListTodo,
  Lock,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  PhoneCall,
  PhoneOff,
  Pin,
  PinOff,
  Plus,
  PlusCircle,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Share2,
  Shield,
  Smile,
  Sparkles,
  ThumbsUp,
  Trash2,
  TrendingUp,
  User,
  UserMinus,
  UserPlus,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { PageHeader, PrimaryButton, Badge, StatCard } from "@/components/ui";
import { Avatar } from "@/components/icons";
import { Modal } from "@/features/common/Modal";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { getCachedAuthUser } from "@/lib/auth-cache";
import {
  AuthUser,
  ChatConversationItem,
  ChatMessageItem,
  ChatUserOption,
  WorkAssignment,
  Client,
  WorkspaceRole,
} from "@/lib/types";
import { DailyStandupModal } from "./DailyStandupModal";
import { ChatMediaLightbox } from "./ChatMediaLightbox";
import { useWebRTC } from "./WebRTCContext";
import { getGlobalSocket } from "@/lib/socket";

function resolveChatMediaUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) {
    const filename = url.replace("/uploads/", "");
    return `/media/chat/${filename}`;
  }
  if (url.startsWith("/media/")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `/media/chat${url}`;
  }
  return `/media/chat/${url}`;
}

type Props = {
  role?: WorkspaceRole;
};

export function ChatHubPage({ role }: Props) {
  const [conversations, setConversations] = useState<ChatConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Pagination & Upward Infinite Scrolling
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

  // Users, Tasks, Clients for Smart Embeds
  const [usersList, setUsersList] = useState<ChatUserOption[]>([]);
  const [tasksList, setTasksList] = useState<WorkAssignment[]>([]);
  const [clientsList, setClientsList] = useState<Client[]>([]);

  // Input & Messaging state
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "DIRECT" | "GROUP" | "CLIENT">("ALL");

  // Right Drawer
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);

  // Modals state & Search Filters
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [newChatMode, setNewChatMode] = useState<"DIRECT" | "GROUP">("DIRECT");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<"GROUP" | "DEPARTMENT" | "CLIENT">("GROUP");
  const [newGroupDept, setNewGroupDept] = useState("");
  const [newGroupClient, setNewGroupClient] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Add Member Modal
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState<string[]>([]);
  const [addMemberSearchQuery, setAddMemberSearchQuery] = useState("");

  // Smart Embed Modals
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [standupModalOpen, setStandupModalOpen] = useState(false);

  const [callPickerOpen, setCallPickerOpen] = useState(false);
  const [callPickerType, setCallPickerType] = useState<"audio" | "video">("audio");

  // Forward Message Modal State
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<ChatMessageItem | null>(null);
  const [forwardTargetIds, setForwardTargetIds] = useState<string[]>([]);
  const [forwardSearchQuery, setForwardSearchQuery] = useState("");
  const [forwardingLoading, setForwardingLoading] = useState(false);

  // Real-Time WebRTC Calling & Online Presence
  const { startCall, startGroupCall, inviteToCall } = useWebRTC();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  // Helper for 1-to-1 Direct Chat creation / navigation
  const handleStartDirectChatWithUser = async (targetUserId?: string | number, targetEmpId?: string | number) => {
    try {
      const conv = await api<ChatConversationItem>("/chat/conversations/direct/", {
        method: "POST",
        body: JSON.stringify({ target_user_id: targetUserId, target_employee_id: targetEmpId }),
      });
      if (conv && conv.id) {
        setActiveConversationId(conv.id);
        loadConversations(true);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to open direct conversation");
    }
  };

  // URL search param auto-selection logic
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get("user") || params.get("targetUserId");
    const targetEmpId = params.get("emp") || params.get("targetEmpId");
    const convId = params.get("conversationId") || params.get("conv");

    if (convId) {
      setActiveConversationId(convId);
    } else if (targetUserId || targetEmpId) {
      handleStartDirectChatWithUser(targetUserId || undefined, targetEmpId || undefined);
    }
  }, []);

  // Lightbox Media Preview
  const [previewMedia, setPreviewMedia] = useState<{ src: string; alt?: string; isVideo?: boolean } | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
  };

  const loadConversations = async (silent: boolean = false) => {
    if (!silent) setLoadingConversations(true);
    try {
      const data = await api<ChatConversationItem[]>("/chat/conversations/");
      setConversations(Array.isArray(data) ? data : []);
      if (!activeConversationId && Array.isArray(data) && data.length > 0) {
        if (typeof window !== "undefined" && window.innerWidth > 868) {
          setActiveConversationId(data[0].id);
        }
      }
    } catch (err: any) {
      if (!silent) toast.error(err?.message || "Failed to load chats");
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  };

  const loadOptionsData = async () => {
    try {
      const [usersData, tasksData, clientsData] = await Promise.all([
        api<ChatUserOption[]>("/chat/users/").catch(() => []),
        api<any>("/work-assignments/?is_master_client_task=all").catch(() => []),
        api<any>("/clients/").catch(() => []),
      ]);
      setUsersList(Array.isArray(usersData) ? usersData : []);
      setTasksList(Array.isArray(tasksData) ? tasksData : tasksData?.results || []);
      setClientsList(Array.isArray(clientsData) ? clientsData : clientsData?.results || []);
    } catch (e) {
      // ignore background options error
    }
  };

  const loadMessages = async (conversationId: string, beforeMessageId?: string) => {
    const isInitial = !beforeMessageId;
    if (isInitial) setLoadingMessages(true);
    else setLoadingOlderMessages(true);

    try {
      const url = beforeMessageId
        ? `/chat/conversations/${conversationId}/messages/?before=${beforeMessageId}&limit=30`
        : `/chat/conversations/${conversationId}/messages/?limit=30`;

      const data = await api<{ messages: ChatMessageItem[]; has_more: boolean; count: number }>(url);
      const newBatch = data?.messages || [];
      const hasMore = Boolean(data?.has_more);

      setHasMoreMessages(hasMore);

      if (isInitial) {
        setMessages(newBatch);
        setTimeout(() => scrollToBottom("auto"), 60);
      } else {
        const container = messagesContainerRef.current;
        const previousScrollHeight = container ? container.scrollHeight : 0;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueNew = newBatch.filter((m) => !existingIds.has(m.id));
          return [...uniqueNew, ...prev];
        });

        setTimeout(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - previousScrollHeight;
          }
        }, 30);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load messages");
    } finally {
      if (isInitial) setLoadingMessages(false);
      else setLoadingOlderMessages(false);
    }
  };

  const loadOlderMessages = () => {
    if (!activeConversationId || loadingOlderMessages || !hasMoreMessages || messages.length === 0) return;
    const oldestMessageId = messages[0]?.id;
    if (oldestMessageId) {
      loadMessages(activeConversationId, String(oldestMessageId));
    }
  };

  const handleScrollMessages = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 60 && hasMoreMessages && !loadingOlderMessages && !loadingMessages) {
      loadOlderMessages();
    }
  };

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const currentUserRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    api<AuthUser>("/auth/me/")
      .then((u) => {
        if (u) {
          setCurrentUser(u);
          currentUserRef.current = u;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadConversations();
    loadOptionsData();
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  // Real-Time Socket.io Connection
  useEffect(() => {
    const socket = getGlobalSocket();
    if (!socket) return;

    if (activeConversationId) {
      socket.emit("chat:join-conversation", { conversationId: activeConversationId });
      socket.emit("join_conversation", { conversationId: activeConversationId });
    }

    const handlePresenceUpdate = (data: any) => {
      if (data?.onlineUserIds && Array.isArray(data.onlineUserIds)) {
        setOnlineUserIds(data.onlineUserIds.map(String));
      } else if (data?.userId) {
        setOnlineUserIds((prev) =>
          data.status === "online"
            ? Array.from(new Set([...prev, String(data.userId)]))
            : prev.filter((id) => id !== String(data.userId))
        );
      }
    };

    const handlePresenceOnlineUsers = (ids: any) => {
      if (Array.isArray(ids)) {
        setOnlineUserIds(ids.map(String));
      }
    };

    socket.on("presence:update", handlePresenceUpdate);
    socket.on("presence:online-users", handlePresenceOnlineUsers);

    const handleNewMessage = (payload: any) => {
      const msg: ChatMessageItem = payload?.message || payload;
      if (!msg || !msg.conversation_id) return;

      const isSenderSelf = Boolean(
        msg.is_self ||
        (currentUserRef.current && (String(msg.sender_id) === String(currentUserRef.current.id) || String(msg.sender_id) === String((currentUserRef.current as any)._id)))
      );

      const formattedMsg = { ...msg, is_self: isSenderSelf };

      if (String(msg.conversation_id) === String(activeConversationId)) {
        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
          return [...prev, formattedMsg];
        });
        setTimeout(() => scrollToBottom("smooth"), 50);
      }
      setConversations((prev) =>
        prev.map((c) => {
          if (String(c.id) === String(msg.conversation_id)) {
            return {
              ...c,
              last_message_text: msg.text || (msg.message_type === "IMAGE" ? "📷 Image" : msg.message_type === "VIDEO" ? "🎥 Video" : "📁 File attachment"),
              last_message_at: msg.created_at || new Date().toISOString(),
              last_message_sender_name: msg.sender_name,
              has_unread: String(msg.conversation_id) !== String(activeConversationId),
            };
          }
          return c;
        })
      );
    };

    socket.on("chat:new-message", handleNewMessage);

    const handleConversationUpdated = (data: any) => {
      if (data?.conversationId && data?.lastMessage) {
        const msg = data.lastMessage;
        setConversations((prev) =>
          prev.map((c) => {
            if (String(c.id) === String(data.conversationId)) {
              return {
                ...c,
                last_message_text: msg.text || (msg.message_type === "IMAGE" ? "📷 Image" : "📁 File"),
                last_message_at: msg.created_at || new Date().toISOString(),
                last_message_sender_name: msg.sender_name,
                has_unread: String(data.conversationId) !== String(activeConversationId),
              };
            }
            return c;
          })
        );
      }
    };

    const handlePresence = (data: { onlineUsers: string[] }) => {
      if (data?.onlineUsers) {
        setOnlineUserIds(data.onlineUsers.map(String));
      }
    };

    const handleMessagesRead = (data: { conversationId: string; userId: string; readAt?: string }) => {
      if (String(data?.conversationId) === String(activeConversationId)) {
        setMessages((prev) =>
          prev.map((m) =>
            // If message was sent by self, it has now been seen by the other participant(s) -> 2 blue ticks!
            String(m.sender_id) !== String(data.userId)
              ? { ...m, is_read: true, is_delivered: true }
              : m
          )
        );
      }
    };

    const handleMessageDeleted = (data: { conversationId: string; messageId: string }) => {
      if (String(data?.conversationId) === String(activeConversationId)) {
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(data.messageId)));
      }
      setConversations((prev) =>
        prev.map((c) => {
          if (String(c.id) === String(data.conversationId)) {
            return {
              ...c,
              last_message_text: "Message deleted",
            };
          }
          return c;
        })
      );
    };

    socket.on("chat:new-message", handleNewMessage);
    socket.on("chat_message", handleNewMessage);
    socket.on("chat:conversation-updated", handleConversationUpdated);
    socket.on("chat:messages-read", handleMessagesRead);
    socket.on("chat:message-deleted", handleMessageDeleted);
    socket.on("presence_update", handlePresence);

    if (activeConversationId) {
      socket.emit("chat:join-conversation", { conversationId: activeConversationId });
      socket.emit("chat:mark-read", { conversationId: activeConversationId });
    }

    return () => {
      socket.off("chat:new-message", handleNewMessage);
      socket.off("chat_message", handleNewMessage);
      socket.off("chat:conversation-updated", handleConversationUpdated);
      socket.off("chat:messages-read", handleMessagesRead);
      socket.off("chat:message-deleted", handleMessageDeleted);
      socket.off("presence_update", handlePresence);
      if (activeConversationId) {
        socket.emit("chat:leave-conversation", { conversationId: activeConversationId });
        socket.emit("leave_conversation", { conversationId: activeConversationId });
      }
    };
  }, [activeConversationId]);

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.last_message_text?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchTab =
        activeTab === "ALL" ||
        (activeTab === "DIRECT" && c.type === "DIRECT") ||
        (activeTab === "GROUP" && (c.type === "GROUP" || c.type === "DEPARTMENT")) ||
        (activeTab === "CLIENT" && c.type === "CLIENT");

      return matchSearch && matchTab;
    });
  }, [conversations, searchQuery, activeTab]);

  const handleSendMessage = async (customPayload?: any) => {
    if (!activeConversationId) return;
    const textToSend = customPayload?.text || inputText.trim();
    const typeToSend = customPayload?.type || "TEXT";

    if (!textToSend && typeToSend === "TEXT") return;

    setSending(true);
    try {
      const payload = {
        text: textToSend,
        message_type: typeToSend,
        ...customPayload,
      };

      const res = await api<ChatMessageItem>(`/chat/conversations/${activeConversationId}/messages/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setInputText("");
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.id)) return prev;
        return [...prev, res];
      });
      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeConversationId) return;
    const file = e.target.files[0];
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    toast.info(`Uploading ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await api<any>(`/chat/upload/`, {
        method: "POST",
        body: formData,
      });

      const messageType = isImage ? "IMAGE" : isVideo ? "VIDEO" : "FILE";
      await handleSendMessage({
        text: file.name,
        type: messageType,
        attachments: [
          {
            name: file.name,
            url: uploadRes.url,
            file_type: file.type,
            size: file.size,
          },
        ],
      });
      toast.success("Attachment sent!");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEmbedTask = (task: WorkAssignment) => {
    setTaskPickerOpen(false);
    handleSendMessage({
      text: `Task Linked: ${task.title}`,
      type: "TASK_EMBED",
      task_embed: {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        employeeName: task.employee_name,
        clientName: task.client_name,
        assignedQuantity: task.assigned_quantity,
        completedQuantity: task.completed_quantity,
        unit: task.unit,
      },
    });
  };

  const handleEmbedClient = (client: Client) => {
    setClientPickerOpen(false);
    handleSendMessage({
      text: `Client Attached: ${client.name}`,
      type: "CLIENT_EMBED",
      client_embed: {
        id: client.id,
        name: client.name,
        industry: client.industry,
        contactPerson: client.contact_person?.name || "Client Lead",
      },
    });
  };

  const handleEmbedStandup = async (standupData: any) => {
    await handleSendMessage({
      text: `Daily Standup Summary (${standupData.date})`,
      type: "STANDUP_UPDATE",
      standup_data: standupData,
    });
  };

  const handleLaunchMeeting = async () => {
    if (!activeConversation) return;
    try {
      const res = await api<any>("/meetings/create-instant/", {
        method: "POST",
        body: JSON.stringify({
          title: `${activeConversation.name} Sync Meeting`,
          conversation_id: activeConversation.id,
        }),
      });

      const meetingCode = res.meeting_code || res.code || "flumenx-hq";
      await handleSendMessage({
        text: `Live FLUMENX Video Meeting Started. Click below to join:`,
        type: "MEETING_LINK",
        meeting_code: meetingCode,
      });

      window.open(`/meet/${meetingCode}`, "_blank");
    } catch (err: any) {
      toast.error(err?.message || "Could not start instant meeting");
    }
  };

  const handleLaunchGroupCall = async (type: "audio" | "video" = "video") => {
    if (!activeConversation) return;
    try {
      await startGroupCall({
        conversationId: activeConversation.id,
        conversationName: activeConversation.name,
        callType: type,
        memberIds: activeConversation.participants?.map((p) => String(p.user_id)) || [],
      });
      toast.success(`Group ${type} call started! Ringing group members...`);
    } catch (err: any) {
      toast.error(err?.message || "Could not start group call");
    }
  };

  const handleTogglePin = async (messageId: string | number) => {
    try {
      const res = await api<any>(`/chat/messages/${messageId}/pin/`, { method: "POST" });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_pinned: res.is_pinned } : m))
      );
      toast.success(res.is_pinned ? "Message pinned to top" : "Message unpinned");
    } catch (err: any) {
      toast.error("Failed to toggle pin");
    }
  };

  const handleOpenForwardModal = (msg: ChatMessageItem) => {
    setMessageToForward(msg);
    setForwardTargetIds([]);
    setForwardSearchQuery("");
    setForwardModalOpen(true);
  };

  const handleForwardMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageToForward || forwardTargetIds.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }
    setForwardingLoading(true);
    try {
      const res = await api<{ success: boolean; count: number; messages: ChatMessageItem[] }>(
        `/chat/messages/${messageToForward.id}/forward/`,
        {
          method: "POST",
          body: JSON.stringify({ target_conversation_ids: forwardTargetIds }),
        }
      );

      toast.success(`Message forwarded to ${forwardTargetIds.length} conversation${forwardTargetIds.length > 1 ? "s" : ""}`);
      setForwardModalOpen(false);
      setMessageToForward(null);
      setForwardTargetIds([]);

      // If forwarded to the currently open conversation, append immediately
      if (res?.messages) {
        const matchingCurrent = res.messages.find(
          (m) => String(m.conversation_id) === String(activeConversationId)
        );
        if (matchingCurrent) {
          setMessages((prev) => [...prev, { ...matchingCurrent, is_self: true }]);
          setTimeout(() => scrollToBottom("smooth"), 50);
        }
      }
      loadConversations(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to forward message");
    } finally {
      setForwardingLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string | number) => {
    if (!confirm("Delete this message for everyone in this chat?")) return;
    try {
      await api(`/chat/messages/${messageId}/`, { method: "DELETE" });
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
      toast.success("Message deleted");
      loadConversations(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete message");
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        type: newChatMode === "DIRECT" ? "DIRECT" : newGroupType,
        participant_ids: selectedUserIds,
      };

      if (newChatMode === "GROUP") {
        if (!newGroupName.trim()) {
          toast.error("Please enter a group channel name");
          return;
        }
        payload.name = newGroupName.trim();
        payload.department = newGroupDept.trim() || undefined;
        payload.client_id = newGroupClient || undefined;
      }

      const created = await api<ChatConversationItem>("/chat/conversations/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success(newChatMode === "DIRECT" ? "Chat opened" : "Group channel created");
      setNewChatModalOpen(false);
      setNewGroupName("");
      setSelectedUserIds([]);
      setUserSearchQuery("");
      await loadConversations();
      setActiveConversationId(created.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create conversation");
    }
  };

  const handleAddMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || membersToAdd.length === 0) return;
    try {
      await api<any>(`/chat/conversations/${activeConversationId}/members/`, {
        method: "POST",
        body: JSON.stringify({ user_ids: membersToAdd }),
      });
      toast.success("Members added to group");
      setAddMemberModalOpen(false);
      setMembersToAdd([]);
      setAddMemberSearchQuery("");
      loadConversations(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to add members");
    }
  };

  const handleRemoveMember = async (userId: string | number) => {
    if (!activeConversationId) return;
    if (!confirm("Are you sure you want to remove this member from the group?")) return;
    try {
      await api<any>(`/chat/conversations/${activeConversationId}/members/${userId}/`, {
        method: "DELETE",
      });
      toast.success("Member removed");
      loadConversations(true);
    } catch (err: any) {
      toast.error("Failed to remove member");
    }
  };

  const handleStartCall = (type: "audio" | "video", targetMember?: { id: string | number; name: string; avatar?: string }) => {
    if (!activeConversation) return;

    const loggedInUser = currentUser || getCachedAuthUser();
    const currentUserId = String(loggedInUser?.id || (loggedInUser as any)?._id || (loggedInUser as any)?.user_id || "");

    let targetUserId = targetMember?.id ? String(targetMember.id) : "";
    let partnerName = targetMember?.name || activeConversation.name;
    let partnerAvatar = targetMember?.avatar || activeConversation.avatar;

    if (!targetUserId) {
      if (activeConversation.type === "DIRECT") {
        const partner = activeConversation.other_participant;
        // Search participants for the other party
        const otherP = activeConversation.participants?.find((p) => {
          const pId = String(p.user_id || (p as any)?._id || (p as any)?.id || "");
          return pId && (!currentUserId || pId !== currentUserId);
        });

        let candidateId = partner?.id || (partner as any)?.user_id || otherP?.user_id;

        // If candidateId matches self and we have other participants, pick the alternative
        if (candidateId && currentUserId && String(candidateId) === currentUserId && otherP?.user_id) {
          candidateId = otherP.user_id;
        }

        if (candidateId) {
          targetUserId = String(candidateId);
          partnerName = partner?.name || otherP?.name || partnerName;
          partnerAvatar = partner?.avatar || otherP?.avatar || partnerAvatar;
        }
      } else {
        // Group or channel chat: open participant picker modal
        setCallPickerType(type);
        setCallPickerOpen(true);
        return;
      }
    }

    if (!targetUserId) {
      toast.error("No callable colleague found in this conversation.");
      return;
    }

    if (currentUserId && targetUserId === currentUserId) {
      toast.warning("Cannot start a direct call with yourself.");
      return;
    }

    if (onlineUserIds.length > 0 && !onlineUserIds.includes(targetUserId)) {
      toast.warning(`Cannot call: ${partnerName} is currently offline.`);
      return;
    }

    console.log(`[ChatHubPage] Initiating ${type} call to target ${targetUserId} (${partnerName})`);
    startCall({
      toUserId: targetUserId,
      callType: type,
      partnerName,
      partnerAvatar,
      conversationId: activeConversation.id,
    });
  };

  const topPinnedMessage = useMemo(() => {
    return messages.find((m) => m.is_pinned) || null;
  }, [messages]);

  return (
    <Shell role={role}>
      <div style={{ padding: "0 2px 8px 2px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageSquare size={19} color="var(--color-primary, #087A5B)" />
          <h2 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "var(--color-text, #18231F)" }}>
            Team Chat
          </h2>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              setNewChatMode("DIRECT");
              setNewChatModalOpen(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              background: "var(--panel, #ffffff)",
              border: "1.5px solid var(--border, #DCE3E0)",
              color: "var(--color-text, #18231F)",
              cursor: "pointer",
            }}
          >
            <UserPlus size={14} />
            <span>New DM</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNewChatMode("GROUP");
              setNewChatModalOpen(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              background: "linear-gradient(135deg, #087A5B 0%, #066348 100%)",
              border: "1.5px solid #066348",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* MAIN CHAT CONTAINER */}
      <div
        className={`chat-mobile-container ${activeConversationId ? "active-chat-open" : ""}`}
        style={{
          display: "grid",
          gridTemplateColumns: showInfoDrawer ? "300px 1fr 280px" : "320px 1fr",
          background: "var(--panel, #ffffff)",
          border: "1px solid var(--border, #DCE3E0)",
          borderRadius: "16px",
          overflow: "hidden",
          height: "calc(100vh - 165px)",
          minHeight: "440px",
          maxHeight: "calc(100vh - 140px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          position: "relative",
        }}
      >
        {/* ========================================================= */}
        {/* LEFT COLUMN: CONVERSATION LIST */}
        {/* ========================================================= */}
        <div
          className={activeConversationId ? "chat-sidebar-mobile-hidden" : "chat-sidebar-mobile-full"}
          style={{
            borderRight: "1px solid var(--border, #DCE3E0)",
            display: "flex",
            flexDirection: "column",
            background: "var(--panel2, #F8FAF9)",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Search Header */}
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border, #DCE3E0)", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--color-text-muted, #718096)" }} />
              <input
                type="text"
                placeholder="Search chats, groups, colleagues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "34px",
                  paddingRight: "12px",
                  fontSize: "13px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "var(--panel, #ffffff)",
                  border: "1px solid var(--border2, #CBD5E1)",
                  color: "var(--color-text, #18231F)",
                  outline: "none",
                }}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "2px" }}>
              {(["ALL", "DIRECT", "GROUP", "CLIENT"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "20px",
                    border: activeTab === tab ? "1px solid var(--color-primary, #087A5B)" : "1px solid var(--border, #DCE3E0)",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: activeTab === tab ? "var(--color-primary, #087A5B)" : "var(--panel, #ffffff)",
                    color: activeTab === tab ? "#fff" : "var(--color-text-secondary, #4A5568)",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab === "ALL" ? "All Chats" : tab === "DIRECT" ? "Direct (1:1)" : tab === "GROUP" ? "Groups & Teams" : "Clients"}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Items */}
          <div style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto", padding: "8px", WebkitOverflowScrolling: "touch" }}>
            {loadingConversations ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--color-text-muted, #718096)", fontSize: "13px" }}>
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--color-text-muted, #718096)", fontSize: "13px" }}>
                No conversations found.
                <button
                  onClick={() => setNewChatModalOpen(true)}
                  style={{ display: "block", margin: "10px auto 0", background: "#E7F5EE", border: "1px solid #B2D8CB", color: "var(--color-primary, #087A5B)", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
                >
                  + Start New Chat
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const isGroup = conv.type !== "DIRECT";

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 10px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      marginBottom: "4px",
                      background: isActive ? "var(--color-primary-subtle, #E7F3EE)" : "transparent",
                      border: isActive ? "1px solid var(--color-brand-border, #B2D8CB)" : "1px solid transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {/* Avatar with Status indicator */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {isGroup ? (
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "10px",
                            background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "#fff",
                          }}
                        >
                          <Users size={18} />
                        </div>
                      ) : (
                        <Avatar name={conv.name} avatar={conv.avatar || conv.other_participant?.avatar} size={42} />
                      )}
                      {conv.has_unread && (
                        <span
                          style={{
                            position: "absolute",
                            top: "-2px",
                            right: "-2px",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "#DC2626",
                            border: "2px solid #ffffff",
                          }}
                        />
                      )}
                    </div>

                    {/* Text Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <b style={{ fontSize: "13px", color: "var(--color-text, #18231F)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {conv.name}
                        </b>
                        <span style={{ fontSize: "10px", color: "var(--color-text-muted, #718096)", flexShrink: 0 }}>
                          {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: conv.has_unread ? "var(--color-primary, #087A5B)" : "var(--color-text-muted, #718096)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: conv.has_unread ? 700 : 400 }}>
                        {conv.last_message_sender_name ? `${conv.last_message_sender_name}: ` : ""}
                        {conv.last_message_text || "No messages yet"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* CENTER COLUMN: ACTIVE CHAT THREAD */}
        {/* ========================================================= */}
        <div
          className={!activeConversationId ? "chat-main-mobile-hidden" : "chat-main-mobile-full"}
          style={{ display: "flex", flexDirection: "column", background: "var(--color-background, #F3F5F4)", position: "relative", height: "100%", minHeight: 0, overflow: "hidden" }}
        >
          {activeConversation ? (
            <>
              {/* Active Conversation Top Bar */}
              <div
                className="chat-active-header"
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border, #DCE3E0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--panel, #ffffff)",
                  gap: "8px",
                  position: "sticky",
                  top: 0,
                  zIndex: 40,
                  flexShrink: 0,
                  minHeight: "58px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                  <button
                    type="button"
                    className="chat-mobile-back-btn"
                    onClick={() => {
                      setActiveConversationId(null);
                      setShowInfoDrawer(false);
                    }}
                    title="Back to conversation list"
                    aria-label="Back to conversation list"
                  >
                    <ArrowLeft size={19} />
                  </button>

                  {activeConversation.type !== "DIRECT" ? (
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #087A5B 0%, #066348 100%)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        color: "#fff",
                        fontSize: "14px",
                        flexShrink: 0,
                      }}
                    >
                      <Users size={18} />
                    </div>
                  ) : (
                    <Avatar name={activeConversation.name} avatar={activeConversation.avatar || activeConversation.other_participant?.avatar} size={38} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: "14.5px", fontWeight: 700, margin: 0, color: "var(--color-text, #18231F)", display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{activeConversation.name}</span>
                      {activeConversation.department && <Badge tone="info">{activeConversation.department}</Badge>}
                      {activeConversation.client_name && <Badge tone="gold">{activeConversation.client_name}</Badge>}
                    </h3>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted, #718096)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {activeConversation.type === "DIRECT"
                        ? activeConversation.other_participant?.role || "Active Member"
                        : `${activeConversation.participants?.length || 0} group participants`}
                    </span>
                  </div>
                </div>

                {/* Header Call & Meeting Actions */}
                <div className="chat-header-actions" style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {activeConversation.type !== "DIRECT" ? (
                    <>
                      {/* Instant Group Video Call */}
                      <button
                        onClick={() => handleLaunchGroupCall("video")}
                        style={{
                          padding: "6px 13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: "linear-gradient(135deg, #087A5B 0%, #066348 100%)",
                          color: "#ffffff",
                          border: 0,
                          borderRadius: "8px",
                          cursor: "pointer",
                          boxShadow: "0 2px 6px rgba(8, 122, 91, 0.25)",
                          transition: "all 0.15s ease",
                        }}
                        title="Start Instant Group Video Call with all members"
                      >
                        <Video size={14} />
                        <span className="chat-header-btn-text">Group Call</span>
                      </button>

                      {/* Add Person / Colleague to Group */}
                      <button
                        onClick={() => setAddMemberModalOpen(true)}
                        style={{
                          padding: "6px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: "var(--panel, #ffffff)",
                          border: "1.5px solid var(--color-brand-border, #B2D8CB)",
                          borderRadius: "8px",
                          color: "var(--color-primary, #087A5B)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        title="Add persons to this group"
                      >
                        <UserPlus size={14} />
                        <span className="chat-header-btn-text">Add Person</span>
                      </button>

                      {/* 1:1 Direct Call picker */}
                      <button
                        onClick={() => handleStartCall("audio")}
                        style={{
                          padding: "6px 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: "var(--panel, #ffffff)",
                          border: "1px solid var(--border, #DCE3E0)",
                          borderRadius: "8px",
                          color: "var(--color-text, #18231F)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        title="Call an individual member directly"
                      >
                        <Phone size={14} />
                        <span className="chat-header-btn-text">1:1 Call</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartCall("audio")}
                        style={{
                          padding: "6px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: "var(--panel, #ffffff)",
                          border: "1px solid var(--border, #DCE3E0)",
                          borderRadius: "8px",
                          color: "var(--color-text, #18231F)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        title="Start Voice Call"
                      >
                        <Phone size={14} />
                        <span className="chat-header-btn-text">Call</span>
                      </button>

                      <button
                        onClick={() => handleStartCall("video")}
                        style={{
                          padding: "6px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: "var(--panel, #ffffff)",
                          border: "1px solid var(--border, #DCE3E0)",
                          borderRadius: "8px",
                          color: "var(--color-text, #18231F)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        title="Start Video Call"
                      >
                        <Video size={14} />
                        <span className="chat-header-btn-text">Video</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={handleLaunchMeeting}
                    style={{
                      padding: "6px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: "var(--color-primary-subtle, #E7F3EE)",
                      border: "1px solid var(--color-brand-border, #B2D8CB)",
                      borderRadius: "8px",
                      color: "var(--color-primary, #087A5B)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title="Share instant FLUMENX meeting room in chat"
                  >
                    <Calendar size={14} />
                    <span className="chat-header-btn-text">Meeting</span>
                  </button>

                  <button
                    onClick={() => setShowInfoDrawer((prev) => !prev)}
                    style={{
                      padding: "6px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--panel, #ffffff)",
                      border: "1px solid var(--border, #DCE3E0)",
                      borderRadius: "8px",
                      color: "var(--color-text, #18231F)",
                      cursor: "pointer",
                    }}
                    title="Toggle details & participants drawer"
                  >
                    <Info size={15} />
                  </button>
                </div>
              </div>

              {/* PINNED MESSAGE BANNER */}
              {topPinnedMessage && (
                <div
                  style={{
                    padding: "8px 16px",
                    background: "var(--color-primary-subtle, #E7F3EE)",
                    borderBottom: "1px solid var(--color-brand-border, #B2D8CB)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary, #087A5B)" }}>
                    <Pin size={14} />
                    <b style={{ color: "var(--color-text, #18231F)" }}>Pinned:</b>
                    <span style={{ color: "var(--color-text-secondary, #4A5568)", maxWidth: "450px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {topPinnedMessage.text}
                    </span>
                  </div>
                  <button
                    onClick={() => handleTogglePin(topPinnedMessage.id)}
                    style={{ background: "transparent", border: 0, color: "var(--color-text-muted, #718096)", cursor: "pointer", fontSize: "11px" }}
                    title="Unpin Message"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* MESSAGE THREAD FEED */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScrollMessages}
                className="chat-messages-scroll-area"
                style={{
                  flex: "1 1 0%",
                  minHeight: 0,
                  overflowY: "auto",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                }}
              >
                {/* UPWARD INFINITE SCROLL LOADING SPINNER */}
                {loadingOlderMessages && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "8px 0",
                      color: "var(--color-primary, #087A5B)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Loading earlier messages...</span>
                  </div>
                )}

                {!loadingOlderMessages && hasMoreMessages && (
                  <div style={{ textAlign: "center", padding: "4px 0" }}>
                    <button
                      type="button"
                      onClick={loadOlderMessages}
                      style={{
                        background: "var(--panel, #ffffff)",
                        border: "1px solid var(--border, #DCE3E0)",
                        borderRadius: "16px",
                        padding: "4px 14px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--color-primary, #087A5B)",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                      }}
                    >
                      ↑ Load earlier messages
                    </button>
                  </div>
                )}

                {!hasMoreMessages && messages.length > 0 && !loadingMessages && (
                  <div style={{ textAlign: "center", padding: "6px 0 2px", color: "var(--color-text-muted, #718096)", fontSize: "11px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "12px", background: "var(--panel2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)" }}>
                      ✦ Beginning of conversation history
                    </span>
                  </div>
                )}

                {loadingMessages ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted, #718096)", fontSize: "13px" }}>
                    Loading conversation history...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--color-text-muted, #718096)" }}>
                    <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "var(--panel2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)", display: "grid", placeItems: "center", margin: "0 auto 12px", color: "var(--color-primary, #087A5B)" }}>
                      <MessageSquare size={24} />
                    </div>
                    <b style={{ fontSize: "14px", color: "var(--color-text, #18231F)", display: "block" }}>No messages yet</b>
                    <span style={{ fontSize: "12px" }}>Send a message or use the action buttons below to embed tasks or daily updates.</span>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = Boolean(
                      msg.is_self ||
                      (currentUser && (String(msg.sender_id) === String(currentUser.id) || String(msg.sender_id) === String((currentUser as any)._id))) ||
                      (msg.sender_name && currentUser && msg.sender_name === (currentUser.employee?.name || currentUser.first_name || currentUser.username))
                    );

                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isSelf ? "flex-end" : "flex-start",
                          maxWidth: "100%",
                        }}
                      >
                        {/* Sender name for group chats */}
                        {!isSelf && activeConversation.type !== "DIRECT" && (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-primary, #087A5B)", marginBottom: "3px", marginLeft: "4px" }}>
                            {msg.sender_name} {msg.sender_role && `(${msg.sender_role})`}
                          </span>
                        )}

                        {/* Bubble Container */}
                        <div
                          style={{
                            maxWidth: "75%",
                            padding: "10px 14px",
                            borderRadius: isSelf ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                            background: isSelf ? "linear-gradient(135deg, #087A5B 0%, #066047 100%)" : "var(--panel, #ffffff)",
                            border: isSelf ? "1px solid #066047" : "1px solid var(--border, #DCE3E0)",
                            color: isSelf ? "#ffffff" : "var(--color-text, #18231F)",
                            position: "relative",
                            boxShadow: isSelf ? "0 2px 8px rgba(8, 122, 91, 0.22)" : "0 1px 4px rgba(24,35,31,0.06)",
                          }}
                        >
                          {/* Pin Icon badge */}
                          {msg.is_pinned && (
                            <span style={{ position: "absolute", top: "-8px", right: "-8px", background: "#f59e0b", color: "#000", padding: "2px 6px", borderRadius: "10px", fontSize: "9px", fontWeight: 800, display: "flex", alignItems: "center", gap: "2px" }}>
                              <Pin size={10} /> PINNED
                            </span>
                          )}

                          {/* Forwarded label */}
                          {msg.is_forwarded && (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px", fontStyle: "italic", opacity: isSelf ? 0.85 : 0.75, marginBottom: "4px", color: isSelf ? "#fff" : "var(--color-text-muted, #718096)" }}>
                              <Share2 size={10} /> Forwarded
                            </div>
                          )}

                          {/* 1. TEXT MESSAGE */}
                          {msg.message_type === "TEXT" && (
                            <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                              {msg.text}
                            </p>
                          )}

                          {/* 2. IMAGE MESSAGE */}
                          {msg.message_type === "IMAGE" && msg.attachments?.[0] && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <img
                                src={resolveChatMediaUrl(msg.attachments[0].url)}
                                alt={msg.attachments[0].name}
                                onClick={() =>
                                  setPreviewMedia({
                                    src: resolveChatMediaUrl(msg.attachments![0].url),
                                    alt: msg.attachments![0].name,
                                    isVideo: false,
                                  })
                                }
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  const currentSrc = target.src;
                                  if (currentSrc.includes("/media/chat/")) {
                                    target.src = currentSrc.replace("/media/chat/", "/media/employee_documents/");
                                  } else if (currentSrc.includes("/media/employee_documents/")) {
                                    target.src = currentSrc.replace("/media/employee_documents/", "/media/");
                                  }
                                }}
                                style={{
                                  maxWidth: "100%",
                                  width: "280px",
                                  maxHeight: "260px",
                                  borderRadius: "10px",
                                  objectFit: "cover",
                                  cursor: "zoom-in",
                                  border: "1px solid rgba(0,0,0,0.1)",
                                  background: "rgba(0,0,0,0.04)",
                                  display: "block",
                                  transition: "transform 0.15s ease",
                                }}
                              />
                              <span style={{ fontSize: "11px", opacity: 0.8 }}>{msg.attachments[0].name}</span>
                            </div>
                          )}

                          {/* 3. VIDEO MESSAGE */}
                          {msg.message_type === "VIDEO" && msg.attachments?.[0] && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <video
                                src={resolveChatMediaUrl(msg.attachments[0].url)}
                                controls
                                style={{ maxWidth: "100%", width: "320px", maxHeight: "240px", borderRadius: "10px" }}
                              />
                              <span style={{ fontSize: "11px", opacity: 0.8 }}>{msg.attachments[0].name}</span>
                            </div>
                          )}

                          {/* 4. FILE / DOCUMENT MESSAGE */}
                          {msg.message_type === "FILE" && msg.attachments?.[0] && (
                            <a
                              href={resolveChatMediaUrl(msg.attachments[0].url)}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "8px 12px",
                                background: isSelf ? "rgba(0,0,0,0.15)" : "var(--panel2, #F8FAF9)",
                                borderRadius: "8px",
                                color: isSelf ? "#fff" : "var(--color-primary, #087A5B)",
                                textDecoration: "none",
                                fontSize: "13px",
                                fontWeight: 600,
                              }}
                            >
                              <FileText size={20} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                                {msg.attachments[0].name}
                              </span>
                              <ExternalLink size={14} style={{ marginLeft: "auto", flexShrink: 0 }} />
                            </a>
                          )}

                          {/* 5. TASK EMBED CARD */}
                          {msg.message_type === "TASK_EMBED" && msg.task_embed && (
                            <div
                              style={{
                                padding: "10px 12px",
                                background: isSelf ? "rgba(0,0,0,0.15)" : "var(--panel2, #F8FAF9)",
                                border: isSelf ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--border, #DCE3E0)",
                                borderRadius: "8px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                minWidth: "220px",
                              }}
                            >
                              <span style={{ fontSize: "11px", fontWeight: 700, color: isSelf ? "#fff" : "var(--color-primary, #087A5B)", display: "flex", alignItems: "center", gap: "4px" }}>
                                <ListTodo size={13} /> ATTACHED WORK TASK
                              </span>
                              <b style={{ fontSize: "13.5px", color: isSelf ? "#fff" : "var(--color-text, #18231F)" }}>{msg.task_embed.title}</b>
                              <div style={{ display: "flex", gap: "8px", fontSize: "11px", opacity: 0.9 }}>
                                <span>Status: {msg.task_embed.status}</span>
                                <span>• Priority: {msg.task_embed.priority}</span>
                              </div>
                            </div>
                          )}

                          {/* 6. CLIENT EMBED CARD */}
                          {msg.message_type === "CLIENT_EMBED" && msg.client_embed && (
                            <div
                              style={{
                                padding: "10px 12px",
                                background: isSelf ? "rgba(0,0,0,0.15)" : "var(--panel2, #F8FAF9)",
                                border: isSelf ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--border, #DCE3E0)",
                                borderRadius: "8px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                                minWidth: "220px",
                              }}
                            >
                              <span style={{ fontSize: "11px", fontWeight: 700, color: isSelf ? "#fff" : "#D97706", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Briefcase size={13} /> CLIENT REFERENCE
                              </span>
                              <b style={{ fontSize: "13.5px", color: isSelf ? "#fff" : "var(--color-text, #18231F)" }}>{msg.client_embed.name}</b>
                              {msg.client_embed.industry && <span style={{ fontSize: "11px", opacity: 0.8 }}>Industry: {msg.client_embed.industry}</span>}
                            </div>
                          )}

                          {/* 7. STANDUP UPDATE CARD */}
                          {msg.message_type === "STANDUP_UPDATE" && msg.standup_data && (
                            <div
                              style={{
                                padding: "12px",
                                background: isSelf ? "rgba(0,0,0,0.15)" : "var(--panel2, #F8FAF9)",
                                border: isSelf ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--border, #DCE3E0)",
                                borderRadius: "10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                minWidth: "260px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: isSelf ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--border, #DCE3E0)", paddingBottom: "6px" }}>
                                <span style={{ fontSize: "12px", fontWeight: 800, color: isSelf ? "#fff" : "var(--color-primary, #087A5B)", display: "flex", alignItems: "center", gap: "5px" }}>
                                  <Flame size={14} color={isSelf ? "#FDE68A" : "#D97706"} /> DAILY STANDUP UPDATE
                                </span>
                                <span style={{ fontSize: "11px", opacity: 0.8 }}>{msg.standup_data.date}</span>
                              </div>

                              {/* Completed */}
                              {msg.standup_data.completedTasks?.length > 0 && (
                                <div>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: isSelf ? "#fff" : "#16855B", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <CheckCircle2 size={12} /> Completed Today:
                                  </span>
                                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "12px", color: isSelf ? "#fff" : "var(--color-text, #18231F)" }}>
                                    {msg.standup_data.completedTasks.map((t: string, i: number) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* In Progress */}
                              {msg.standup_data.inProgressTasks?.length > 0 && (
                                <div>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: isSelf ? "#fff" : "#2563EB", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Clock size={12} /> In Progress / Next:
                                  </span>
                                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "12px", color: isSelf ? "#fff" : "var(--color-text, #18231F)" }}>
                                    {msg.standup_data.inProgressTasks.map((t: string, i: number) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Blockers */}
                              {msg.standup_data.blockers?.length > 0 && (
                                <div>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: isSelf ? "#FDE68A" : "#D97706", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <AlertCircle size={12} /> Blockers / Remarks:
                                  </span>
                                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "12px", color: isSelf ? "#fff" : "var(--color-text, #18231F)" }}>
                                    {msg.standup_data.blockers.map((b: string, i: number) => (
                                      <li key={i}>{b}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 8. MEETING LINK CARD */}
                          {msg.message_type === "MEETING_LINK" && msg.meeting_code && (
                            <div
                              style={{
                                padding: "12px",
                                background: isSelf ? "rgba(0,0,0,0.15)" : "#EFF6FF",
                                border: isSelf ? "1px solid rgba(255,255,255,0.2)" : "1px solid #BFDBFE",
                                borderRadius: "10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                minWidth: "240px",
                              }}
                            >
                              <span style={{ fontSize: "11px", fontWeight: 800, color: isSelf ? "#fff" : "#2563EB", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Calendar size={13} /> FLUMENX HQ MEETING ROOM
                              </span>
                              <b style={{ fontSize: "14px", color: isSelf ? "#fff" : "var(--color-text, #18231F)" }}>Code: {msg.meeting_code}</b>
                              <a
                                href={`/meetings/${msg.meeting_code}`}
                                style={{
                                  padding: "6px 12px",
                                  background: "var(--color-primary, #087A5B)",
                                  borderRadius: "6px",
                                  textAlign: "center",
                                  fontSize: "12px",
                                  color: "#fff",
                                  textDecoration: "none",
                                  fontWeight: 700,
                                }}
                              >
                                Join Meeting Now →
                              </a>
                            </div>
                          )}

                          {/* Message Actions, Timestamp, Delivery / Seen Ticks */}
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                            {/* Forward Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenForwardModal(msg)}
                              style={{ background: "transparent", border: 0, color: isSelf ? "rgba(255,255,255,0.7)" : "var(--color-text-muted, #718096)", cursor: "pointer", padding: "2px", display: "inline-flex", alignItems: "center" }}
                              title="Forward message"
                            >
                              <Share2 size={11} />
                            </button>

                            {/* Pin Button */}
                            <button
                              type="button"
                              onClick={() => handleTogglePin(msg.id)}
                              style={{ background: "transparent", border: 0, color: isSelf ? "rgba(255,255,255,0.7)" : "var(--color-text-muted, #718096)", cursor: "pointer", padding: "2px", display: "inline-flex", alignItems: "center" }}
                              title={msg.is_pinned ? "Unpin message" : "Pin message"}
                            >
                              <Pin size={11} />
                            </button>

                            {/* Delete Button (Self or Admin) */}
                            {(isSelf || activeConversation?.is_admin || role === "admin") && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                style={{ background: "transparent", border: 0, color: isSelf ? "rgba(255,255,255,0.7)" : "#EF4444", cursor: "pointer", padding: "2px", display: "inline-flex", alignItems: "center" }}
                                title="Delete message for everyone"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}

                            <span style={{ fontSize: "10px", opacity: isSelf ? 0.8 : 0.65, color: isSelf ? "#fff" : "var(--color-text-muted, #718096)" }}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>

                            {/* Message Status Ticks: 1 tick = sent, 2 gray ticks = delivered, 2 bright blue ticks = read/seen */}
                            {isSelf && (
                              <span
                                style={{ display: "inline-flex", alignItems: "center", marginLeft: "2px" }}
                                title={msg.is_read ? "Seen (Read)" : msg.is_delivered ? "Delivered" : "Sent"}
                              >
                                {msg.is_read ? (
                                  <CheckCheck size={14} color="#38BDF8" style={{ filter: "drop-shadow(0 0 2.5px rgba(56, 189, 248, 0.75))" }} />
                                ) : msg.is_delivered ? (
                                  <CheckCheck size={14} color="rgba(255,255,255,0.85)" />
                                ) : (
                                  <Check size={13} color="rgba(255,255,255,0.7)" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* SMART MESSAGE INPUT FOOTER */}
              <div
                className="chat-input-footer-wrapper"
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid var(--border, #DCE3E0)",
                  background: "var(--panel, #ffffff)",
                  position: "sticky",
                  bottom: 0,
                  zIndex: 40,
                  flexShrink: 0,
                }}
              >
                {/* Smart Action Bar Chips */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", overflowX: "auto", paddingBottom: "2px", WebkitOverflowScrolling: "touch" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "var(--panel2, #F8FAF9)",
                      border: "1px solid var(--border2, #CBD5E1)",
                      borderRadius: "8px",
                      color: "var(--color-text, #18231F)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                    title="Attach Image / Video / File"
                  >
                    <Paperclip size={14} color="#64748B" />
                    <span className="chat-action-btn-text">Attach File</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />

                  <button
                    type="button"
                    onClick={() => setTaskPickerOpen(true)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: "8px",
                      color: "#1D4ED8",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                    title="Link and embed an active task"
                  >
                    <ListTodo size={14} color="#2563EB" />
                    <span className="chat-action-btn-text">Link Task</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientPickerOpen(true)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "#FFFBEB",
                      border: "1px solid #FDE68A",
                      borderRadius: "8px",
                      color: "#B45309",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                    title="Link and embed a client account"
                  >
                    <Briefcase size={14} color="#D97706" />
                    <span className="chat-action-btn-text">Link Client</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStandupModalOpen(true)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "var(--color-primary-subtle, #E7F3EE)",
                      border: "1px solid var(--color-brand-border, #B2D8CB)",
                      borderRadius: "8px",
                      color: "var(--color-primary, #087A5B)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                    title="1-Click Daily Standup Work Update"
                  >
                    <Sparkles size={14} color="var(--color-primary, #087A5B)" />
                    <span className="chat-action-btn-text">Daily Standup</span>
                  </button>
                </div>

                {/* Textarea + Send Container */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Type message to ${activeConversation.name}... (Press Enter)`}
                    style={{
                      flex: 1,
                      height: "44px",
                      padding: "0 16px",
                      fontSize: "13.5px",
                      borderRadius: "12px",
                      background: "var(--panel2, #F8FAF9)",
                      border: "1.5px solid var(--border2, #CBD5E1)",
                      color: "var(--color-text, #18231F)",
                      outline: "none",
                      transition: "border-color 0.15s ease",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !inputText.trim()}
                    style={{
                      height: "44px",
                      padding: "0 20px",
                      borderRadius: "12px",
                      border: "none",
                      background: inputText.trim() ? "linear-gradient(135deg, #087A5B 0%, #066348 100%)" : "#94A3B8",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: inputText.trim() ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: inputText.trim() ? "0 3px 10px rgba(8,122,91,0.3)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Send size={15} />
                    <span className="chat-action-btn-text">Send</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--color-text-muted, #718096)" }}>
              Select a conversation to start messaging.
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: COLLAPSIBLE GROUP INFO DRAWER */}
        {/* ========================================================= */}
        {showInfoDrawer && activeConversation && (
          <>
            <div className="chat-info-drawer-backdrop" onClick={() => setShowInfoDrawer(false)} />
            <div
              className="chat-info-drawer-mobile"
              style={{
                borderLeft: "1px solid var(--border, #DCE3E0)",
                background: "var(--panel2, #F8FAF9)",
                display: "flex",
                flexDirection: "column",
                padding: "16px",
                overflowY: "auto",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontSize: "14px", color: "var(--color-text, #18231F)" }}>Group Info</b>
                <button
                  onClick={() => setShowInfoDrawer(false)}
                  style={{ background: "transparent", border: 0, color: "var(--color-text-muted, #718096)", cursor: "pointer" }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Avatar & Title */}
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                {activeConversation.type !== "DIRECT" ? (
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, #087A5B 0%, #066348 100%)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "20px",
                      fontWeight: 800,
                      color: "#fff",
                      margin: "0 auto 8px",
                    }}
                  >
                    <Users size={24} />
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                    <Avatar name={activeConversation.name} avatar={activeConversation.avatar || activeConversation.other_participant?.avatar} size={56} />
                  </div>
                )}
                <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 4px", color: "var(--color-text, #18231F)" }}>
                  {activeConversation.name}
                </h4>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted, #718096)" }}>
                  {activeConversation.description || "Official collaboration channel"}
                </span>
              </div>

              {/* Members Section */}
              {activeConversation.type !== "DIRECT" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--color-text, #18231F)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Members ({activeConversation.participants?.length || 0})
                    </span>
                    {activeConversation.is_admin && (
                      <button
                        onClick={() => setAddMemberModalOpen(true)}
                        style={{ background: "transparent", border: 0, color: "var(--color-primary, #087A5B)", cursor: "pointer", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "2px" }}
                      >
                        <UserPlus size={12} /> Add
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {(activeConversation.participants || []).map((p) => {
                      const currentUser = getCachedAuthUser();
                      const isSelf = String(p.user_id) === String(currentUser?.id || (currentUser as any)?.user_id || "");
                      return (
                        <div
                          key={p.user_id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            background: "var(--panel, #ffffff)",
                            border: "1px solid var(--border, #DCE3E0)",
                            borderRadius: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                            <Avatar name={p.name} avatar={p.avatar} size={26} />
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text, #18231F)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.name} {isSelf ? "(You)" : ""}
                              </span>
                              <span style={{ fontSize: "10px", color: "var(--color-text-muted, #718096)" }}>
                                {p.role === "ADMIN" ? "Admin" : "Member"}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            {!isSelf && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartCall("audio", { id: p.user_id, name: p.name, avatar: p.avatar })}
                                  style={{ background: "var(--panel2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)", borderRadius: "6px", color: "#087A5B", cursor: "pointer", padding: "4px 6px", display: "inline-flex", alignItems: "center" }}
                                  title={`Voice Call ${p.name}`}
                                >
                                  <Phone size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartCall("video", { id: p.user_id, name: p.name, avatar: p.avatar })}
                                  style={{ background: "var(--panel2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)", borderRadius: "6px", color: "#2563EB", cursor: "pointer", padding: "4px 6px", display: "inline-flex", alignItems: "center" }}
                                  title={`Video Call ${p.name}`}
                                >
                                  <Video size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartDirectChatWithUser(p.user_id)}
                                  style={{ background: "var(--panel2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)", borderRadius: "6px", color: "#64748B", cursor: "pointer", padding: "4px 6px", display: "inline-flex", alignItems: "center" }}
                                  title={`Direct Chat with ${p.name}`}
                                >
                                  <MessageSquare size={12} />
                                </button>
                              </>
                            )}

                            {activeConversation.is_admin && !isSelf && (
                              <button
                                onClick={() => handleRemoveMember(p.user_id)}
                                style={{ background: "transparent", border: 0, color: "#DC2626", cursor: "pointer", padding: "4px" }}
                                title="Remove member"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: NEW CHAT / GROUP MODAL */}
      {/* ========================================================= */}
      {newChatModalOpen && (
        <Modal onClose={() => setNewChatModalOpen(false)} title={newChatMode === "DIRECT" ? "Start Direct Message" : "Create Team Group / Channel"}>
          <form onSubmit={handleCreateConversation} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Mode Switcher */}
            <div style={{ display: "flex", gap: "6px", padding: "4px", background: "var(--panel2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)", borderRadius: "10px" }}>
              <button
                type="button"
                onClick={() => setNewChatMode("DIRECT")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: 0,
                  background: newChatMode === "DIRECT" ? "var(--color-primary, #087A5B)" : "transparent",
                  color: newChatMode === "DIRECT" ? "#FFFFFF" : "var(--color-text-secondary, #4A5568)",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                1:1 Direct Chat
              </button>
              <button
                type="button"
                onClick={() => setNewChatMode("GROUP")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: 0,
                  background: newChatMode === "GROUP" ? "var(--color-primary, #087A5B)" : "transparent",
                  color: newChatMode === "GROUP" ? "#FFFFFF" : "var(--color-text-secondary, #4A5568)",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Group Channel
              </button>
            </div>

            {newChatMode === "GROUP" && (
              <>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text, #18231F)", display: "block", marginBottom: "6px" }}>
                    Channel Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Video Production Hub or Expo Masters"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border2, #CBD5E1)", background: "var(--panel, #ffffff)", color: "var(--color-text, #18231F)", fontSize: "13px" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text, #18231F)", display: "block", marginBottom: "6px" }}>
                      Group Type
                    </label>
                    <select
                      value={newGroupType}
                      onChange={(e: any) => setNewGroupType(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border2, #CBD5E1)", background: "var(--panel, #ffffff)", color: "var(--color-text, #18231F)", fontSize: "13px" }}
                    >
                      <option value="GROUP">General Group</option>
                      <option value="DEPARTMENT">Department Channel</option>
                      <option value="CLIENT">Client Project Channel</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text, #18231F)", display: "block", marginBottom: "6px" }}>
                      Department (Optional)
                    </label>
                    <input
                      type="text"
                      value={newGroupDept}
                      onChange={(e) => setNewGroupDept(e.target.value)}
                      placeholder="e.g. Editing"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border2, #CBD5E1)", background: "var(--panel, #ffffff)", color: "var(--color-text, #18231F)", fontSize: "13px" }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* User Selector with Search */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text, #18231F)" }}>
                  {newChatMode === "DIRECT" ? "Select Colleague *" : "Add Members to Group"}
                </label>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted, #718096)" }}>
                  {selectedUserIds.length} selected
                </span>
              </div>

              <input
                type="text"
                placeholder="Filter colleagues by name or role..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border2, #CBD5E1)", background: "var(--panel2, #F8FAF9)", color: "var(--color-text, #18231F)", fontSize: "12.5px", marginBottom: "8px" }}
              />

              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {usersList
                  .filter((u) => !userSearchQuery || u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.department?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                  .map((u) => {
                    const isSelected = selectedUserIds.includes(String(u.id));
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (newChatMode === "DIRECT") {
                            setSelectedUserIds([String(u.id)]);
                          } else {
                            setSelectedUserIds((prev) =>
                              isSelected ? prev.filter((id) => id !== String(u.id)) : [...prev, String(u.id)]
                            );
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: isSelected ? "var(--color-primary-subtle, #E7F3EE)" : "var(--panel2, #F8FAF9)",
                          border: isSelected ? "1.5px solid var(--color-brand-border, #B2D8CB)" : "1px solid var(--border, #DCE3E0)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Avatar name={u.name} avatar={u.avatar} size={28} />
                          <div>
                            <b style={{ fontSize: "12.5px", color: "var(--color-text, #18231F)", display: "block" }}>{u.name}</b>
                            <span style={{ fontSize: "10.5px", color: "var(--color-text-muted, #718096)" }}>{u.department} • {u.portal_role}</span>
                          </div>
                        </div>
                        {isSelected && <Check size={16} color="var(--color-primary, #087A5B)" />}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                onClick={() => setNewChatModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #DCE3E0)",
                  background: "var(--panel2, #F8FAF9)",
                  color: "var(--color-text, #18231F)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <PrimaryButton type="submit">
                {newChatMode === "DIRECT" ? "Open Chat" : "Create Group"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD MEMBERS TO GROUP MODAL */}
      {/* ========================================================= */}
      {addMemberModalOpen && (
        <Modal onClose={() => setAddMemberModalOpen(false)} title="Add Members to Group">
          <form onSubmit={handleAddMembers} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <input
              type="text"
              placeholder="Search members..."
              value={addMemberSearchQuery}
              onChange={(e) => setAddMemberSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border2, #CBD5E1)", background: "var(--panel2, #F8FAF9)", color: "var(--color-text, #18231F)", fontSize: "12.5px" }}
            />

            <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {(() => {
                const existingParticipantIds = new Set(
                  (activeConversation?.participants || []).map((p) => String(p.user_id))
                );
                const availableUsers = usersList.filter((u) => !existingParticipantIds.has(String(u.id)));

                if (availableUsers.length === 0) {
                  return (
                    <div style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--color-text-muted, #718096)" }}>
                      All registered colleagues are already members of this group.
                    </div>
                  );
                }

                return availableUsers
                  .filter((u) => !addMemberSearchQuery || u.name.toLowerCase().includes(addMemberSearchQuery.toLowerCase()) || u.department?.toLowerCase().includes(addMemberSearchQuery.toLowerCase()))
                  .map((u) => {
                    const isSelected = membersToAdd.includes(String(u.id));
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          setMembersToAdd((prev) =>
                            isSelected ? prev.filter((id) => id !== String(u.id)) : [...prev, String(u.id)]
                          );
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: isSelected ? "var(--color-primary-subtle, #E7F3EE)" : "var(--panel2, #F8FAF9)",
                          border: isSelected ? "1.5px solid var(--color-brand-border, #B2D8CB)" : "1px solid var(--border, #DCE3E0)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Avatar name={u.name} avatar={u.avatar} size={28} />
                          <div>
                            <b style={{ fontSize: "12.5px", color: "var(--color-text, #18231F)", display: "block" }}>{u.name}</b>
                            <span style={{ fontSize: "10.5px", color: "var(--color-text-muted, #718096)" }}>{u.department}</span>
                          </div>
                        </div>
                        {isSelected && <Check size={16} color="var(--color-primary, #087A5B)" />}
                      </div>
                    );
                  });
              })()}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setAddMemberModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #DCE3E0)",
                  background: "var(--panel2, #F8FAF9)",
                  color: "var(--color-text, #18231F)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={membersToAdd.length === 0}>
                Add Selected ({membersToAdd.length})
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: TASK PICKER EMBED MODAL */}
      {/* ========================================================= */}
      {taskPickerOpen && (
        <Modal onClose={() => setTaskPickerOpen(false)} title="Select Task to Embed in Chat">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="text"
              placeholder="Search tasks by title or client..."
              value={taskSearchQuery}
              onChange={(e) => setTaskSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border2, #CBD5E1)", background: "var(--panel2, #F8FAF9)", color: "var(--color-text, #18231F)", fontSize: "12.5px" }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
              {tasksList
                .filter((t) => !taskSearchQuery || t.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) || t.client_name?.toLowerCase().includes(taskSearchQuery.toLowerCase()))
                .map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleEmbedTask(t)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "var(--panel2, #F8FAF9)",
                      border: "1px solid var(--border, #DCE3E0)",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <b style={{ fontSize: "13px", color: "var(--color-text, #18231F)", display: "block" }}>{t.title}</b>
                      <span style={{ fontSize: "11px", color: "var(--color-text-muted, #718096)" }}>
                        Assignee: {t.employee_name || "Team Member"} • Client: {t.client_name || "General"}
                      </span>
                    </div>
                    <Badge tone={t.priority === "Urgent" ? "danger" : "info"}>{t.priority}</Badge>
                  </div>
                ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: CLIENT PICKER EMBED MODAL */}
      {/* ========================================================= */}
      {clientPickerOpen && (
        <Modal onClose={() => setClientPickerOpen(false)} title="Select Client Account to Link">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="text"
              placeholder="Search clients..."
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border2, #CBD5E1)", background: "var(--panel2, #F8FAF9)", color: "var(--color-text, #18231F)", fontSize: "12.5px" }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
              {clientsList
                .filter((c) => !clientSearchQuery || c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) || c.industry?.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                .map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleEmbedClient(c)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "var(--panel2, #F8FAF9)",
                      border: "1px solid var(--border, #DCE3E0)",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <b style={{ fontSize: "13.5px", color: "var(--color-text, #18231F)", display: "block" }}>{c.name}</b>
                      <span style={{ fontSize: "11px", color: "var(--color-text-muted, #718096)" }}>
                        {c.industry || "General"} • {c.contact_person?.name ? `Contact: ${c.contact_person.name}` : ""}
                      </span>
                    </div>
                    <Badge tone="gold">Client</Badge>
                  </div>
                ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: 1-CLICK DAILY STANDUP WORK MODAL */}
      {/* ========================================================= */}
      <DailyStandupModal
        isOpen={standupModalOpen}
        onClose={() => setStandupModalOpen(false)}
        onSubmit={handleEmbedStandup}
      />


      {/* ========================================================= */}
      {/* MODAL 6: GROUP CALL MEMBER SELECTOR */}
      {/* ========================================================= */}
      {callPickerOpen && activeConversation && (
        <Modal
          onClose={() => setCallPickerOpen(false)}
          title={`Initiate ${callPickerType === "video" ? "Video" : "Voice"} Call in ${activeConversation.name}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* 1. TOP FEATURED: INSTANT GROUP CALL */}
            <div
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, rgba(8, 122, 91, 0.08) 0%, rgba(37, 99, 235, 0.08) 100%)",
                border: "1.5px solid var(--color-brand-border, #B2D8CB)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--color-text, #18231F)" }}>
                    {callPickerType === "video" ? "📹 Instant Group Video Call" : "📞 Instant Group Voice Call"}
                  </span>
                  <Badge tone="success">Group</Badge>
                </div>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted, #718096)", display: "block" }}>
                  Connect all {activeConversation.participants?.length || 0} members together in an instant collaborative room
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCallPickerOpen(false);
                  handleLaunchGroupCall(callPickerType);
                }}
                style={{
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontWeight: 800,
                  borderRadius: "9px",
                  border: 0,
                  background: callPickerType === "video" ? "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)" : "linear-gradient(135deg, #087A5B 0%, #066348 100%)",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 3px 10px rgba(0,0,0,0.15)",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {callPickerType === "video" ? <Video size={16} /> : <Phone size={16} />}
                Start Group Call
              </button>
            </div>

            {/* 2. DIRECT 1:1 MEMBER CALL SECTION */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 800, color: "var(--color-text-secondary, #4A5568)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Or Call Individual Member (1:1 Direct)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCallPickerOpen(false);
                    setAddMemberModalOpen(true);
                  }}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--color-primary, #087A5B)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <UserPlus size={13} /> Add Person to Group
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto" }}>
                {(activeConversation.participants || [])
                  .filter((p) => {
                    const currentUser = getCachedAuthUser();
                    return String(p.user_id) !== String(currentUser?.id || (currentUser as any)?.user_id || "");
                  })
                  .map((p) => {
                    const isOnline = onlineUserIds.length === 0 || onlineUserIds.includes(String(p.user_id));
                    return (
                      <div
                        key={p.user_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "var(--panel2, #F8FAF9)",
                          border: "1px solid var(--border, #DCE3E0)",
                          borderRadius: "10px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ position: "relative" }}>
                            <Avatar name={p.name} avatar={p.avatar} size={32} />
                            <span
                              style={{
                                position: "absolute",
                                bottom: "-1px",
                                right: "-1px",
                                width: "9px",
                                height: "9px",
                                borderRadius: "50%",
                                background: isOnline ? "#10b981" : "#94a3b8",
                                border: "1.5px solid #ffffff",
                              }}
                              title={isOnline ? "Online" : "Offline"}
                            />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <b style={{ fontSize: "13px", color: "var(--color-text, #18231F)" }}>{p.name}</b>
                              <span
                                style={{
                                  fontSize: "9.5px",
                                  fontWeight: 700,
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  background: isOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                                  color: isOnline ? "#087A5B" : "#64748b",
                                }}
                              >
                                {isOnline ? "Online" : "Offline"}
                              </span>
                            </div>
                            <span style={{ fontSize: "11px", color: "var(--color-text-muted, #718096)" }}>
                              {p.department || p.role || "Team Member"}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!isOnline}
                          onClick={() => {
                            if (!isOnline) {
                              toast.warning(`Cannot call: ${p.name} is currently offline.`);
                              return;
                            }
                            setCallPickerOpen(false);
                            handleStartCall(callPickerType, { id: p.user_id, name: p.name, avatar: p.avatar });
                          }}
                          style={{
                            padding: "6px 14px",
                            fontSize: "12px",
                            fontWeight: 700,
                            borderRadius: "8px",
                            border: 0,
                            background: !isOnline ? "var(--border2, #CBD5E1)" : callPickerType === "video" ? "#2563EB" : "#087A5B",
                            color: !isOnline ? "var(--color-text-muted, #718096)" : "#ffffff",
                            cursor: !isOnline ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            opacity: !isOnline ? 0.6 : 1,
                          }}
                        >
                          {!isOnline ? "Offline" : (
                            <>
                              {callPickerType === "video" ? <Video size={14} /> : <Phone size={14} />}
                              Call {p.name.split(" ")[0]}
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* 3. MULTI-USER MEETING OPTION */}
            <div style={{ borderTop: "1px solid var(--border, #DCE3E0)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted, #718096)" }}>Full Meeting Center:</span>
              <button
                type="button"
                onClick={() => {
                  setCallPickerOpen(false);
                  handleLaunchMeeting();
                }}
                style={{
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  background: "var(--panel, #ffffff)",
                  border: "1.5px solid var(--color-primary, #087A5B)",
                  color: "var(--color-primary, #087A5B)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Calendar size={14} /> Open Meeting Room
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: FORWARD MESSAGE MODAL */}
      {/* ========================================================= */}
      {forwardModalOpen && messageToForward && (
        <Modal onClose={() => { setForwardModalOpen(false); setMessageToForward(null); }} title="Forward Message">
          <form onSubmit={handleForwardMessage} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Message Preview Snippet */}
            <div
              style={{
                padding: "10px 14px",
                background: "var(--panel2, #F8FAF9)",
                border: "1px solid var(--border, #DCE3E0)",
                borderRadius: "8px",
                fontSize: "12.5px",
                color: "var(--color-text, #18231F)",
                maxHeight: "80px",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted, #718096)", display: "block", marginBottom: "4px" }}>
                Forwarding message from {messageToForward.sender_name}:
              </span>
              <div style={{ fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {messageToForward.text || (messageToForward.message_type === "IMAGE" ? "📷 Image" : messageToForward.message_type === "VIDEO" ? "🎥 Video" : "📎 Attachment")}
              </div>
            </div>

            {/* Search filter */}
            <input
              type="text"
              placeholder="Search conversations or colleagues..."
              value={forwardSearchQuery}
              onChange={(e) => setForwardSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border2, #CBD5E1)",
                background: "var(--panel2, #F8FAF9)",
                color: "var(--color-text, #18231F)",
                fontSize: "12.5px",
              }}
            />

            {/* List of Conversations */}
            <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {conversations
                .filter((c) => !forwardSearchQuery || c.name.toLowerCase().includes(forwardSearchQuery.toLowerCase()))
                .map((c) => {
                  const isSelected = forwardTargetIds.includes(String(c.id));
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setForwardTargetIds((prev) =>
                          isSelected ? prev.filter((id) => id !== String(c.id)) : [...prev, String(c.id)]
                        );
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        background: isSelected ? "var(--color-primary-subtle, #E7F3EE)" : "var(--panel2, #F8FAF9)",
                        border: isSelected ? "1.5px solid var(--color-brand-border, #B2D8CB)" : "1px solid var(--border, #DCE3E0)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Avatar name={c.name} avatar={c.avatar} size={30} />
                        <div>
                          <b style={{ fontSize: "13px", color: "var(--color-text, #18231F)", display: "block" }}>{c.name}</b>
                          <span style={{ fontSize: "11px", color: "var(--color-text-muted, #718096)" }}>
                            {c.type === "DIRECT" ? "Direct Message" : `${c.participants?.length || 0} participants`}
                          </span>
                        </div>
                      </div>
                      {isSelected ? (
                        <Check size={16} color="var(--color-primary, #087A5B)" />
                      ) : (
                        <div style={{ width: "16px", height: "16px", borderRadius: "4px", border: "1.5px solid var(--border2, #CBD5E1)" }} />
                      )}
                    </div>
                  );
                })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => { setForwardModalOpen(false); setMessageToForward(null); }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #DCE3E0)",
                  background: "var(--panel2, #F8FAF9)",
                  color: "var(--color-text, #18231F)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={forwardTargetIds.length === 0 || forwardingLoading}>
                {forwardingLoading ? "Forwarding..." : `Forward (${forwardTargetIds.length})`}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* LIGHTBOX MEDIA PREVIEW */}
      {/* ========================================================= */}
      {previewMedia && (
        <ChatMediaLightbox
          src={previewMedia.src}
          alt={previewMedia.alt}
          isVideo={previewMedia.isVideo}
          onClose={() => setPreviewMedia(null)}
        />
      )}
    </Shell>
  );
}
