"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
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

type Props = {
  role?: WorkspaceRole;
};

export function ChatHubPage({ role = "admin" }: Props) {
  const [conversations, setConversations] = useState<ChatConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

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

  // Calling state
  const [callState, setCallState] = useState<{
    active: boolean;
    mode: "incoming" | "outgoing" | "connected";
    callType: "audio" | "video";
    partnerName: string;
    partnerAvatar?: string;
  } | null>(null);

  // Lightbox Media Preview
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      if (convList.length > 0 && !activeConversationId) {
        setActiveConversationId(convList[0].id);
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

  // Load Messages for Active Conversation
  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const msgs = await api<ChatMessageItem[]>(`/chat/conversations/${conversationId}/messages/`);
      setMessages(Array.isArray(msgs) ? msgs : []);
      // Mark as read in local list
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, has_unread: false } : c))
      );
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
      text: `📌 Linked Task: ${task.title}`,
    });
    setTaskPickerOpen(false);
    toast.success("Task embedded in conversation!");
  };

  // Handle Smart Embed: Client
  const handleEmbedClient = async (client: Client) => {
    await handleSendMessage({
      client_id: client.id,
      message_type: "CLIENT_EMBED",
      text: `🏢 Linked Client: ${client.name}`,
    });
    setClientPickerOpen(false);
    toast.success("Client account linked!");
  };

  // Handle Smart Embed: Standup Update
  const handleEmbedStandup = async (standupData: any) => {
    await handleSendMessage({
      standup_data: standupData,
      message_type: "STANDUP_UPDATE",
      text: `⚡ Daily Work Update (${standupData.date})`,
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
      text: `📅 Started instant meeting: ${meetingCode}`,
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
    setCallState({
      active: true,
      mode: "outgoing",
      callType,
      partnerName: activeConversation.name,
      partnerAvatar: activeConversation.avatar,
    });
  };

  // Top Pinned Message
  const topPinnedMessage = useMemo(() => {
    return messages.find((m) => m.is_pinned);
  }, [messages]);

  return (
    <Shell role={role}>
      <PageHeader
        title="Team Chat & Collaboration Hub"
        subtitle="1-to-1 direct messaging, group channels, direct calls, and smart FLUMENX task/client embeds"
        action={
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => {
                setNewChatMode("DIRECT");
                setNewChatModalOpen(true);
              }}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <UserPlus size={16} /> New DM
            </button>
            <PrimaryButton
              onClick={() => {
                setNewChatMode("GROUP");
                setNewChatModalOpen(true);
              }}
            >
              <Plus size={16} /> Create Group / Channel
            </PrimaryButton>
          </div>
        }
      />

      {/* MAIN CHAT CONTAINER */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showInfoDrawer ? "300px 1fr 280px" : "320px 1fr",
          background: "var(--panel, #18181b)",
          border: "1px solid var(--border, #27272a)",
          borderRadius: "16px",
          overflow: "hidden",
          height: "calc(100vh - 200px)",
          minHeight: "650px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          position: "relative",
        }}
      >
        {/* ========================================================= */}
        {/* LEFT COLUMN: CONVERSATION LIST */}
        {/* ========================================================= */}
        <div
          style={{
            borderRight: "1px solid var(--border, #27272a)",
            display: "flex",
            flexDirection: "column",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          {/* Search Header */}
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border, #27272a)", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "10px", color: "var(--muted, #888)" }} />
              <input
                type="text"
                placeholder="Search chats, groups, colleagues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: "100%", paddingLeft: "34px", fontSize: "13px", height: "36px" }}
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
                    border: 0,
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: activeTab === tab ? "var(--accent, #10b981)" : "rgba(255,255,255,0.06)",
                    color: activeTab === tab ? "#000" : "var(--text, #fff)",
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
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {loadingConversations ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--muted, #888)", fontSize: "13px" }}>
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted, #888)", fontSize: "13px" }}>
                No conversations found.
                <button
                  onClick={() => setNewChatModalOpen(true)}
                  style={{ display: "block", margin: "10px auto 0", background: "transparent", border: "1px dashed var(--accent, #10b981)", color: "var(--accent, #10b981)", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}
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
                      background: isActive ? "rgba(16, 185, 129, 0.15)" : "transparent",
                      border: isActive ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {/* Avatar with Status indicator */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: isGroup ? "10px" : "50%",
                          background: isGroup ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" : "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "#fff",
                        }}
                      >
                        {isGroup ? <Users size={18} /> : conv.name.charAt(0).toUpperCase()}
                      </div>
                      {conv.has_unread && (
                        <span
                          style={{
                            position: "absolute",
                            top: "-2px",
                            right: "-2px",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "#ef4444",
                            border: "2px solid #18181b",
                          }}
                        />
                      )}
                    </div>

                    {/* Text Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <b style={{ fontSize: "13px", color: isActive ? "#fff" : "var(--text, #fff)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {conv.name}
                        </b>
                        <span style={{ fontSize: "10px", color: "var(--muted, #888)", flexShrink: 0 }}>
                          {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: conv.has_unread ? "#10b981" : "var(--muted, #888)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: conv.has_unread ? 700 : 400 }}>
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
        <div style={{ display: "flex", flexDirection: "column", background: "var(--panel, #18181b)", position: "relative" }}>
          {activeConversation ? (
            <>
              {/* Active Conversation Top Bar */}
              <div
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--border, #27272a)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(0,0,0,0.15)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: activeConversation.type !== "DIRECT" ? "8px" : "50%",
                      background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                      color: "#fff",
                      fontSize: "14px",
                    }}
                  >
                    {activeConversation.type !== "DIRECT" ? <Users size={18} /> : activeConversation.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                      {activeConversation.name}
                      {activeConversation.department && <Badge tone="info">{activeConversation.department}</Badge>}
                      {activeConversation.client_name && <Badge tone="gold">{activeConversation.client_name}</Badge>}
                    </h3>
                    <span style={{ fontSize: "11px", color: "var(--muted, #888)" }}>
                      {activeConversation.type === "DIRECT"
                        ? activeConversation.other_participant?.role || "Active Member"
                        : `${activeConversation.participants?.length || 0} group participants`}
                    </span>
                  </div>
                </div>

                {/* Header Call & Meeting Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={() => handleStartCall("audio")}
                    className="btn btn-secondary"
                    style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                    title="Start Voice Call"
                  >
                    <Phone size={14} /> Call
                  </button>

                  <button
                    onClick={() => handleStartCall("video")}
                    className="btn btn-secondary"
                    style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                    title="Start Video Call"
                  >
                    <Video size={14} /> Video
                  </button>

                  <button
                    onClick={handleLaunchMeeting}
                    className="btn btn-secondary"
                    style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
                    title="Share instant FLUMENX meeting room in chat"
                  >
                    <Calendar size={14} /> Launch Meeting
                  </button>

                  <button
                    onClick={() => setShowInfoDrawer((prev) => !prev)}
                    className="btn btn-secondary"
                    style={{ padding: "7px 9px" }}
                    title="Toggle Group Information"
                  >
                    <Info size={16} />
                  </button>
                </div>
              </div>

              {/* PINNED MESSAGE BANNER */}
              {topPinnedMessage && (
                <div
                  style={{
                    padding: "8px 16px",
                    background: "rgba(245, 158, 11, 0.1)",
                    borderBottom: "1px solid rgba(245, 158, 11, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f59e0b" }}>
                    <Pin size={14} />
                    <b style={{ color: "#fff" }}>Pinned:</b>
                    <span style={{ color: "#e2e8f0", maxWidth: "450px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {topPinnedMessage.text}
                    </span>
                  </div>
                  <button
                    onClick={() => handleTogglePin(topPinnedMessage.id)}
                    style={{ background: "transparent", border: 0, color: "var(--muted, #888)", cursor: "pointer", fontSize: "11px" }}
                    title="Unpin Message"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* MESSAGE THREAD FEED */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {loadingMessages ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--muted, #888)", fontSize: "13px" }}>
                    Loading conversation history...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted, #888)" }}>
                    <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                      <MessageSquare size={24} />
                    </div>
                    <b style={{ fontSize: "14px", color: "#fff", display: "block" }}>No messages yet</b>
                    <span style={{ fontSize: "12px" }}>Send a message or use the smart action buttons below to embed tasks or daily updates.</span>
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
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent, #10b981)", marginBottom: "3px", marginLeft: "4px" }}>
                            {msg.sender_name} {msg.sender_role && `(${msg.sender_role})`}
                          </span>
                        )}

                        {/* Bubble Container */}
                        <div
                          style={{
                            maxWidth: "75%",
                            padding: "10px 14px",
                            borderRadius: isSelf ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                            background: isSelf ? "linear-gradient(135deg, #059669 0%, #047857 100%)" : "rgba(255,255,255,0.06)",
                            border: isSelf ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255,255,255,0.08)",
                            color: "#fff",
                            position: "relative",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
                                src={msg.attachments[0].url}
                                alt={msg.attachments[0].name}
                                onClick={() => setPreviewMediaUrl(msg.attachments![0].url)}
                                style={{ maxWidth: "280px", maxHeight: "220px", borderRadius: "8px", objectFit: "cover", cursor: "zoom-in" }}
                              />
                              <span style={{ fontSize: "11px", opacity: 0.8 }}>{msg.attachments[0].name}</span>
                            </div>
                          )}

                          {/* 3. VIDEO MESSAGE */}
                          {msg.message_type === "VIDEO" && msg.attachments?.[0] && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <video
                                controls
                                src={msg.attachments[0].url}
                                style={{ maxWidth: "300px", maxHeight: "200px", borderRadius: "8px" }}
                              />
                              <span style={{ fontSize: "11px", opacity: 0.8 }}>{msg.attachments[0].name}</span>
                            </div>
                          )}

                          {/* 4. FILE ATTACHMENT */}
                          {msg.message_type === "FILE" && msg.attachments?.[0] && (
                            <a
                              href={msg.attachments[0].url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "8px 12px",
                                background: "rgba(0,0,0,0.25)",
                                borderRadius: "8px",
                                textDecoration: "none",
                                color: "#fff",
                              }}
                            >
                              <FileText size={20} color="#38bdf8" />
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
                                background: "rgba(0,0,0,0.35)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: "10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                                minWidth: "260px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "10px", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <ListTodo size={12} /> FLUMENX TASK EMBED
                                </span>
                                <Badge tone={msg.task_embed.priority === "Urgent" ? "danger" : "info"}>
                                  {msg.task_embed.priority}
                                </Badge>
                              </div>

                              <b style={{ fontSize: "14px", color: "#fff" }}>{msg.task_embed.title}</b>

                              <div style={{ fontSize: "11px", color: "var(--muted, #bbb)", display: "flex", justifyContent: "space-between" }}>
                                <span>Assignee: <b>{msg.task_embed.employeeName}</b></span>
                                <span>Status: <b style={{ color: "#34d399" }}>{msg.task_embed.status}</b></span>
                              </div>

                              {/* Progress bar */}
                              <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                                <div
                                  style={{
                                    width: `${Math.min(100, Math.round(((msg.task_embed.completedQuantity || 0) / (msg.task_embed.assignedQuantity || 1)) * 100))}%`,
                                    height: "100%",
                                    background: "#10b981",
                                  }}
                                />
                              </div>

                              <a
                                href={`/clients/tasks`}
                                style={{
                                  padding: "5px 10px",
                                  background: "rgba(255,255,255,0.08)",
                                  borderRadius: "6px",
                                  textAlign: "center",
                                  fontSize: "11px",
                                  color: "#fff",
                                  textDecoration: "none",
                                  fontWeight: 600,
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
                                background: "rgba(0,0,0,0.35)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: "10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                minWidth: "240px",
                              }}
                            >
                              <span style={{ fontSize: "10px", fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Briefcase size={12} /> CLIENT ACCOUNT LINK
                              </span>
                              <b style={{ fontSize: "14px", color: "#fff" }}>{msg.client_embed.name}</b>
                              <span style={{ fontSize: "11px", color: "var(--muted, #bbb)" }}>
                                Industry: {msg.client_embed.industry} • Contact: {msg.client_embed.contactPerson || "Primary Lead"}
                              </span>
                              <a
                                href={`/clients/tasks`}
                                style={{
                                  padding: "5px 10px",
                                  background: "rgba(255,255,255,0.08)",
                                  borderRadius: "6px",
                                  textAlign: "center",
                                  fontSize: "11px",
                                  color: "#fff",
                                  textDecoration: "none",
                                  fontWeight: 600,
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
                                background: "rgba(0,0,0,0.4)",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                borderRadius: "12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                minWidth: "280px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "6px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 800, color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <Sparkles size={13} /> DAILY WORK STANDUP
                                </span>
                                <span style={{ fontSize: "11px", color: "var(--muted, #aaa)" }}>{msg.standup_data.date}</span>
                              </div>

                              {/* Completed */}
                              {msg.standup_data.completedTasks?.length > 0 && (
                                <div>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <CheckCircle2 size={12} /> Completed Today:
                                  </span>
                                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "12px" }}>
                                    {msg.standup_data.completedTasks.map((t: string, i: number) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* In Progress */}
                              {msg.standup_data.inProgressTasks?.length > 0 && (
                                <div>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Clock size={12} /> In Progress / Next:
                                  </span>
                                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "12px" }}>
                                    {msg.standup_data.inProgressTasks.map((t: string, i: number) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Blockers */}
                              {msg.standup_data.blockers?.length > 0 && (
                                <div>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b" }}>
                                    ⚠️ Blockers / Remarks:
                                  </span>
                                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "12px" }}>
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
                                background: "rgba(56, 189, 248, 0.15)",
                                border: "1px solid rgba(56, 189, 248, 0.3)",
                                borderRadius: "10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                minWidth: "240px",
                              }}
                            >
                              <span style={{ fontSize: "11px", fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Calendar size={13} /> FLUMENX HQ MEETING ROOM
                              </span>
                              <b style={{ fontSize: "14px", color: "#fff" }}>Code: {msg.meeting_code}</b>
                              <a
                                href={`/meetings/${msg.meeting_code}`}
                                style={{
                                  padding: "6px 12px",
                                  background: "#0284c7",
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
                              style={{ background: "transparent", border: 0, color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "2px" }}
                              title={msg.is_pinned ? "Unpin message" : "Pin message"}
                            >
                              <Pin size={11} />
                            </button>
                            <span style={{ fontSize: "10px", opacity: 0.65 }}>
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
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border, #27272a)", background: "rgba(0,0,0,0.25)" }}>
                {/* Smart Action Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", overflowX: "auto" }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-secondary"
                    style={{ padding: "4px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                    title="Attach Image / Video / File"
                  >
                    <Paperclip size={13} /> Attach File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />

                  <button
                    onClick={() => setTaskPickerOpen(true)}
                    className="btn btn-secondary"
                    style={{ padding: "4px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
                    title="Link and embed an active task"
                  >
                    <ListTodo size={13} /> @Link Task
                  </button>

                  <button
                    onClick={() => setClientPickerOpen(true)}
                    className="btn btn-secondary"
                    style={{ padding: "4px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", borderColor: "rgba(245, 158, 11, 0.4)", color: "#f59e0b" }}
                    title="Link and embed a client account"
                  >
                    <Briefcase size={13} /> @Link Client
                  </button>

                  <button
                    onClick={() => setStandupModalOpen(true)}
                    className="btn btn-secondary"
                    style={{ padding: "4px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", borderColor: "rgba(16, 185, 129, 0.4)", color: "#10b981" }}
                    title="1-Click Daily Standup Work Update"
                  >
                    <Sparkles size={13} /> ⚡ Daily Standup
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
                    style={{ flex: 1, height: "42px", fontSize: "13px" }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !inputText.trim()}
                    className="btn btn-primary"
                    style={{ height: "42px", padding: "0 18px", background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted, #888)" }}>
              Select a conversation to start messaging.
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: COLLAPSIBLE GROUP INFO DRAWER */}
        {/* ========================================================= */}
        {showInfoDrawer && activeConversation && (
          <div
            style={{
              borderLeft: "1px solid var(--border, #27272a)",
              background: "rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              padding: "16px",
              overflowY: "auto",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: "14px", color: "#fff" }}>Group Info</b>
              <button
                onClick={() => setShowInfoDrawer(false)}
                style={{ background: "transparent", border: 0, color: "var(--muted, #888)", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Avatar & Title */}
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: activeConversation.type !== "DIRECT" ? "12px" : "50%",
                  background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#fff",
                  margin: "0 auto 8px",
                }}
              >
                {activeConversation.type !== "DIRECT" ? <Users size={24} /> : activeConversation.name.charAt(0).toUpperCase()}
              </div>
              <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 4px", color: "#fff" }}>
                {activeConversation.name}
              </h4>
              <span style={{ fontSize: "11px", color: "var(--muted, #888)" }}>
                {activeConversation.description || "Official collaboration channel"}
              </span>
            </div>

            {/* Members Section */}
            {activeConversation.type !== "DIRECT" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Members ({activeConversation.participants?.length || 0})
                  </span>
                  {activeConversation.is_admin && (
                    <button
                      onClick={() => setAddMemberModalOpen(true)}
                      style={{ background: "transparent", border: 0, color: "var(--accent, #10b981)", cursor: "pointer", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "2px" }}
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
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#333", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700, color: "#fff" }}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: "12px", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {p.role === "ADMIN" && <Badge tone="gold">Admin</Badge>}
                        {activeConversation.is_admin && p.role !== "ADMIN" && (
                          <button
                            onClick={() => handleRemoveMember(p.user_id)}
                            style={{ background: "transparent", border: 0, color: "#ef4444", cursor: "pointer", padding: "2px" }}
                            title="Remove member"
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: NEW CHAT / GROUP MODAL */}
      {/* ========================================================= */}
      {newChatModalOpen && (
        <Modal onClose={() => setNewChatModalOpen(false)} title={newChatMode === "DIRECT" ? "Start Direct Message" : "Create Team Group / Channel"}>
          <form onSubmit={handleCreateConversation} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Mode Switcher */}
            <div style={{ display: "flex", gap: "10px", padding: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "10px" }}>
              <button
                type="button"
                onClick={() => setNewChatMode("DIRECT")}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "8px",
                  border: 0,
                  background: newChatMode === "DIRECT" ? "var(--accent, #10b981)" : "transparent",
                  color: newChatMode === "DIRECT" ? "#000" : "#fff",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                1:1 Direct Chat
              </button>
              <button
                type="button"
                onClick={() => setNewChatMode("GROUP")}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "8px",
                  border: 0,
                  background: newChatMode === "GROUP" ? "var(--accent, #10b981)" : "transparent",
                  color: newChatMode === "GROUP" ? "#000" : "#fff",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Group Channel
              </button>
            </div>

            {newChatMode === "GROUP" && (
              <>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted, #888)", display: "block", marginBottom: "6px" }}>
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
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted, #888)", display: "block", marginBottom: "6px" }}>
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
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted, #888)", display: "block", marginBottom: "6px" }}>
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
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted, #888)", display: "block", marginBottom: "6px" }}>
                {newChatMode === "DIRECT" ? "Select Colleague *" : "Add Members to Group"}
              </label>
              <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
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
                        background: isSelected ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.03)",
                        border: isSelected ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#333", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700, color: "#fff" }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <b style={{ fontSize: "12px", display: "block" }}>{u.name}</b>
                          <span style={{ fontSize: "10px", color: "var(--muted, #888)" }}>{u.department} • {u.portal_role}</span>
                        </div>
                      </div>
                      {isSelected && <Check size={14} color="#10b981" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setNewChatModalOpen(false)}>
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
                      <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#333", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700, color: "#fff" }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
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
      {callState && (
        <DirectCallModal
          mode={callState.mode}
          callType={callState.callType}
          partnerName={callState.partnerName}
          partnerAvatar={callState.partnerAvatar}
          onEndCall={() => setCallState(null)}
        />
      )}

      {/* ========================================================= */}
      {/* LIGHTBOX MEDIA PREVIEW */}
      {/* ========================================================= */}
      {previewMediaUrl && (
        <div
          onClick={() => setPreviewMediaUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 3000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            cursor: "zoom-out",
          }}
        >
          <img
            src={previewMediaUrl}
            alt="Preview"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "12px", objectFit: "contain" }}
          />
        </div>
      )}
    </Shell>
  );
}
