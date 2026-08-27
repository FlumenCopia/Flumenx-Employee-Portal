"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Users,
  PhoneOff,
  Copy,
  Check,
  ChevronUp,
  Settings,
  MoreVertical,
  Volume2,
  VolumeX,
  Sparkles,
  Shield,
  Clock,
  Calendar,
  Send,
  X,
  Maximize2,
  Minimize2,
  User as UserIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import type { AuthUser, Meeting, MeetingChatMessage } from "@/lib/types";

interface PeerConnection {
  socketId: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
  name: string;
  role: string;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function MeetingRoomPage({ meetingCode }: { meetingCode: string }) {
  const router = useRouter();

  // Meeting Metadata
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Lobby vs Active Room vs Ended state
  const [isInLobby, setIsInLobby] = useState(true);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Local Media Stream State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Device selectors
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("");

  // Remote Peers & Connections
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  // UI Drawers & Controls
  const [activeDrawer, setActiveDrawer] = useState<"none" | "chat" | "participants" | "settings">("none");
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [pinnedSocketId, setPinnedSocketId] = useState<string | null>(null);

  // DOM Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch meeting info & user session
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const [meetingData, userData] = await Promise.all([
          api<Meeting>(`/meetings/code/${meetingCode}/`),
          api<AuthUser>("/auth/me/").catch(() => null),
        ]);

        if (!active) return;
        setMeeting(meetingData);
        setUser(userData);

        if (meetingData.status === "ENDED") {
          setIsMeetingEnded(true);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Meeting not found or invalid link.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, [meetingCode]);

  // 2. Initialize Lobby Media Stream & Enumerate Devices
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupLobbyMedia() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputDevices(devices.filter((d) => d.kind === "audioinput"));
        setVideoInputDevices(devices.filter((d) => d.kind === "videoinput"));

        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        setLocalStream(stream);

        if (lobbyVideoRef.current) {
          lobbyVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Could not access camera/microphone:", err);
      }
    }

    if (isInLobby && !isMeetingEnded) {
      setupLobbyMedia();
    }

    return () => {
      // Do not stop stream if joining meeting
    };
  }, [isInLobby, isMeetingEnded]);

  // 3. Connect to WebRTC Socket.io Room upon clicking "Join"
  const handleJoinMeeting = useCallback(async () => {
    setIsInLobby(false);

    let activeStream = localStream;
    if (!activeStream) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: !isAudioMuted,
          video: !isVideoOff ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
        setLocalStream(activeStream);
      } catch (err) {
        console.warn("Joining with muted stream:", err);
      }
    }

    if (localVideoRef.current && activeStream) {
      localVideoRef.current.srcObject = activeStream;
    }

    // Determine Socket URL based on current host
    const token = typeof window !== "undefined" ? (localStorage.getItem("flumenx_access_token") || localStorage.getItem("access_token") || "") : "";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const host = window.location.hostname;
    const socketUrl = `${protocol}//${host}:8000`;

    const socket = io(socketUrl, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Join room
    socket.emit("join-meeting", {
      meetingCode,
      name: user?.employee?.name || user?.first_name || "Participant",
    });

    // Handle Join Success
    socket.on("joined-successfully", async (data: { meeting: any; self: any; peers: any[] }) => {
      // Connect to existing peers (initiator)
      for (const peer of data.peers) {
        createPeerConnection(peer.socketId, peer.name, peer.role, true, activeStream);
      }
    });

    // Handle New Peer Joined
    socket.on("peer-joined", (peer: { socketId: string; name: string; role: string }) => {
      createPeerConnection(peer.socketId, peer.name, peer.role, false, activeStream);
    });

    // WebRTC Signaling Handlers
    socket.on("signal-offer", async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      const peer = peersRef.current.get(data.from);
      if (peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        socket.emit("signal-answer", { to: data.from, answer });
      }
    });

    socket.on("signal-answer", async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      const peer = peersRef.current.get(data.from);
      if (peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socket.on("signal-ice-candidate", async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const peer = peersRef.current.get(data.from);
      if (peer && data.candidate) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("Error adding ice candidate:", err);
        }
      }
    });

    // Peer Media Status Toggles
    socket.on("peer-media-toggled", (data: { socketId: string; isAudioMuted: boolean; isVideoOff: boolean }) => {
      setPeers((prev) => {
        const next = new Map(prev);
        const p = next.get(data.socketId);
        if (p) {
          p.isAudioMuted = data.isAudioMuted;
          p.isVideoOff = data.isVideoOff;
          next.set(data.socketId, { ...p });
        }
        return next;
      });
    });

    socket.on("peer-screen-shared", (data: { socketId: string; name: string; isSharing: boolean }) => {
      setPeers((prev) => {
        const next = new Map(prev);
        const p = next.get(data.socketId);
        if (p) {
          p.isScreenSharing = data.isSharing;
          next.set(data.socketId, { ...p });
        }
        return next;
      });
      if (data.isSharing) {
        setPinnedSocketId(data.socketId);
      } else if (pinnedSocketId === data.socketId) {
        setPinnedSocketId(null);
      }
    });

    // In-Meeting Chat Messages
    socket.on("new-chat-message", (msg: MeetingChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (activeDrawer !== "chat") {
        setUnreadChatCount((c) => c + 1);
      }
    });

    // Host Muted You
    socket.on("host-muted-you", () => {
      toggleAudio(true);
    });

    // Meeting Ended by Host
    socket.on("meeting-ended-by-host", () => {
      cleanupMedia();
      setIsMeetingEnded(true);
    });

    // Peer Left
    socket.on("peer-left", (data: { socketId: string; name: string }) => {
      const peer = peersRef.current.get(data.socketId);
      if (peer) {
        peer.pc.close();
        peersRef.current.delete(data.socketId);
        setPeers(new Map(peersRef.current));
      }
      if (pinnedSocketId === data.socketId) {
        setPinnedSocketId(null);
      }
    });

    // Load Chat History
    api<MeetingChatMessage[]>(`/meetings/code/${meetingCode}/messages/`)
      .then((history) => setChatMessages(history))
      .catch(() => {});
  }, [localStream, isAudioMuted, isVideoOff, meetingCode, user, activeDrawer, pinnedSocketId]);

  // Helper: Create RTCPeerConnection
  function createPeerConnection(
    socketId: string,
    name: string,
    role: string,
    isInitiator: boolean,
    stream: MediaStream | null
  ) {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to peer connection
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    // ICE Candidate Exchange
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("signal-ice-candidate", {
          to: socketId,
          candidate: event.candidate,
        });
      }
    };

    // Remote Stream Received
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setPeers((prev) => {
        const next = new Map(prev);
        const p = next.get(socketId);
        if (p) {
          p.stream = remoteStream;
          next.set(socketId, { ...p });
        }
        return next;
      });
    };

    const peerObj: PeerConnection = {
      socketId,
      pc,
      name,
      role,
      isAudioMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
    };

    peersRef.current.set(socketId, peerObj);
    setPeers(new Map(peersRef.current));

    // If initiator, create and send Offer
    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (socketRef.current) {
            socketRef.current.emit("signal-offer", {
              to: socketId,
              offer: pc.localDescription,
            });
          }
        })
        .catch((err) => console.error("Error creating WebRTC offer:", err));
    }

    return pc;
  }

  // 4. Media Controls
  const toggleAudio = (forceMute?: boolean) => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      const nextState = forceMute !== undefined ? forceMute : !isAudioMuted;
      audioTrack.enabled = !nextState;
      setIsAudioMuted(nextState);

      if (socketRef.current) {
        socketRef.current.emit("toggle-media", {
          meetingCode,
          isAudioMuted: nextState,
          isVideoOff,
        });
      }
    }
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const nextState = !isVideoOff;
      videoTrack.enabled = !nextState;
      setIsVideoOff(nextState);

      if (socketRef.current) {
        socketRef.current.emit("toggle-media", {
          meetingCode,
          isAudioMuted,
          isVideoOff: nextState,
        });
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop Screen Share -> Revert to Camera Track
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);

      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        peersRef.current.forEach((peer) => {
          const sender = peer.pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
      }

      if (socketRef.current) {
        socketRef.current.emit("toggle-screen-share", { meetingCode, isSharing: false });
      }
    } else {
      // Start Screen Share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        const screenVideoTrack = screenStream.getVideoTracks()[0];

        // Replace track on all active peer connections
        peersRef.current.forEach((peer) => {
          const sender = peer.pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(screenVideoTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        if (socketRef.current) {
          socketRef.current.emit("toggle-screen-share", { meetingCode, isSharing: true });
        }

        screenVideoTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.warn("Screen share cancelled or failed:", err);
      }
    }
  };

  // 5. Send Chat Message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current) return;

    socketRef.current.emit("send-chat-message", {
      meetingCode,
      text: chatInput.trim(),
    });

    const selfMsg: MeetingChatMessage = {
      id: Date.now().toString(),
      sender_name: user?.employee?.name || user?.first_name || "You",
      sender_role: meeting?.is_host ? "HOST" : "PARTICIPANT",
      text: chatInput.trim(),
      timestamp: new Date().toISOString(),
      is_self: true,
    };
    setChatMessages((prev) => [...prev, selfMsg]);
    setChatInput("");

    setTimeout(() => {
      if (chatBottomRef.current) {
        chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
  };

  // 6. Host Actions
  const handleHostMutePeer = (targetSocketId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("host-mute-peer", { meetingCode, targetSocketId });
    }
  };

  const handleEndMeetingAll = () => {
    if (confirm("Are you sure you want to end this meeting for all participants?")) {
      if (socketRef.current) {
        socketRef.current.emit("host-end-meeting-all", { meetingCode });
      }
      cleanupMedia();
      setIsMeetingEnded(true);
    }
  };

  // Cleanup helper
  const cleanupMedia = () => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    peersRef.current.forEach((peer) => {
      peer.pc.close();
    });
    peersRef.current.clear();
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const handleLeaveMeeting = () => {
    cleanupMedia();
    router.push("/meetings");
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/meet/${meetingCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A110F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#FFFFFF" }}>
        <div style={{ animation: "pulse 1.5s infinite" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/flumenx-mark-only.png" alt="FLUMENX OS" style={{ width: "56px", height: "56px" }} />
        </div>
        <p style={{ marginTop: "16px", fontSize: "14px", color: "#94A3B8", letterSpacing: "0.08em" }}>Connecting to meeting space...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A110F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#FFFFFF", padding: "20px", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #EF4444", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
          <PhoneOff size={28} color="#EF4444" />
        </div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>Meeting Unavailable</h2>
        <p style={{ color: "#94A3B8", maxWidth: "400px", fontSize: "13.5px", marginBottom: "24px" }}>
          {error || "The meeting link is invalid or the meeting has concluded."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/meetings")}
          style={{ padding: "10px 24px", borderRadius: "10px", background: "#087A5B", color: "#FFF", fontWeight: 700, border: "none", cursor: "pointer" }}
        >
          Return to Meetings
        </button>
      </div>
    );
  }

  if (isMeetingEnded) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A110F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#FFFFFF", padding: "20px", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(8, 122, 91, 0.2)", border: "1px solid #087A5B", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/flumenx-mark-only.png" alt="FLUMENX" style={{ width: "32px", height: "32px" }} />
        </div>
        <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>Meeting Ended</h2>
        <p style={{ color: "#94A3B8", maxWidth: "420px", fontSize: "13.5px", marginBottom: "24px" }}>
          Thank you for joining. The call has ended and meeting records are archived.
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={() => router.push("/meetings")}
            style={{ padding: "10px 22px", borderRadius: "10px", background: "#087A5B", color: "#FFF", fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            Back to Calendar
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: "10px 22px", borderRadius: "10px", background: "rgba(255,255,255,0.08)", color: "#FFF", fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}
          >
            Rejoin
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 1: PRE-JOIN LOBBY VIEW
  // ==========================================
  if (isInLobby) {
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 30%, #13231F 0%, #080E0C 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", color: "#FFFFFF" }}>
        <div style={{ maxWidth: "980px", width: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "32px", alignItems: "center" }}>
          {/* Left: Video Preview Box */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                background: "#0F1715",
                borderRadius: "18px",
                overflow: "hidden",
                position: "relative",
                border: "1.5px solid rgba(8, 122, 91, 0.4)",
                boxShadow: "0 12px 36px rgba(0, 0, 0, 0.5)",
              }}
            >
              <video
                ref={lobbyVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                  display: isVideoOff ? "none" : "block",
                }}
              />

              {isVideoOff && (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#15201D" }}>
                  <Avatar name={user?.employee?.name || user?.first_name || "User"} size={72} />
                  <span style={{ marginTop: "12px", fontSize: "13px", color: "#94A3B8" }}>Camera is off</span>
                </div>
              )}

              {/* In-Preview Quick Toggle Floating Pill */}
              <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "12px", background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(10px)", padding: "8px 14px", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.15)" }}>
                <button
                  type="button"
                  onClick={() => toggleAudio()}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    border: "none",
                    background: isAudioMuted ? "#EF4444" : "rgba(255, 255, 255, 0.15)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                  type="button"
                  onClick={() => toggleVideo()}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    border: "none",
                    background: isVideoOff ? "#EF4444" : "rgba(255, 255, 255, 0.15)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
                >
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              </div>
            </div>

            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#34D399" }}>
              <Sparkles size={14} />
              <span>Camera & Microphone Ready</span>
            </div>
          </div>

          {/* Right: Meeting Info & Join Action */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(8, 122, 91, 0.2)", border: "1px solid rgba(8, 122, 91, 0.4)", padding: "4px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 800, color: "#34D399", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>
              <Shield size={13} />
              FLUMENX OS LIVE CALL
            </div>

            <h1 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 8px 0", color: "#FFFFFF" }}>
              {meeting.title}
            </h1>

            {meeting.description && (
              <p style={{ fontSize: "13.5px", color: "#94A3B8", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                {meeting.description}
              </p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "12.5px", color: "#CBD5E1", marginBottom: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Calendar size={15} color="#34D399" />
                <span>{meeting.date}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={15} color="#34D399" />
                <span>{meeting.time}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={15} color="#34D399" />
                <span>{meeting.department}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                type="button"
                onClick={handleJoinMeeting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "14px 28px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #087A5B 0%, #055C44 100%)",
                  border: "1px solid #34D399",
                  color: "#FFFFFF",
                  fontSize: "15px",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(8, 122, 91, 0.4)",
                  transition: "all 0.15s ease",
                }}
              >
                Join Now
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "11px 20px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#E2E8F0",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copied ? <Check size={16} color="#34D399" /> : <Copy size={16} />}
                <span>{copied ? "Link Copied!" : "Copy Meeting Link"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: LIVE IN-MEETING ROOM VIEW
  // ==========================================
  const peerList = Array.from(peers.values());
  const totalCount = peerList.length + 1; // +1 for local user

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0A110F", display: "flex", flexDirection: "column", overflow: "hidden", color: "#FFFFFF", zIndex: 99999 }}>
      {/* Top Header Bar */}
      <header style={{ height: "54px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(10, 17, 15, 0.95)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/flumenx-mark-only.png" alt="FLUMENX" style={{ width: "24px", height: "24px" }} />
          <div>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFFFFF" }}>{meeting.title}</span>
            <span style={{ marginLeft: "8px", fontSize: "11px", color: "#34D399", background: "rgba(8, 122, 91, 0.25)", padding: "2px 8px", borderRadius: "6px", fontFamily: "monospace" }}>
              {meetingCode}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleCopyLink}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "8px", padding: "6px 12px", color: "#E2E8F0", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            {copied ? <Check size={14} color="#34D399" /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy Link"}</span>
          </button>
        </div>
      </header>

      {/* Main Call Body (Grid + Drawers) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Video Canvas Grid */}
        <main
          style={{
            flex: 1,
            padding: "16px",
            display: "grid",
            gap: "14px",
            gridTemplateColumns:
              totalCount === 1
                ? "1fr"
                : totalCount === 2
                ? "repeat(auto-fit, minmax(320px, 1fr))"
                : totalCount <= 4
                ? "repeat(2, 1fr)"
                : "repeat(auto-fit, minmax(280px, 1fr))",
            alignItems: "center",
            justifyContent: "center",
            overflowY: "auto",
          }}
        >
          {/* Local User Tile */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              minHeight: "220px",
              background: "#13231F",
              borderRadius: "16px",
              overflow: "hidden",
              border: `2px solid ${isAudioMuted ? "rgba(255,255,255,0.08)" : "#087A5B"}`,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: isScreenSharing ? "none" : "scaleX(-1)",
                display: isVideoOff && !isScreenSharing ? "none" : "block",
              }}
            />

            {isVideoOff && !isScreenSharing && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Avatar name={user?.employee?.name || user?.first_name || "You"} size={64} />
              </div>
            )}

            {/* Name Badge */}
            <div style={{ position: "absolute", bottom: "12px", left: "14px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{user?.employee?.name || user?.first_name || "You (Me)"}</span>
              {isAudioMuted && <MicOff size={13} color="#EF4444" />}
            </div>
          </div>

          {/* Remote Peer Tiles */}
          {peerList.map((peer) => (
            <RemotePeerTile
              key={peer.socketId}
              peer={peer}
              isHost={Boolean(meeting.is_host)}
              onMute={() => handleHostMutePeer(peer.socketId)}
            />
          ))}
        </main>

        {/* In-Meeting Chat Drawer */}
        {activeDrawer === "chat" && (
          <aside style={{ width: "340px", maxWidth: "100%", background: "#0F1715", borderLeft: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", flexDirection: "column", zIndex: 20 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "14px" }}>
                <MessageSquare size={16} color="#34D399" />
                <span>In-Meeting Messages</span>
              </div>
              <button type="button" onClick={() => setActiveDrawer("none")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748B", fontSize: "12.5px", marginTop: "40px" }}>
                  No messages yet. Send a message to team members in call.
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={msg.id || i} style={{ display: "flex", flexDirection: "column", alignSelf: msg.is_self ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                    <div style={{ fontSize: "10.5px", color: msg.is_self ? "#34D399" : "#94A3B8", marginBottom: "2px", fontWeight: 700 }}>
                      {msg.is_self ? "You" : msg.sender_name}
                    </div>
                    <div style={{ padding: "8px 12px", borderRadius: "12px", background: msg.is_self ? "#087A5B" : "rgba(255,255,255,0.08)", color: "#FFFFFF", fontSize: "13px", wordBreak: "break-word" }}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendChat} style={{ padding: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Send a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF", fontSize: "13px", outline: "none" }}
              />
              <button type="submit" style={{ width: "38px", height: "38px", borderRadius: "8px", background: "#087A5B", border: "none", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Send size={15} />
              </button>
            </form>
          </aside>
        )}

        {/* In-Meeting Participants Drawer */}
        {activeDrawer === "participants" && (
          <aside style={{ width: "320px", maxWidth: "100%", background: "#0F1715", borderLeft: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", flexDirection: "column", zIndex: 20 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "14px" }}>
                <Users size={16} color="#34D399" />
                <span>Participants ({totalCount})</span>
              </div>
              <button type="button" onClick={() => setActiveDrawer("none")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Self */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Avatar name={user?.employee?.name || user?.first_name || "You"} size={32} />
                  <div>
                    <div style={{ fontSize: "12.5px", fontWeight: 700 }}>{user?.employee?.name || user?.first_name || "You"} (Me)</div>
                    <span style={{ fontSize: "10px", color: "#34D399" }}>{meeting.is_host ? "Host" : "Participant"}</span>
                  </div>
                </div>
                {isAudioMuted ? <MicOff size={15} color="#EF4444" /> : <Mic size={15} color="#34D399" />}
              </div>

              {/* Peers */}
              {peerList.map((p) => (
                <div key={p.socketId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Avatar name={p.name} size={32} />
                    <div>
                      <div style={{ fontSize: "12.5px", fontWeight: 700 }}>{p.name}</div>
                      <span style={{ fontSize: "10px", color: "#94A3B8" }}>{p.role}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {p.isAudioMuted ? <MicOff size={15} color="#EF4444" /> : <Mic size={15} color="#34D399" />}
                    {meeting.is_host && (
                      <button
                        type="button"
                        onClick={() => handleHostMutePeer(p.socketId)}
                        style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", padding: "3px 7px", color: "#FCA5A5", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Mute
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Floating Bottom Action Bar */}
      <footer style={{ height: "72px", display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", padding: "0 16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(10, 17, 15, 0.95)", zIndex: 10 }}>
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={() => toggleAudio()}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: "none",
            background: isAudioMuted ? "#EF4444" : "rgba(255, 255, 255, 0.12)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Video Toggle */}
        <button
          type="button"
          onClick={() => toggleVideo()}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: "none",
            background: isVideoOff ? "#EF4444" : "rgba(255, 255, 255, 0.12)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
        >
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        {/* Screen Share */}
        <button
          type="button"
          onClick={toggleScreenShare}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: "none",
            background: isScreenSharing ? "#34D399" : "rgba(255, 255, 255, 0.12)",
            color: isScreenSharing ? "#0A110F" : "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
        >
          {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
        </button>

        {/* In-Meeting Chat */}
        <button
          type="button"
          onClick={() => {
            setActiveDrawer(activeDrawer === "chat" ? "none" : "chat");
            setUnreadChatCount(0);
          }}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: "none",
            background: activeDrawer === "chat" ? "#087A5B" : "rgba(255, 255, 255, 0.12)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
          }}
          title="Meeting Chat"
        >
          <MessageSquare size={20} />
          {unreadChatCount > 0 && (
            <span style={{ position: "absolute", top: "2px", right: "2px", width: "16px", height: "16px", borderRadius: "50%", background: "#34D399", color: "#0A110F", fontSize: "10px", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Participants */}
        <button
          type="button"
          onClick={() => setActiveDrawer(activeDrawer === "participants" ? "none" : "participants")}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: "none",
            background: activeDrawer === "participants" ? "#087A5B" : "rgba(255, 255, 255, 0.12)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          title="Participants List"
        >
          <Users size={20} />
        </button>

        {/* Leave or End Meeting */}
        <div style={{ marginLeft: "12px", display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={handleLeaveMeeting}
            style={{
              padding: "0 18px",
              height: "46px",
              borderRadius: "99px",
              background: "#EF4444",
              border: "none",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <PhoneOff size={16} />
            <span>Leave</span>
          </button>

          {meeting.is_host && (
            <button
              type="button"
              onClick={handleEndMeetingAll}
              style={{
                padding: "0 14px",
                height: "46px",
                borderRadius: "99px",
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #EF4444",
                color: "#FCA5A5",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
              }}
              title="End call for all participants"
            >
              End for All
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function RemotePeerTile({ peer, isHost, onMute }: { peer: PeerConnection; isHost: boolean; onMute: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "220px",
        background: "#13231F",
        borderRadius: "16px",
        overflow: "hidden",
        border: `2px solid ${peer.isAudioMuted ? "rgba(255,255,255,0.08)" : "#087A5B"}`,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: peer.isVideoOff ? "none" : "block",
        }}
      />

      {peer.isVideoOff && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Avatar name={peer.name} size={64} />
        </div>
      )}

      {/* Name Badge */}
      <div style={{ position: "absolute", bottom: "12px", left: "14px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
        <span>{peer.name}</span>
        <span style={{ fontSize: "9.5px", color: "#34D399", opacity: 0.8 }}>({peer.role})</span>
        {peer.isAudioMuted && <MicOff size={13} color="#EF4444" />}
      </div>
    </div>
  );
}
