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
import {
  ChatConversationItem,
  ChatMessageItem,
  ChatUserOption,
  WorkAssignment,
  Client,
  WorkspaceRole,
} from "@/lib/types";
import { DirectCallModal } from "./DirectCallModal";
import { DailyStandupModal } from "./DailyStandupModal";
import { ChatMediaLightbox } from "./ChatMediaLightbox";
import { useWebRTCCall } from "./useWebRTCCall";
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

  // Modals state
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [newChatMode, setNewChatMode] = useState<"DIRECT" | "GROUP">("DIRECT");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<"GROUP" | "DEPARTMENT" | "CLIENT">("GROUP");
  const [newGroupDept, setNewGroupDept] = useState("");
  const [newGroupClient, setNewGroupClient] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Add Member Modal
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState<string[]>([]);

  // Smart Embed Modals
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [standupModalOpen, setStandupModalOpen] = useState(false);

  // Real-Time WebRTC Calling & Online Presence
  const { activeCall, localStream, remoteStream, startCall, acceptCall, endCall } = useWebRTCCall();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  // Lightbox Media Preview
  const [previewMedia, setPreviewMedia] = useState<{ src: string; alt?: string; isVideo?: boolean } | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    } else if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Active Conversation Object
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  // Load Conversations & Metadata
  const loadInitialData = async () => {
    setLoadingConversations(true);
    try {
      const [convs, users, tasks, clients] = await Promise.all([
        api<ChatConversationItem[]>("/chat/conversations/").catch(() => []),
        api<ChatUserOption[]>("/chat/users/").catch(() => []),
        api<any>("/work-assignments/").catch(() => []),
        api<any>("/clients/").catch(() => []),
      ]);

      const convList = Array.isArray(convs) ? convs : [];
      setConversations(convList);
      setUsersList(Array.isArray(users) ? users : []);
      setTasksList(Array.isArray(tasks) ? tasks : tasks?.results || []);
      setClientsList(Array.isArray(clients) ? clients : clients?.results || []);

      // Auto-select first conversation ONLY on desktop
      if (convList.length > 0 && !activeConversationId) {
        if (typeof window !== "undefined" && window.innerWidth > 868) {
          setActiveConversationId(convList[0].id);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load chat data");
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Load Messages for Active Conversation (Initial latest 30 batch)
  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    setHasMoreMessages(false);
    try {
      const res = await api<any>(`/chat/conversations/${conversationId}/messages/?limit=30`);
      const msgs = Array.isArray(res) ? res : res.messages || [];
      const hasMore = Array.isArray(res) ? false : Boolean(res.has_more);

      setMessages(msgs);
      setHasMoreMessages(hasMore);

      // Mark as read in local list
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, has_unread: false } : c))
      );
      setTimeout(() => scrollToBottom("auto"), 60);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  // Load Older Messages (Infinite scroll up)
  const loadOlderMessages = async () => {
    if (!activeConversationId || loadingOlderMessages || !hasMoreMessages || messages.length === 0) return;

    const oldestMessage = messages[0];
    const container = messagesContainerRef.current;
    if (!container) return;

    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;

    setLoadingOlderMessages(true);
    try {
      const res = await api<any>(
        `/chat/conversations/${activeConversationId}/messages/?limit=30&before=${encodeURIComponent(
          oldestMessage.created_at
        )}`
      );
      const olderMsgs = Array.isArray(res) ? res : res.messages || [];
      const hasMore = Array.isArray(res) ? false : Boolean(res.has_more);

      if (olderMsgs.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => String(m.id)));
          const filteredNew = olderMsgs.filter((m: any) => !existingIds.has(String(m.id)));
          return [...filteredNew, ...prev];
        });
        setHasMoreMessages(hasMore);

        // Keep scroll anchor position stable so UI doesn't jump
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight;
            messagesContainerRef.current.scrollTop = newScrollHeight - previousScrollHeight + previousScrollTop;
          }
        });
      } else {
        setHasMoreMessages(false);
      }
    } catch (err: any) {
      console.error("Failed to load older messages", err);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const handleScrollMessages = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (container.scrollTop < 60 && hasMoreMessages && !loadingOlderMessages) {
      loadOlderMessages();
    }
  };

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId]);

  // Real-time Chat & Presence Socket listeners
  useEffect(() => {
    const socket = getGlobalSocket();
    if (!socket) return;

    if (activeConversationId) {
      socket.emit("chat:join-conversation", { conversationId: activeConversationId });
    }

    const handlePresence = (data: { onlineUserIds: string[] }) => {
      if (data?.onlineUserIds) setOnlineUserIds(data.onlineUserIds);
    };

    socket.emit("presence:get-online-users");
    socket.on("presence:update", handlePresence);
    socket.on("presence:online-users", handlePresence);

    const handleNewMessage = (data: { conversationId: string; message: ChatMessageItem }) => {
      if (data.conversationId === activeConversationId) {
        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(data.message.id))) return prev;
          return [...prev, data.message];
        });
        
        // Auto-scroll if user is near bottom or sent by current user
        const container = messagesContainerRef.current;
        if (container) {
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160;
          if (isNearBottom || data.message.is_self) {
            setTimeout(() => scrollToBottom("smooth"), 50);
          }
        } else {
          setTimeout(() => scrollToBottom("smooth"), 50);
        }
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === data.conversationId
            ? {
                ...c,
                last_message_text: data.message.text || "New media attached",
                last_message_at: data.message.created_at,
                last_message_sender_name: data.message.sender_name,
                has_unread: data.conversationId !== activeConversationId,
              }
            : c
        )
      );
    };

    const handleConversationUpdated = (data: { conversationId: string; lastMessage: any }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === data.conversationId
            ? {
                ...c,
                last_message_text: data.lastMessage?.text || "New message",
                last_message_at: data.lastMessage?.created_at || new Date().toISOString(),
                last_message_sender_name: data.lastMessage?.sender_name || "",
                has_unread: data.conversationId !== activeConversationId,
              }
            : c
        )
      );
    };

    socket.on("chat:new-message", handleNewMessage);
    socket.on("chat:conversation-updated", handleConversationUpdated);

    return () => {
      if (activeConversationId) {
        socket.emit("chat:leave-conversation", { conversationId: activeConversationId });
      }
      socket.off("presence:update", handlePresence);
      socket.off("presence:online-users", handlePresence);
      socket.off("chat:new-message", handleNewMessage);
      socket.off("chat:conversation-updated", handleConversationUpdated);
    };
  }, [activeConversationId]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.last_message_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.department?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchTab =
        activeTab === "ALL" ||
        (activeTab === "DIRECT" && c.type === "DIRECT") ||
        (activeTab === "GROUP" && (c.type === "GROUP" || c.type === "DEPARTMENT")) ||
        (activeTab === "CLIENT" && c.type === "CLIENT");

      return matchSearch && matchTab;
    });
  }, [conversations, searchQuery, activeTab]);

  // Handle Send Message
  const handleSendMessage = async (customPayload?: any) => {
    if (!activeConversationId) return;
    if (!customPayload && !inputText.trim()) return;

    setSending(true);
    try {
      const payload = customPayload || {
        text: inputText.trim(),
        message_type: "TEXT",
      };

      const res = await api<ChatMessageItem>(`/chat/conversations/${activeConversationId}/messages/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMessages((prev) => [...prev, res]);
      setInputText("");

      // Update conversation in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                last_message_text: res.text,
                last_message_at: res.created_at,
                last_message_sender_name: res.sender_name,
              }
            : c
        )
      );

      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Handle File / Media Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;

    const formData = new FormData();
    formData.append("file", file);

    const toastId = "uploading-chat-file";
    try {
      const uploaded = await api<any>("/chat/upload/", {
        method: "POST",
        body: formData,
      });

      let msgType: any = "FILE";
      if (uploaded.file_type === "image") msgType = "IMAGE";
      if (uploaded.file_type === "video") msgType = "VIDEO";

      await handleSendMessage({
        text: file.name,
        message_type: msgType,
        attachments: [
          {
            name: uploaded.name,
            url: uploaded.url,
            file_type: uploaded.file_type,
            file_size: uploaded.file_size,
          },
        ],
      });

      toast.success("Media attached successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Smart Embed: Task
  const handleEmbedTask = async (task: WorkAssignment) => {
    await handleSendMessage({
      task_id: task.id,
      message_type: "TASK_EMBED",
      text: `Linked Task: ${task.title}`,
    });
    setTaskPickerOpen(false);
    toast.success("Task embedded in conversation!");
  };

  // Handle Smart Embed: Client
  const handleEmbedClient = async (client: Client) => {
    await handleSendMessage({
      client_id: client.id,
      message_type: "CLIENT_EMBED",
      text: `Linked Client: ${client.name}`,
    });
    setClientPickerOpen(false);
    toast.success("Client account linked!");
  };

  // Handle Smart Embed: Standup Update
  const handleEmbedStandup = async (standupData: any) => {
    await handleSendMessage({
      standup_data: standupData,
      message_type: "STANDUP_UPDATE",
      text: `Daily Work Update (${standupData.date})`,
    });
    setStandupModalOpen(false);
    toast.success("Daily Work Update posted to channel!");
  };

  // Handle Instant Meeting Launch
  const handleLaunchMeeting = async () => {
    if (!activeConversation) return;
    const meetingCode = `FLUMENX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    await handleSendMessage({
      meeting_code: meetingCode,
      message_type: "MEETING_LINK",
      text: `Started instant meeting: ${meetingCode}`,
    });
    toast.success(`Meeting room link shared: ${meetingCode}`);
  };

  // Handle Pin / Unpin Message
  const handleTogglePin = async (messageId: string) => {
    if (!activeConversationId) return;
    try {
      const res = await api<any>(`/chat/conversations/${activeConversationId}/pin/${messageId}/`, {
        method: "POST",
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_pinned: res.is_pinned } : m))
      );
      toast.success(res.is_pinned ? "Message pinned to channel banner!" : "Message unpinned");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update pin");
    }
  };

  // Handle Create New Direct / Group Conversation
  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newChatMode === "DIRECT") {
      if (selectedUserIds.length === 0) return toast.error("Please select a colleague to chat with");
      try {
        const res = await api<ChatConversationItem>("/chat/conversations/direct/", {
          method: "POST",
          body: JSON.stringify({ target_user_id: selectedUserIds[0] }),
        });
        setConversations((prev) => [res, ...prev.filter((c) => c.id !== res.id)]);
        setActiveConversationId(res.id);
        setNewChatModalOpen(false);
        setSelectedUserIds([]);
        toast.success(`Direct message opened with ${res.name}`);
      } catch (err: any) {
        toast.error(err?.message || "Failed to start conversation");
      }
    } else {
      if (!newGroupName.trim()) return toast.error("Please enter a group name");
      try {
        const res = await api<ChatConversationItem>("/chat/conversations/group/", {
          method: "POST",
          body: JSON.stringify({
            name: newGroupName.trim(),
            type: newGroupType,
            department: newGroupDept,
            client_id: newGroupClient || undefined,
            participant_user_ids: selectedUserIds,
          }),
        });
        setConversations((prev) => [res, ...prev]);
        setActiveConversationId(res.id);
        setNewChatModalOpen(false);
        setNewGroupName("");
        setSelectedUserIds([]);
        toast.success(`Group "${res.name}" created successfully!`);
      } catch (err: any) {
        toast.error(err?.message || "Failed to create group");
      }
    }
  };

  // Handle Add Members to Group
  const handleAddMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || membersToAdd.length === 0) return;
    try {
      const res = await api<ChatConversationItem>(`/chat/conversations/${activeConversationId}/members/`, {
        method: "POST",
        body: JSON.stringify({ user_ids: membersToAdd }),
      });
      setConversations((prev) => prev.map((c) => (c.id === activeConversationId ? res : c)));
      setAddMemberModalOpen(false);
      setMembersToAdd([]);
      toast.success("Members added to group!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add members");
    }
  };

  // Handle Remove Member from Group
  const handleRemoveMember = async (userId: string | number) => {
    if (!activeConversationId) return;
    if (!confirm("Are you sure you want to remove this member from the group?")) return;
    try {
      const res = await api<ChatConversationItem>(`/chat/conversations/${activeConversationId}/members/${userId}/`, {
        method: "DELETE",
      });
      setConversations((prev) => prev.map((c) => (c.id === activeConversationId ? res : c)));
      toast.success("Member removed from group");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove member");
    }
  };

  // Start 1-to-1 WebRTC Call
  const handleStartCall = (callType: "audio" | "video") => {
    if (!activeConversation) return;
    const targetUserId =
      activeConversation.other_participant?.id ||
      (activeConversation.other_participant as any)?.user_id ||
      activeConversation.participants?.find((p: any) => String(p.user_id || p.user) !== String(activeConversation.created_by))?.user_id;

    if (!targetUserId) {
      toast.error("Please select a direct 1-to-1 colleague chat to start a call.");
      return;
    }
    startCall({
      toUserId: String(targetUserId),
      partnerName: activeConversation.name,
      partnerAvatar: activeConversation.avatar,
      callType,
      conversationId: activeConversation.id,
    });
  };

  // Top Pinned Message
  const topPinnedMessage = useMemo(() => {
    return messages.find((m) => m.is_pinned);
  }, [messages]);

  return (
    <Shell role={role}>
      <div className={activeConversationId ? "chat-header-mobile-hidden" : ""}>
        <PageHeader
          title="Team Chat & Collaboration Hub"
          subtitle="1-to-1 direct messaging, group channels, direct calls, and smart FLUMENX task/client embeds"
          action={
            <div className="chat-top-actions-wrapper" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                  padding: "8px 14px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  background: "var(--color-primary-subtle, #E7F3EE)",
                  border: "1.5px solid var(--color-brand-border, #B2D8CB)",
                  color: "var(--color-primary, #087A5B)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <UserPlus size={15} />
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
                  padding: "8px 14px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #087A5B 0%, #066348 100%)",
                  border: "1.5px solid #066348",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: "0 2px 8px rgba(8, 122, 91, 0.25)",
                }}
              >
                <Plus size={15} />
                <span>Create Group</span>
              </button>
            </div>
          }
        />
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
          height: "calc(100vh - 200px)",
          minHeight: "650px",
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
              <Search size={15} style={{ position: "absolute", left: "12px", top: "10px", color: "var(--color-text-muted, #718096)" }} />
              <input
                type="text"
                placeholder="Search chats, groups, colleagues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: "100%", paddingLeft: "34px", fontSize: "13px", height: "36px", background: "var(--panel, #ffffff)", border: "1px solid var(--border2, #CBD5E1)", color: "var(--color-text, #18231F)" }}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "2px" }}>
              {(["ALL", "DIRECT", "GROUP", "CLIENT"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "4px 10px",
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
                  style={{ display: "block", margin: "10px auto 0", background: "#E7F5EE", border: "1px solid #B2D8CB", color: "var(--color-primary, #087A5B)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
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
                  padding: "10px 14px",
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
                  minHeight: "56px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
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
                        borderRadius: "8px",
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
                    }}
                    title="Start Voice Call"
                  >
                    <Phone size={14} />
                    <span className="chat-header-btn-text">Call</span>
                  </button>

                  <button
                    onClick={() => handleStartCall("video")}
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
                    }}
                    title="Start Video Call"
                  >
                    <Video size={14} />
                    <span className="chat-header-btn-text">Video</span>
                  </button>

                  <button
                    onClick={handleLaunchMeeting}
                    style={{
                      padding: "6px 10px",
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
                    }}
                    title="Share instant FLUMENX meeting room in chat"
                  >
                    <Calendar size={14} />
                    <span className="chat-header-btn-text">Meeting</span>
                  </button>

                  <button
                    onClick={() => setShowInfoDrawer((prev) => !prev)}
                    style={{
                      padding: "6px 9px",
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
                        background: "var(--panel2, #F8FAF9)",
                        border: "1px solid var(--border, #DCE3E0)",
                        borderRadius: "16px",
                        padding: "3px 12px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--color-primary, #087A5B)",
                        cursor: "pointer",
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
                    const isSelf = msg.is_self;

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
                            background: isSelf ? "var(--color-primary, #087A5B)" : "var(--panel, #ffffff)",
                            border: isSelf ? "1px solid var(--color-primary-hover, #066348)" : "1px solid var(--border, #DCE3E0)",
                            color: isSelf ? "#ffffff" : "var(--color-text, #18231F)",
                            position: "relative",
                            boxShadow: isSelf ? "0 2px 6px rgba(8, 122, 91, 0.18)" : "0 1px 3px rgba(24,35,31,0.05)",
                          }}
                        >
                          {/* Pin Icon badge */}
                          {msg.is_pinned && (
                            <span style={{ position: "absolute", top: "-8px", right: "-8px", background: "#f59e0b", color: "#000", padding: "2px 6px", borderRadius: "10px", fontSize: "9px", fontWeight: 800, display: "flex", alignItems: "center", gap: "2px" }}>
                              <Pin size={10} /> PINNED
                            </span>
                          )}

                          {/* 1. TEXT MESSAGE */}
                          {msg.message_type === "TEXT" && (
                            <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", wordBreak: "break-word" }}>
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
                                controls
                                src={resolveChatMediaUrl(msg.attachments[0].url)}
                                onClick={() =>
                                  setPreviewMedia({
                                    src: resolveChatMediaUrl(msg.attachments![0].url),
                                    alt: msg.attachments![0].name,
                                    isVideo: true,
                                  })
                                }
                                style={{ maxWidth: "100%", width: "300px", maxHeight: "200px", borderRadius: "10px", cursor: "pointer" }}
                              />
                              <span style={{ fontSize: "11px", opacity: 0.8 }}>{msg.attachments[0].name}</span>
                            </div>
                          )}

                          {/* 4. FILE ATTACHMENT */}
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
                                textDecoration: "none",
                                color: isSelf ? "#fff" : "var(--color-text, #18231F)",
                                border: isSelf ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--border, #DCE3E0)",
                              }}
                            >
                              <FileText size={20} color={isSelf ? "#fff" : "#2563EB"} />
                              <div style={{ minWidth: 0 }}>
                                <b style={{ fontSize: "12px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {msg.attachments[0].name}
                                </b>
                                <span style={{ fontSize: "10px", opacity: 0.7 }}>Click to open / download</span>
                              </div>
                            </a>
                          )}

                          {/* 5. SMART TASK EMBED CARD */}
                          {msg.message_type === "TASK_EMBED" && msg.task_embed && (
                            <div
                              style={{
                                padding: "12px",
                                background: isSelf ? "rgba(0,0,0,0.15)" : "var(--panel2, #F8FAF9)",
                                border: isSelf ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--border, #DCE3E0)",
                                borderRadius: "10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                                minWidth: "260px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "10px", fontWeight: 800, color: isSelf ? "#fff" : "var(--color-primary, #087A5B)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <ListTodo size={12} /> FLUMENX TASK EMBED
                                </span>
                                <Badge tone={msg.task_embed.priority === "Urgent" ? "danger" : "neutral"}>
                                  {msg.task_embed.priority}
                                </Badge>
                              </div>

                              <b style={{ fontSize: "14px", color: isSelf ? "#fff" : "var(--color-text, #18231F)" }}>{msg.task_embed.title}</b>

                              <div style={{ fontSize: "11px", color: isSelf ? "rgba(255,255,255,0.85)" : "var(--color-text-muted, #718096)", display: "flex", justifyContent: "space-between" }}>
                                <span>Assignee: <b>{msg.task_embed.employeeName}</b></span>
                                <span>Status: <b style={{ color: isSelf ? "#fff" : "#16855B" }}>{msg.task_embed.status}</b></span>
                              </div>

                              {/* Progress bar */}
                              <div style={{ width: "100%", height: "6px", background: isSelf ? "rgba(255,255,255,0.25)" : "#DCE3E0", borderRadius: "4px", overflow: "hidden" }}>
                                <div
                                  style={{
                                    width: `${Math.min(100, Math.round(((msg.task_embed.completedQuantity || 0) / (msg.task_embed.assignedQuantity || 1)) * 100))}%`,
                                    height: "100%",
                                    background: isSelf ? "#fff" : "#087A5B",
                                  }}
                                />
                              </div>

                              <a
                                href={`/clients/tasks`}
                                style={{
                                  padding: "5px 10px",
                                  background: isSelf ? "rgba(255,255,255,0.15)" : "#E7F5EE",
                                  border: isSelf ? "1px solid rgba(255,255,255,0.25)" : "1px solid #B2D8CB",
                                  borderRadius: "6px",
                                  textAlign: "center",
                                  fontSize: "11px",
                                  color: isSelf ? "#fff" : "#087A5B",
                                  textDecoration: "none",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "4px",
                                }}
                              >
                                View Task Details <ExternalLink size={11} />
                              </a>
                            </div>
                          )}

                          {/* 6. SMART CLIENT EMBED CARD */}
                          {msg.message_type === "CLIENT_EMBED" && msg.client_embed && (
                            <div
                              style={{
                                padding: "12px",
                                background: isSelf ? "rgba(0,0,0,0.15)" : "var(--panel2, #F8FAF9)",
                                border: isSelf ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--border, #DCE3E0)",
                                borderRadius: "10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                minWidth: "240px",
                              }}
                            >
                              <span style={{ fontSize: "10px", fontWeight: 800, color: isSelf ? "#fff" : "var(--color-primary, #087A5B)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Briefcase size={12} /> CLIENT ACCOUNT LINK
                              </span>
                              <b style={{ fontSize: "14px", color: isSelf ? "#fff" : "var(--color-text, #18231F)" }}>{msg.client_embed.name}</b>
                              <span style={{ fontSize: "11px", color: isSelf ? "rgba(255,255,255,0.8)" : "var(--color-text-muted, #718096)" }}>
                                Industry: {msg.client_embed.industry} • Contact: {msg.client_embed.contactPerson || "Primary Lead"}
                              </span>
                              <a
                                href={`/clients/tasks`}
                                style={{
                                  padding: "5px 10px",
                                  background: isSelf ? "rgba(255,255,255,0.15)" : "var(--color-primary-subtle, #E7F3EE)",
                                  border: isSelf ? "1px solid rgba(255,255,255,0.25)" : "1px solid var(--color-brand-border, #B2D8CB)",
                                  borderRadius: "6px",
                                  textAlign: "center",
                                  fontSize: "11px",
                                  color: isSelf ? "#fff" : "var(--color-primary, #087A5B)",
                                  textDecoration: "none",
                                  fontWeight: 700,
                                }}
                              >
                                View Client Deliverables →
                              </a>
                            </div>
                          )}

                          {/* 7. SMART DAILY STANDUP CARD */}
                          {msg.message_type === "STANDUP_UPDATE" && msg.standup_data && (
                            <div
                              style={{
                                padding: "14px",
                                background: isSelf ? "rgba(0,0,0,0.15)" : "var(--panel2, #F8FAF9)",
                                border: isSelf ? "1px solid rgba(255,255,255,0.2)" : "1px solid #B2D8CB",
                                borderRadius: "12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                minWidth: "280px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: isSelf ? "1px solid rgba(255,255,255,0.15)" : "1px solid var(--border, #DCE3E0)", paddingBottom: "6px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 800, color: isSelf ? "#fff" : "#087A5B", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <Sparkles size={13} /> DAILY WORK STANDUP
                                </span>
                                <span style={{ fontSize: "11px", color: isSelf ? "rgba(255,255,255,0.8)" : "var(--color-text-muted, #718096)" }}>{msg.standup_data.date}</span>
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

                          {/* Timestamp & Pin Quick Action */}
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                            <button
                              onClick={() => handleTogglePin(msg.id)}
                              style={{ background: "transparent", border: 0, color: isSelf ? "rgba(255,255,255,0.6)" : "var(--color-text-muted, #718096)", cursor: "pointer", padding: "2px" }}
                              title={msg.is_pinned ? "Unpin message" : "Pin message"}
                            >
                              <Pin size={11} />
                            </button>
                            <span style={{ fontSize: "10px", opacity: isSelf ? 0.8 : 0.65, color: isSelf ? "#fff" : "var(--color-text-muted, #718096)" }}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
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
                  padding: "10px 14px",
                  borderTop: "1px solid var(--border, #DCE3E0)",
                  background: "var(--panel, #ffffff)",
                  position: "sticky",
                  bottom: 0,
                  zIndex: 40,
                  flexShrink: 0,
                }}
              >
                {/* Smart Action Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", overflowX: "auto", paddingBottom: "2px", WebkitOverflowScrolling: "touch" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      background: "var(--panel2, #F8FAF9)",
                      border: "1px solid var(--border, #DCE3E0)",
                      borderRadius: "8px",
                      color: "var(--color-text, #18231F)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    title="Attach Image / Video / File"
                  >
                    <Paperclip size={14} />
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
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      background: "var(--panel2, #F8FAF9)",
                      border: "1px solid var(--border, #DCE3E0)",
                      borderRadius: "8px",
                      color: "var(--color-text, #18231F)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    title="Link and embed an active task"
                  >
                    <ListTodo size={14} />
                    <span className="chat-action-btn-text">Link Task</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientPickerOpen(true)}
                    style={{
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      background: "var(--panel2, #F8FAF9)",
                      border: "1px solid var(--border, #DCE3E0)",
                      borderRadius: "8px",
                      color: "var(--color-text, #18231F)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    title="Link and embed a client account"
                  >
                    <Briefcase size={14} />
                    <span className="chat-action-btn-text">Link Client</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStandupModalOpen(true)}
                    style={{
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      background: "var(--color-primary-subtle, #E7F3EE)",
                      border: "1px solid var(--color-brand-border, #B2D8CB)",
                      borderRadius: "8px",
                      color: "var(--color-primary, #087A5B)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    title="1-Click Daily Standup Work Update"
                  >
                    <Sparkles size={14} />
                    <span className="chat-action-btn-text">Daily Standup</span>
                  </button>
                </div>

                {/* Textarea + Send */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <input
                    type="text"
                    className="input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Type message to ${activeConversation.name}...`}
                    style={{ flex: 1, height: "42px", fontSize: "13px", background: "var(--panel2, #F8FAF9)", border: "1px solid var(--border2, #CBD5E1)", color: "var(--color-text, #18231F)" }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !inputText.trim()}
                    className="btn btn-primary"
                    style={{ height: "42px", padding: "0 18px", background: "var(--color-primary, #087A5B)", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Send size={15} />
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
                    borderRadius: "12px",
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
                  {(activeConversation.participants || []).map((p) => (
                    <div
                      key={p.user_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        background: "var(--panel, #ffffff)",
                        border: "1px solid var(--border, #DCE3E0)",
                        borderRadius: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <Avatar name={p.name} avatar={p.avatar} size={24} />
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text, #18231F)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--color-text-muted, #718096)" }}>
                            {p.role === "ADMIN" ? "Admin" : "Member"}
                          </span>
                        </div>
                      </div>

                      {activeConversation.is_admin && p.user_id !== (activeConversation as any).current_user_id && (
                        <button
                          onClick={() => handleRemoveMember(p.user_id)}
                          style={{ background: "transparent", border: 0, color: "#DC2626", cursor: "pointer", padding: "4px" }}
                          title="Remove member"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
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
                    className="input"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Video Production Hub or Expo Masters"
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text, #18231F)", display: "block", marginBottom: "6px" }}>
                      Group Type
                    </label>
                    <select
                      className="input"
                      value={newGroupType}
                      onChange={(e: any) => setNewGroupType(e.target.value)}
                      style={{ width: "100%" }}
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
                      className="input"
                      value={newGroupDept}
                      onChange={(e) => setNewGroupDept(e.target.value)}
                      placeholder="e.g. Editing"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* User Selector */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text, #18231F)", display: "block", marginBottom: "6px" }}>
                {newChatMode === "DIRECT" ? "Select Colleague *" : "Add Members to Group"}
              </label>
              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {usersList.map((u) => {
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
            <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
              {usersList.map((u) => {
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
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: isSelected ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.03)",
                      border: isSelected ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Avatar name={u.name} avatar={u.avatar} size={26} />
                      <b style={{ fontSize: "12px" }}>{u.name} ({u.department})</b>
                    </div>
                    {isSelected && <Check size={14} color="#10b981" />}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAddMemberModalOpen(false)}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
            {tasksList.map((t) => (
              <div
                key={t.id}
                onClick={() => handleEmbedTask(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                <div>
                  <b style={{ fontSize: "13px", color: "#fff", display: "block" }}>{t.title}</b>
                  <span style={{ fontSize: "11px", color: "var(--muted, #888)" }}>
                    Assignee: {t.employee_name || "Team Member"} • Client: {t.client_name || "General"}
                  </span>
                </div>
                <Badge tone={t.priority === "Urgent" ? "danger" : "info"}>{t.priority}</Badge>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: CLIENT PICKER EMBED MODAL */}
      {/* ========================================================= */}
      {clientPickerOpen && (
        <Modal onClose={() => setClientPickerOpen(false)} title="Select Client Account to Link">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
            {clientsList.map((c) => (
              <div
                key={c.id}
                onClick={() => handleEmbedClient(c)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                <div>
                  <b style={{ fontSize: "13px", color: "#fff", display: "block" }}>{c.name}</b>
                  <span style={{ fontSize: "11px", color: "var(--muted, #888)" }}>
                    {c.industry || "General"} • {c.contactPerson?.name ? `Contact: ${c.contactPerson.name}` : ""}
                  </span>
                </div>
                <Badge tone="gold">Client</Badge>
              </div>
            ))}
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
      {/* MODAL 6: 1-TO-1 AUDIO/VIDEO CALL MODAL */}
      {/* ========================================================= */}
      {activeCall && (
        <DirectCallModal
          mode={activeCall.mode}
          callType={activeCall.callType}
          partnerName={activeCall.partnerName}
          partnerAvatar={activeCall.partnerAvatar}
          onAccept={acceptCall}
          onDecline={endCall}
          onEndCall={endCall}
          localStream={localStream}
          remoteStream={remoteStream}
        />
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
