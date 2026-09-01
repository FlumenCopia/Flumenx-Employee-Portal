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
  Settings,
  MoreVertical,
  Sparkles,
  Shield,
  Clock,
  Calendar,
  Send,
  X,
  User as UserIcon,
  RefreshCw,
  Pin,
  PinOff,
  UserX,
  Volume2,
  Wifi,
  Zap,
  AlertCircle,
  Camera,
  HelpCircle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import type { AuthUser, Meeting, MeetingChatMessage } from "@/lib/types";

interface PeerConnection {
  socketId: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
  name: string;
  avatar?: string;
  role: string;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    { urls: "stun:stun.services.mozilla.com" },
    { urls: "stun:stun.nextcloud.com:443" },
    { urls: "stun:openrelay.metered.ca:80" },
  ],
  iceCandidatePoolSize: 10,
};

export type VideoQualityPreset = "auto" | "720p" | "480p" | "360p";

export const QUALITY_PROFILES: Record<VideoQualityPreset, { label: string; width: number; height: number; fps: number; maxBitrateBps: number }> = {
  auto: { label: "Auto (Adaptive)", width: 1280, height: 720, fps: 30, maxBitrateBps: 1200000 },
  "720p": { label: "High (720p HD)", width: 1280, height: 720, fps: 30, maxBitrateBps: 1500000 },
  "480p": { label: "Medium (480p Standard)", width: 854, height: 480, fps: 24, maxBitrateBps: 600000 },
  "360p": { label: "Low / Data Saver (360p)", width: 640, height: 360, fps: 15, maxBitrateBps: 250000 },
};

function optimizeSdpOpusAudio(sdp: string): string {
  if (!sdp) return sdp;
  return sdp.replace(
    /a=fmtp:111 (.*)/g,
    "a=fmtp:111 $1;useinbandfec=1;usedtx=1;minptime=10;maxaveragebitrate=64000"
  );
}

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
  const [kickedMessage, setKickedMessage] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);

  // Local Media Stream State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const isAudioMutedRef = useRef(isAudioMuted);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const isVideoOffRef = useRef(isVideoOff);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  // Quality & Connection Sync State
  const [videoQuality, setVideoQuality] = useState<VideoQualityPreset>("auto");
  const [networkRtt, setNetworkRtt] = useState<number | null>(null);

  // Device selectors
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  // Remote Peers & Connections
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // UI Drawers & Controls
  const [activeDrawer, setActiveDrawer] = useState<"none" | "chat" | "participants" | "settings" | "more">("none");
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [pinnedSocketId, setPinnedSocketId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  // DOM Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Helper: Apply encoding quality parameters to RTCRtpSenders
  const applyQualityToPeerSenders = useCallback((pc: RTCPeerConnection, preset: VideoQualityPreset) => {
    const profile = QUALITY_PROFILES[preset];
    pc.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === "video") {
        try {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = profile.maxBitrateBps;
          params.encodings[0].maxFramerate = profile.fps;
          params.degradationPreference = preset === "360p" ? "maintain-framerate" : "balanced";
          sender.setParameters(params).catch(() => {});
        } catch {}
      }
    });
  }, []);

  // Helper: Change quality preset dynamically
  const handleQualityChange = useCallback((preset: VideoQualityPreset) => {
    setVideoQuality(preset);
    const profile = QUALITY_PROFILES[preset];

    // 1. Update local video track constraints
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.applyConstraints({
          width: { ideal: profile.width },
          height: { ideal: profile.height },
          frameRate: { ideal: profile.fps },
        }).catch(() => {});
      }
    }

    // 2. Update senders on all WebRTC connections
    peersRef.current.forEach((peer) => {
      applyQualityToPeerSenders(peer.pc, preset);
    });

    showToast(`Video stream set to: ${profile.label}`);
  }, [localStream, applyQualityToPeerSenders]);

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

  // Permission & Hardware Diagnostic State
  const [permissionState, setPermissionState] = useState<"checking" | "granted" | "denied" | "prompt">("prompt");
  const [permissionErrorDetail, setPermissionErrorDetail] = useState<string>("");
  const [showPermissionHelpModal, setShowPermissionHelpModal] = useState<boolean>(false);

  const requestMediaPermissions = useCallback(async (openModalOnDeny = false): Promise<MediaStream | null> => {
    setPermissionState("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      });
      setPermissionState("granted");
      setPermissionErrorDetail("");
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsAudioMuted(false);
      setIsVideoOff(false);

      if (lobbyVideoRef.current) {
        lobbyVideoRef.current.srcObject = stream;
        lobbyVideoRef.current.play().catch(() => {});
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // If already connected with peers, add or replace tracks
      peersRef.current.forEach((peer) => {
        stream.getTracks().forEach((track) => {
          const sender = peer.pc.getSenders().find((s) => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            peer.pc.addTrack(track, stream);
          }
        });
      });

      showToast("Camera & Microphone connected.");
      return stream;
    } catch (err: any) {
      console.warn("Media permissions error:", err);
      const isDenied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
      setPermissionState("denied");
      setPermissionErrorDetail(
        isDenied
          ? "Permission denied by browser or device settings. Please grant access in your browser bar."
          : (err.message || "Failed to access camera or microphone.")
      );

      // Try getting audio only if video failed
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        setLocalStream(audioOnlyStream);
        localStreamRef.current = audioOnlyStream;
        setIsAudioMuted(false);
        setIsVideoOff(true);
        setPermissionState("granted");
        return audioOnlyStream;
      } catch {
        if (openModalOnDeny) {
          setShowPermissionHelpModal(true);
        }
        return null;
      }
    }
  }, []);

  // 2. Initialize Lobby Media Stream with Optimized Audio Settings
  useEffect(() => {
    async function setupLobbyMedia() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputDevices(devices.filter((d) => d.kind === "audioinput"));
        setVideoInputDevices(devices.filter((d) => d.kind === "videoinput"));
      } catch {}

      // Automatically request camera & mic on loading the lobby
      await requestMediaPermissions(false);
    }

    if (isInLobby && !isMeetingEnded) {
      setupLobbyMedia();
    }
  }, [isInLobby, isMeetingEnded, requestMediaPermissions]);

  // Attach local stream whenever entering live meeting
  useEffect(() => {
    if (!isInLobby && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [isInLobby, localStream]);

  // Network Sync & Latency RTT Monitoring Loop
  useEffect(() => {
    if (isInLobby || isMeetingEnded) return;

    const interval = setInterval(async () => {
      let maxRtt = 0;
      let peerCount = 0;
      for (const [, peer] of peersRef.current) {
        try {
          const stats = await peer.pc.getStats();
          stats.forEach((report) => {
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              const rtt = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : 0;
              if (rtt > 0) {
                maxRtt = Math.max(maxRtt, rtt);
                peerCount++;
              }
            }
          });
        } catch {}
      }
      if (peerCount > 0) {
        setNetworkRtt(maxRtt);
      } else {
        setNetworkRtt(null);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isInLobby, isMeetingEnded]);

  const renegotiatePeer = useCallback(async (peer: PeerConnection) => {
    try {
      if (peer.pc.signalingState !== "stable") return;
      const offer = await peer.pc.createOffer();
      const optSdp = optimizeSdpOpusAudio(offer.sdp || "");
      const newOffer = new RTCSessionDescription({ type: offer.type, sdp: optSdp });
      await peer.pc.setLocalDescription(newOffer);
      applyQualityToPeerSenders(peer.pc, videoQuality);
      if (socketRef.current) {
        socketRef.current.emit("signal-offer", {
          to: peer.socketId,
          offer: peer.pc.localDescription,
        });
      }
    } catch (err) {
      console.error("Error renegotiating peer connection:", err);
    }
  }, [applyQualityToPeerSenders, videoQuality]);

  const createPeerConnection = useCallback(
    (socketId: string, name: string, role: string, avatar: string, isInitiator: boolean) => {
      if (peersRef.current.has(socketId)) {
        return peersRef.current.get(socketId)!.pc;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      const activeStream = localStreamRef.current;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => {
          if (track.kind === "audio") track.enabled = !isAudioMutedRef.current;
          if (track.kind === "video") track.enabled = !isVideoOffRef.current;
          pc.addTrack(track, activeStream);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit("signal-ice-candidate", {
            to: socketId,
            candidate: event.candidate,
          });
        }
      };

      pc.onnegotiationneeded = async () => {
        const p = peersRef.current.get(socketId);
        if (p) {
          await renegotiatePeer(p);
        }
      };

      pc.ontrack = (event) => {
        const peerObj = peersRef.current.get(socketId);
        let remoteStream = peerObj?.stream;
        if (!remoteStream) {
          remoteStream = event.streams[0] || new MediaStream();
        }
        if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
        const freshStream = new MediaStream(remoteStream.getTracks());
        setPeers((prev) => {
          const next = new Map(prev);
          const p = next.get(socketId);
          if (p) {
            p.stream = freshStream;
            next.set(socketId, { ...p, stream: freshStream });
          }
          return next;
        });
        if (peerObj) {
          peerObj.stream = freshStream;
        }
      };

      const peerObj: PeerConnection = {
        socketId,
        pc,
        name,
        avatar,
        role,
        isAudioMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
      };

      peersRef.current.set(socketId, peerObj);
      setPeers(new Map(peersRef.current));

      if (isInitiator) {
        pc.createOffer()
          .then((offer) => {
            const optSdp = optimizeSdpOpusAudio(offer.sdp || "");
            const newOffer = new RTCSessionDescription({ type: offer.type, sdp: optSdp });
            return pc.setLocalDescription(newOffer);
          })
          .then(() => {
            applyQualityToPeerSenders(pc, videoQuality);
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
    },
    [applyQualityToPeerSenders, videoQuality, renegotiatePeer]
  );

  // 3. Connect to WebRTC Socket.io Room upon clicking "Join"
  const handleJoinMeeting = useCallback(async () => {
    setIsInLobby(false);

    let activeStream = localStreamRef.current;
    if (!activeStream) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: !isAudioMuted ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
          video: !isVideoOff ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
        setLocalStream(activeStream);
      } catch (err) {
        console.warn("Joining with muted stream:", err);
      }
    }

    if (localVideoRef.current && activeStream) {
      localVideoRef.current.srcObject = activeStream;
      localVideoRef.current.play().catch(() => {});
    }

    const token = typeof window !== "undefined" ? (localStorage.getItem("flumenx_access_token") || localStorage.getItem("access_token") || "") : "";
    let socketUrl: string | undefined = undefined;
    if (typeof window !== "undefined") {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        socketUrl = "http://127.0.0.1:8000";
      } else {
        socketUrl = window.location.origin;
      }
    }

    const socket = io(socketUrl || "", {
      path: "/socket.io/",
      auth: { token },
      transports: ["polling", "websocket"],
      upgrade: true,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.emit("join-meeting", {
      meetingCode,
      name: user?.employee?.name || user?.first_name || user?.username || "Participant",
    });

    socket.on("joined-successfully", async (data: { meeting: any; self: any; peers: any[] }) => {
      for (const peer of data.peers) {
        if (peer.socketId !== socket.id) {
          createPeerConnection(peer.socketId, peer.name, peer.role, peer.avatar || "", true);
        }
      }
    });

    socket.on("peer-joined", (peer: { socketId: string; name: string; role: string; avatar?: string }) => {
      if (peer.socketId !== socket.id) {
        createPeerConnection(peer.socketId, peer.name, peer.role, peer.avatar || "", false);
      }
    });

    socket.on("signal-offer", async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      let peer = peersRef.current.get(data.from);
      if (!peer) {
        createPeerConnection(data.from, "Participant", "PARTICIPANT", "", false);
        peer = peersRef.current.get(data.from);
      }
      if (peer) {
        try {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peer.pc.createAnswer();
          const optSdp = optimizeSdpOpusAudio(answer.sdp || "");
          const newAnswer = new RTCSessionDescription({ type: answer.type, sdp: optSdp });
          await peer.pc.setLocalDescription(newAnswer);
          applyQualityToPeerSenders(peer.pc, videoQuality);
          socket.emit("signal-answer", { to: data.from, answer: newAnswer });

          const queued = iceCandidatesQueue.current.get(data.from) || [];
          for (const cand of queued) {
            try {
              await peer.pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {}
          }
          iceCandidatesQueue.current.delete(data.from);
        } catch (err) {
          console.error("Error answering WebRTC offer:", err);
        }
      }
    });

    socket.on("signal-answer", async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      const peer = peersRef.current.get(data.from);
      if (peer) {
        try {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          const queued = iceCandidatesQueue.current.get(data.from) || [];
          for (const cand of queued) {
            try {
              await peer.pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {}
          }
          iceCandidatesQueue.current.delete(data.from);
        } catch (err) {
          console.error("Error setting remote description from answer:", err);
        }
      }
    });

    socket.on("signal-ice-candidate", async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const peer = peersRef.current.get(data.from);
      if (data.candidate) {
        if (peer && peer.pc.remoteDescription) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.error("Error adding ice candidate:", err);
          }
        } else {
          if (!iceCandidatesQueue.current.has(data.from)) {
            iceCandidatesQueue.current.set(data.from, []);
          }
          iceCandidatesQueue.current.get(data.from)!.push(data.candidate);
        }
      }
    });

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

    socket.on("new-chat-message", (msg: any) => {
      const formattedMsg: MeetingChatMessage = {
        id: String(msg.id || Date.now()),
        sender_name: msg.sender_name || msg.senderName || "Participant",
        sender_role: msg.sender_role || msg.senderRole || "PARTICIPANT",
        text: msg.text,
        timestamp: msg.timestamp || new Date().toISOString(),
        is_self: false,
      };
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === formattedMsg.id)) return prev;
        return [...prev, formattedMsg];
      });
      if (activeDrawer !== "chat") {
        setUnreadChatCount((c) => c + 1);
      }
    });

    // HOST ACTIONS INCOMING HANDLERS
    socket.on("host-muted-you", () => {
      toggleAudio(true);
      showToast("Your microphone was muted by the meeting host.");
    });

    socket.on("host-camera-off-you", () => {
      toggleVideo(true);
      showToast("Your camera was turned off by the meeting host.");
    });

    socket.on("host-kicked-you", () => {
      cleanupMedia();
      setKickedMessage("You were removed from the meeting by the host.");
      setIsMeetingEnded(true);
    });

    socket.on("meeting-ended-by-host", () => {
      cleanupMedia();
      setIsMeetingEnded(true);
    });

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

    api<MeetingChatMessage[]>(`/meetings/code/${meetingCode}/messages/`)
      .then((history) => setChatMessages(history))
      .catch(() => {});
  }, [localStream, isAudioMuted, isVideoOff, meetingCode, user, activeDrawer, pinnedSocketId, videoQuality, applyQualityToPeerSenders]);



  // Media Controls
  const toggleAudio = async (forceMute?: boolean) => {
    const nextState = forceMute !== undefined ? forceMute : !isAudioMuted;

    let targetStream = localStreamRef.current;
    if (!targetStream) {
      targetStream = new MediaStream();
      setLocalStream(targetStream);
    }

    let audioTrack = targetStream.getAudioTracks()[0];
    if (!audioTrack && !nextState) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        const newTrack = audioStream.getAudioTracks()[0];
        if (newTrack) {
          targetStream.addTrack(newTrack);
          audioTrack = newTrack;
          peersRef.current.forEach((peer) => {
            peer.pc.addTrack(newTrack, targetStream!);
            renegotiatePeer(peer);
          });
        }
      } catch (err) {
        console.warn("Could not acquire microphone track:", err);
      }
    }

    if (audioTrack) {
      audioTrack.enabled = !nextState;
      setIsAudioMuted(nextState);

      if (socketRef.current) {
        socketRef.current.emit("toggle-media", {
          meetingCode,
          isAudioMuted: nextState,
          isVideoOff,
        });
      }
    } else {
      setIsAudioMuted(nextState);
    }
  };

  const toggleVideo = async (forceOff?: boolean) => {
    const nextState = forceOff !== undefined ? forceOff : !isVideoOff;

    let targetStream = localStreamRef.current;
    if (!targetStream) {
      targetStream = new MediaStream();
      setLocalStream(targetStream);
    }

    let videoTrack = targetStream.getVideoTracks()[0];
    if (!videoTrack && !nextState) {
      try {
        const profile = QUALITY_PROFILES[videoQuality] || QUALITY_PROFILES["auto"];
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: profile.width }, height: { ideal: profile.height }, frameRate: { ideal: profile.fps } },
          audio: false,
        });
        const newTrack = videoStream.getVideoTracks()[0];
        if (newTrack) {
          targetStream.addTrack(newTrack);
          videoTrack = newTrack;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = targetStream;
            localVideoRef.current.play().catch(() => {});
          }
          if (lobbyVideoRef.current) {
            lobbyVideoRef.current.srcObject = targetStream;
            lobbyVideoRef.current.play().catch(() => {});
          }
          peersRef.current.forEach((peer) => {
            peer.pc.addTrack(newTrack, targetStream!);
            renegotiatePeer(peer);
          });
        }
      } catch (err) {
        console.warn("Could not acquire camera track:", err);
      }
    }

    if (videoTrack) {
      videoTrack.enabled = !nextState;
      setIsVideoOff(nextState);

      if (socketRef.current) {
        socketRef.current.emit("toggle-media", {
          meetingCode,
          isAudioMuted,
          isVideoOff: nextState,
        });
      }
    } else {
      setIsVideoOff(nextState);
    }
  };

  const refreshDevices = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(devices.filter((d) => d.kind === "audioinput"));
      setVideoInputDevices(devices.filter((d) => d.kind === "videoinput"));
    } catch {}
  }, []);

  const switchCamera = async (targetDeviceId?: string) => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    try {
      const nextFacing = facingMode === "user" ? "environment" : "user";
      const profile = QUALITY_PROFILES[videoQuality];
      const videoConstraint: MediaTrackConstraints = targetDeviceId
        ? { deviceId: { exact: targetDeviceId } }
        : { facingMode: { ideal: nextFacing } };

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { ...videoConstraint, width: { ideal: profile.width }, height: { ideal: profile.height }, frameRate: { ideal: profile.fps } },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      if (!targetDeviceId) {
        setFacingMode(nextFacing);
      }
      setSelectedVideoInput(targetDeviceId || newVideoTrack.getSettings().deviceId || "");

      if (localStream) {
        const oldTrack = localStream.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          localStream.removeTrack(oldTrack);
        }
        localStream.addTrack(newVideoTrack);
        newVideoTrack.enabled = !isVideoOff;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch(() => {});
        }

        peersRef.current.forEach((peer) => {
          const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video" || s.track === null);
          if (sender) {
            sender.replaceTrack(newVideoTrack).catch((err) => console.warn("replaceTrack video error:", err));
          }
        });
      }
      await refreshDevices();
    } catch (err) {
      console.warn("Could not switch camera:", err);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const switchMicrophone = async (targetDeviceId: string) => {
    try {
      setSelectedAudioInput(targetDeviceId);
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: targetDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });

      const newAudioTrack = newStream.getAudioTracks()[0];
      if (!newAudioTrack) return;

      if (localStream) {
        const oldTrack = localStream.getAudioTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          localStream.removeTrack(oldTrack);
        }
        localStream.addTrack(newAudioTrack);
        newAudioTrack.enabled = !isAudioMuted;

        peersRef.current.forEach((peer) => {
          const sender = peer.pc.getSenders().find((s) => s.track?.kind === "audio" || s.track === null);
          if (sender) {
            sender.replaceTrack(newAudioTrack).catch((err) => console.warn("replaceTrack audio error:", err));
          }
        });
      }
      await refreshDevices();
    } catch (err) {
      console.warn("Could not switch microphone:", err);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
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
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        const screenVideoTrack = screenStream.getVideoTracks()[0];

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

  // Host Action Handlers
  const handleHostMutePeer = (targetSocketId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("host-mute-peer", { meetingCode, targetSocketId });
      showToast("Mute request sent to participant.");
    }
  };

  const handleHostOffCameraPeer = (targetSocketId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("host-off-camera-peer", { meetingCode, targetSocketId });
      showToast("Turned off participant's camera.");
    }
  };

  const handleHostKickPeer = (targetSocketId: string, peerName: string) => {
    if (window.confirm(`Are you sure you want to kick "${peerName}" out of this meeting?`)) {
      if (socketRef.current) {
        socketRef.current.emit("host-kick-peer", { meetingCode, targetSocketId });
        showToast(`Kicked ${peerName} from the meeting.`);
      }
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
          <img src="/flumenx-mark-only.png" alt="FLUMENX BOS" style={{ width: "56px", height: "56px" }} />
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
          {kickedMessage || "Thank you for joining. The call has ended and meeting records are archived."}
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={() => router.push("/meetings")}
            style={{ padding: "10px 22px", borderRadius: "10px", background: "#087A5B", color: "#FFF", fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            Back to Calendar
          </button>
        </div>
      </div>
    );
  }

  // PRE-JOIN LOBBY VIEW
  if (isInLobby) {
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 30%, #13231F 0%, #080E0C 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", color: "#FFFFFF", boxSizing: "border-box" }}>
        <div style={{ maxWidth: "880px", width: "100%", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
          <div style={{ width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", alignItems: "center" }}>
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
                  <Avatar name={user?.employee?.name || user?.first_name || "User"} avatar={user?.avatar || user?.employee?.avatar} size={64} />
                  <span style={{ marginTop: "12px", fontSize: "13px", color: "#94A3B8" }}>Camera is off</span>
                </div>
              )}

              <div style={{ position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "10px", background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(10px)", padding: "6px 12px", borderRadius: "99px", border: "1px solid rgba(255,255,255,0.15)" }}>
                <button
                  type="button"
                  onClick={() => toggleAudio()}
                  style={{ width: "38px", height: "38px", borderRadius: "50%", border: "none", background: isAudioMuted ? "#EF4444" : "rgba(255, 255, 255, 0.15)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button
                  type="button"
                  onClick={() => toggleVideo()}
                  style={{ width: "38px", height: "38px", borderRadius: "50%", border: "none", background: isVideoOff ? "#EF4444" : "rgba(255, 255, 255, 0.15)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
                >
                  {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                </button>

                <button
                  type="button"
                  onClick={() => switchCamera()}
                  disabled={isSwitchingCamera || isVideoOff}
                  style={{ width: "38px", height: "38px", borderRadius: "50%", border: "none", background: isSwitchingCamera ? "rgba(52, 211, 153, 0.25)" : "rgba(255, 255, 255, 0.15)", color: isVideoOff ? "#64748B" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: isVideoOff ? "not-allowed" : "pointer" }}
                  title="Flip Camera (Front/Back)"
                >
                  <RefreshCw size={16} className={isSwitchingCamera ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {permissionState !== "granted" ? (
              <div
                style={{
                  marginTop: "12px",
                  width: "100%",
                  padding: "12px 14px",
                  background: permissionState === "denied" ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
                  border: `1.5px solid ${permissionState === "denied" ? "#EF4444" : "#F59E0B"}`,
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertCircle size={18} color={permissionState === "denied" ? "#EF4444" : "#F59E0B"} style={{ flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>
                      {permissionState === "denied" ? "Camera & Microphone Blocked" : "Permissions Required"}
                    </span>
                    <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#94A3B8", lineHeight: 1.3 }}>
                      {permissionErrorDetail || "Grant camera & microphone access so other participants can see and hear you."}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => requestMediaPermissions(true)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "8px",
                      background: "#087A5B",
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <Camera size={14} /> Allow Camera & Mic
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPermissionHelpModal(true)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#E2E8F0",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <HelpCircle size={14} /> How to Enable
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#34D399" }}>
                <CheckCircle2 size={14} />
                <span>Camera & Microphone Ready</span>
              </div>
            )}
          </div>

          <div style={{ width: "100%", maxWidth: "560px", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(8, 122, 91, 0.2)", border: "1px solid rgba(8, 122, 91, 0.4)", padding: "4px 12px", borderRadius: "99px", fontSize: "10.5px", fontWeight: 800, color: "#34D399", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
              <Shield size={12} /> FLUMENX BOS LIVE CALL
            </div>

            <h1 style={{ fontSize: "clamp(20px, 5vw, 28px)", fontWeight: 900, margin: "0 0 6px 0", color: "#FFFFFF" }}>
              {meeting.title}
            </h1>

            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", fontSize: "12px", color: "#CBD5E1", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Calendar size={14} color="#34D399" />
                <span>{meeting.date}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Clock size={14} color="#34D399" />
                <span>{meeting.time}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Users size={14} color="#34D399" />
                <span>{meeting.department}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
              <button
                type="button"
                onClick={handleJoinMeeting}
                style={{
                  width: "100%",
                  padding: "13px 24px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #087A5B 0%, #055C44 100%)",
                  border: "1px solid #34D399",
                  color: "#FFFFFF",
                  fontSize: "15px",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(8, 122, 91, 0.4)",
                }}
              >
                Join Now
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  width: "100%",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#E2E8F0",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                {copied ? <Check size={15} color="#34D399" /> : <Copy size={15} />}
                <span>{copied ? "Link Copied!" : "Copy Meeting Link"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Permission Help Modal */}
        {showPermissionHelpModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
            onClick={() => setShowPermissionHelpModal(false)}
          >
            <div
              style={{
                background: "#13231F",
                border: "1.5px solid #087A5B",
                borderRadius: "18px",
                padding: "24px",
                maxWidth: "500px",
                width: "100%",
                color: "#FFF",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Camera size={22} color="#34D399" />
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800 }}>How to Enable Camera & Mic</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPermissionHelpModal(false)}
                  style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px", color: "#CBD5E1" }}>
                <div style={{ background: "rgba(255,255,255,0.04)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <strong style={{ color: "#34D399", display: "block", marginBottom: "4px" }}>📱 Android (Chrome / Firefox):</strong>
                  1. Tap the 🔒 <strong>Lock / Settings icon</strong> on the left side of the address bar.<br/>
                  2. Tap <strong>Permissions</strong>.<br/>
                  3. Set <strong>Camera</strong> and <strong>Microphone</strong> to <strong>Allow</strong>.<br/>
                  4. Refresh the page.
                </div>

                <div style={{ background: "rgba(255,255,255,0.04)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <strong style={{ color: "#34D399", display: "block", marginBottom: "4px" }}>🍏 iOS Safari (iPhone / iPad):</strong>
                  1. Tap <strong>aA</strong> in the URL bar.<br/>
                  2. Tap <strong>Website Settings</strong>.<br/>
                  3. Set <strong>Camera</strong> & <strong>Microphone</strong> to <strong>Allow</strong>.<br/>
                  4. Reload the page.
                </div>

                <div style={{ background: "rgba(255,255,255,0.04)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <strong style={{ color: "#34D399", display: "block", marginBottom: "4px" }}>💻 PC / Mac (Chrome, Edge, Brave):</strong>
                  1. Click the 🎛️ <strong>Tune / Lock icon</strong> next to the URL.<br/>
                  2. Switch <strong>Camera</strong> and <strong>Microphone</strong> toggles to <strong>ON</strong>.<br/>
                  3. Click &quot;Re-check Permission&quot; below.
                </div>
              </div>

              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={async () => {
                    setShowPermissionHelpModal(false);
                    await requestMediaPermissions(true);
                  }}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: "10px",
                    background: "#087A5B",
                    color: "#FFF",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Re-check Permissions
                </button>
                <button
                  type="button"
                  onClick={() => setShowPermissionHelpModal(false)}
                  style={{
                    padding: "11px 18px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.1)",
                    color: "#FFF",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // LIVE IN-MEETING ROOM VIEW
  const peerList = Array.from(peers.values());
  const totalCount = peerList.length + 1; // +1 for local user
  const isHostUser = Boolean(meeting.is_host || user?.role === "SUPER_ADMIN" || Boolean((user as any)?.is_superuser));

  const isPinned = pinnedSocketId !== null;
  const pinnedPeer = pinnedSocketId ? peerList.find((p) => p.socketId === pinnedSocketId) : null;
  const isLocalPinned = pinnedSocketId === "local";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0A110F", display: "flex", flexDirection: "column", overflow: "hidden", color: "#FFFFFF", zIndex: 99999 }}>
      {/* Toast Banner */}
      {toastMessage && (
        <div style={{ position: "absolute", top: "62px", left: "50%", transform: "translateX(-50%)", background: "rgba(8, 122, 91, 0.95)", border: "1px solid #34D399", color: "#FFFFFF", padding: "8px 16px", borderRadius: "99px", fontSize: "12px", fontWeight: 700, zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
          {toastMessage}
        </div>
      )}

      {/* Top Header Bar with Connection Sync Health Indicator */}
      <header style={{ height: "50px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(10, 17, 15, 0.98)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", maxWidth: "60%", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/flumenx-mark-only.png" alt="FLUMENX" style={{ width: "22px", height: "22px", flexShrink: 0 }} />
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {meeting.title}
          </span>
          <span style={{ fontSize: "10.5px", color: "#34D399", background: "rgba(8, 122, 91, 0.25)", padding: "2px 6px", borderRadius: "6px", fontFamily: "monospace", flexShrink: 0 }}>
            {meetingCode}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Network Connection Health Indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              borderRadius: "6px",
              background: networkRtt === null ? "rgba(255,255,255,0.06)" : networkRtt < 100 ? "rgba(16, 185, 129, 0.15)" : networkRtt < 220 ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${networkRtt === null ? "rgba(255,255,255,0.1)" : networkRtt < 100 ? "#10B981" : networkRtt < 220 ? "#F59E0B" : "#EF4444"}`,
              fontSize: "10.5px",
              fontWeight: 700,
              color: networkRtt === null ? "#94A3B8" : networkRtt < 100 ? "#34D399" : networkRtt < 220 ? "#FDE68A" : "#FCA5A5",
            }}
            title={networkRtt ? `Round trip delay: ${networkRtt}ms` : "Monitoring stream sync"}
          >
            <Wifi size={12} />
            <span>{networkRtt ? `${networkRtt}ms` : "Sync OK"}</span>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "6px", padding: "4px 8px", color: "#E2E8F0", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
          >
            {copied ? <Check size={13} color="#34D399" /> : <Copy size={13} />}
            <span className="hidden-xs">{copied ? "Copied" : "Copy Link"}</span>
          </button>
        </div>
      </header>

      {/* In-Call Camera / Mic Permission Alert */}
      {permissionState === "denied" && (
        <div
          style={{
            background: "#7F1D1D",
            borderBottom: "1px solid #EF4444",
            padding: "7px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            fontSize: "12px",
            color: "#FEE2E2",
            zIndex: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertCircle size={15} color="#FCA5A5" style={{ flexShrink: 0 }} />
            <span><strong>Camera / Mic Disabled:</strong> Others cannot see or hear you.</span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => requestMediaPermissions(true)}
              style={{
                padding: "3px 9px",
                background: "#EF4444",
                border: "none",
                borderRadius: "5px",
                color: "#FFF",
                fontWeight: 700,
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => setShowPermissionHelpModal(true)}
              style={{
                padding: "3px 8px",
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "5px",
                color: "#FFF",
                fontWeight: 600,
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Guide
            </button>
          </div>
        </div>
      )}

      {/* Main Video Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <main style={{ flex: 1, padding: "10px", display: "flex", flexDirection: "column", gap: "10px", overflow: "hidden" }}>
          {/* PINNED SPOTLIGHT VIEW */}
          {isPinned ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", height: "100%", overflow: "hidden" }}>
              <div style={{ flex: 1, position: "relative", background: "#13231F", borderRadius: "16px", overflow: "hidden", border: "2px solid #34D399", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isLocalPinned ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: "100%", height: "100%", objectFit: isScreenSharing ? "contain" : "cover", transform: isScreenSharing ? "none" : "scaleX(-1)" }}
                  />
                ) : (
                  <RemotePinnedVideo peer={pinnedPeer} />
                )}

                <div style={{ position: "absolute", top: "12px", left: "12px", background: "rgba(8, 122, 91, 0.9)", backdropFilter: "blur(6px)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800, color: "#FFFFFF", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }} onClick={() => setPinnedSocketId(null)}>
                  <Pin size={13} />
                  <span>Pinned Spotlight ({isLocalPinned ? "You" : pinnedPeer?.name}) — Click to Unpin</span>
                </div>
              </div>

              <div style={{ height: "100px", display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "2px" }}>
                {!isLocalPinned && (
                  <div
                    onClick={() => setPinnedSocketId("local")}
                    style={{ width: "130px", height: "100%", flexShrink: 0, background: "#13231F", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", position: "relative", cursor: "pointer" }}
                  >
                    <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: isVideoOff ? "none" : "block" }} />
                    {isVideoOff && <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><Avatar name="Me" avatar={user?.avatar || user?.employee?.avatar} size={32} /></div>}
                    <span style={{ position: "absolute", bottom: "4px", left: "6px", fontSize: "10px", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "4px" }}>You</span>
                  </div>
                )}

                {peerList.filter((p) => p.socketId !== pinnedSocketId).map((peer) => (
                  <div
                    key={peer.socketId}
                    onClick={() => setPinnedSocketId(peer.socketId)}
                    style={{ width: "130px", height: "100%", flexShrink: 0, background: "#13231F", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", position: "relative", cursor: "pointer" }}
                  >
                    <RemotePeerTile peer={peer} isHost={isHostUser} onMute={() => handleHostMutePeer(peer.socketId)} onCameraOff={() => handleHostOffCameraPeer(peer.socketId)} onKick={() => handleHostKickPeer(peer.socketId, peer.name)} onPin={() => setPinnedSocketId(peer.socketId)} compact />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* STANDARD GRID VIEW */
            <div
              style={{
                flex: 1,
                display: "grid",
                gap: "10px",
                gridTemplateColumns:
                  totalCount === 1
                    ? "1fr"
                    : totalCount === 2
                    ? "1fr"
                    : totalCount <= 4
                    ? "repeat(2, 1fr)"
                    : "repeat(auto-fit, minmax(220px, 1fr))",
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
                  minHeight: "180px",
                  background: "#13231F",
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: `2px solid ${isAudioMuted ? "rgba(255,255,255,0.08)" : "#087A5B"}`,
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
                    <Avatar name={user?.employee?.name || user?.first_name || "You"} avatar={user?.avatar || user?.employee?.avatar} size={56} />
                  </div>
                )}

                <div style={{ position: "absolute", bottom: "10px", left: "10px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", padding: "4px 8px", borderRadius: "6px", fontSize: "11.5px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{user?.employee?.name || user?.first_name || "You (Me)"}</span>
                  {isAudioMuted && <MicOff size={12} color="#EF4444" />}
                </div>

                <button
                  type="button"
                  onClick={() => setPinnedSocketId("local")}
                  style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "6px", padding: "5px", color: "#FFFFFF", cursor: "pointer" }}
                  title="Pin Video"
                >
                  <Pin size={13} />
                </button>
              </div>

              {/* Remote Peer Tiles */}
              {peerList.map((peer) => (
                <RemotePeerTile
                  key={peer.socketId}
                  peer={peer}
                  isHost={isHostUser}
                  onMute={() => handleHostMutePeer(peer.socketId)}
                  onCameraOff={() => handleHostOffCameraPeer(peer.socketId)}
                  onKick={() => handleHostKickPeer(peer.socketId, peer.name)}
                  onPin={() => setPinnedSocketId(peer.socketId)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Chat Drawer */}
        {activeDrawer === "chat" && (
          <aside style={{ width: "320px", maxWidth: "100%", background: "#0F1715", borderLeft: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", flexDirection: "column", zIndex: 20 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "13.5px" }}>
                <MessageSquare size={16} color="#34D399" />
                <span>In-Meeting Chat</span>
              </div>
              <button type="button" onClick={() => setActiveDrawer("none")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748B", fontSize: "12px", marginTop: "30px" }}>
                  No messages yet. Send a message to participants.
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={msg.id || i} style={{ display: "flex", flexDirection: "column", alignSelf: msg.is_self ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                    <div style={{ fontSize: "10px", color: msg.is_self ? "#34D399" : "#94A3B8", marginBottom: "2px", fontWeight: 700 }}>
                      {msg.is_self ? "You" : msg.sender_name}
                    </div>
                    <div style={{ padding: "7px 11px", borderRadius: "10px", background: msg.is_self ? "#087A5B" : "rgba(255,255,255,0.08)", color: "#FFFFFF", fontSize: "12.5px", wordBreak: "break-word" }}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendChat} style={{ padding: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", gap: "6px" }}>
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF", fontSize: "12.5px", outline: "none" }}
              />
              <button type="submit" style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#087A5B", border: "none", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Send size={15} />
              </button>
            </form>
          </aside>
        )}

        {/* Participants Drawer */}
        {activeDrawer === "participants" && (
          <aside style={{ width: "320px", maxWidth: "100%", background: "#0F1715", borderLeft: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", flexDirection: "column", zIndex: 20 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "13.5px" }}>
                <Users size={16} color="#34D399" />
                <span>Participants ({totalCount})</span>
              </div>
              <button type="button" onClick={() => setActiveDrawer("none")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#087A5B", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "12px" }}>
                    <Avatar name={user?.employee?.name || user?.first_name || "You"} avatar={user?.avatar || user?.employee?.avatar} size={32} />
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700 }}>{user?.employee?.name || user?.first_name || "You"} (Me)</div>
                    <span style={{ fontSize: "10px", color: "#34D399" }}>{isHostUser ? "Host / Organizer" : "Participant"}</span>
                  </div>
                </div>
                {isAudioMuted ? <MicOff size={15} color="#EF4444" /> : <Mic size={15} color="#34D399" />}
              </div>

              {peerList.map((p) => (
                <div key={p.socketId} style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#1E293B", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "12px" }}>
                        <Avatar name={p.name} avatar={p.avatar} size={32} />
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 700 }}>{p.name}</div>
                        <span style={{ fontSize: "10px", color: "#94A3B8" }}>{p.role}</span>
                      </div>
                    </div>
                    {p.isAudioMuted ? <MicOff size={15} color="#EF4444" /> : <Mic size={15} color="#34D399" />}
                  </div>

                  {isHostUser && (
                    <div style={{ display: "flex", gap: "6px", paddingTop: "4px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <button
                        type="button"
                        onClick={() => handleHostMutePeer(p.socketId)}
                        style={{ flex: 1, padding: "3px 6px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", color: "#FCA5A5", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Mute Mic
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHostOffCameraPeer(p.socketId)}
                        style={{ flex: 1, padding: "3px 6px", background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "6px", color: "#FDE68A", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Cam Off
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHostKickPeer(p.socketId, p.name)}
                        style={{ flex: 1, padding: "3px 6px", background: "#DC2626", border: "none", borderRadius: "6px", color: "#FFFFFF", fontSize: "10px", fontWeight: 800, cursor: "pointer" }}
                      >
                        Kick Out
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Device & Video Quality Settings Drawer */}
        {activeDrawer === "settings" && (
          <aside style={{ width: "320px", maxWidth: "100%", background: "#0F1715", borderLeft: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", flexDirection: "column", zIndex: 20 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "13.5px" }}>
                <Settings size={16} color="#34D399" />
                <span>Audio & Video Settings</span>
              </div>
              <button type="button" onClick={() => setActiveDrawer("none")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Network Adaptive Quality Selector */}
              <div style={{ background: "rgba(255,255,255,0.04)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#34D399", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <Zap size={14} />
                  Video Quality & Data Saver
                </label>
                <select
                  value={videoQuality}
                  onChange={(e) => handleQualityChange(e.target.value as VideoQualityPreset)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#FFF", fontSize: "12px", outline: "none" }}
                >
                  {(Object.keys(QUALITY_PROFILES) as VideoQualityPreset[]).map((key) => (
                    <option key={key} value={key} style={{ background: "#0F1715" }}>
                      {QUALITY_PROFILES[key].label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "10px", color: "#94A3B8", marginTop: "4px", display: "block" }}>
                  Adjust bitrate to prevent video delay or buffer lag on slow networks.
                </span>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#E2E8F0" }}>Camera Device</label>
                  <button type="button" onClick={() => switchCamera()} disabled={isSwitchingCamera || isVideoOff} style={{ background: "rgba(52, 211, 153, 0.15)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "6px", padding: "3px 6px", color: "#34D399", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>
                    Flip Camera
                  </button>
                </div>
                <select value={selectedVideoInput} onChange={(e) => switchCamera(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#FFF", fontSize: "12px" }}>
                  {videoInputDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId} style={{ background: "#0F1715" }}>{d.label || `Camera ${i + 1}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#E2E8F0", display: "block", marginBottom: "6px" }}>Microphone Device</label>
                <select value={selectedAudioInput} onChange={(e) => switchMicrophone(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#FFF", fontSize: "12px" }}>
                  {audioInputDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId} style={{ background: "#0F1715" }}>{d.label || `Microphone ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* MOBILE MORE ACTIONS BOTTOM SHEET POPUP */}
      {activeDrawer === "more" && (
        <div style={{ position: "absolute", bottom: "60px", left: "50%", transform: "translateX(-50%)", width: "90%", maxWidth: "340px", background: "#0F1715", border: "1.5px solid rgba(52, 211, 153, 0.4)", borderRadius: "16px", padding: "14px", boxShadow: "0 10px 30px rgba(0,0,0,0.6)", zIndex: 40, display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#34D399" }}>More Meeting Options</span>
            <button type="button" onClick={() => setActiveDrawer("none")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}><X size={16} /></button>
          </div>

          {/* Network Adaptive Quality Quick Bar */}
          <div style={{ background: "rgba(255,255,255,0.04)", padding: "8px 10px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#34D399", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
              <Zap size={13} /> Quality Adjust (Prevent Delay)
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              {(["auto", "720p", "480p", "360p"] as VideoQualityPreset[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQualityChange(q)}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    borderRadius: "6px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    border: videoQuality === q ? "1px solid #34D399" : "1px solid rgba(255,255,255,0.1)",
                    background: videoQuality === q ? "#087A5B" : "rgba(255,255,255,0.06)",
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  {q === "auto" ? "Auto" : q === "360p" ? "Saver" : q}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            <button
              type="button"
              onClick={() => { setActiveDrawer("chat"); setUnreadChatCount(0); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              <MessageSquare size={16} color="#34D399" />
              <span>Chat {unreadChatCount > 0 ? `(${unreadChatCount})` : ""}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDrawer("participants")}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              <Users size={16} color="#34D399" />
              <span>Peers ({totalCount})</span>
            </button>

            <button
              type="button"
              onClick={() => { toggleScreenShare(); setActiveDrawer("none"); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "10px", background: isScreenSharing ? "#087A5B" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              {isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} color="#34D399" />}
              <span>{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
            </button>

            <button
              type="button"
              onClick={() => { switchCamera(); setActiveDrawer("none"); }}
              disabled={isSwitchingCamera || isVideoOff}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: isVideoOff ? "#64748B" : "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              <RefreshCw size={16} color="#34D399" />
              <span>Flip Camera</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => { refreshDevices(); setActiveDrawer("settings"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            <Settings size={16} color="#34D399" />
            <span>Audio & Video Device Settings</span>
          </button>
        </div>
      )}

      {/* Floating Bottom Action Bar (Ultra-responsive on Mobile) */}
      <footer
        style={{
          height: "64px",
          minHeight: "64px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px",
          borderTop: "1px solid rgba(255, 255, 255, 0.12)",
          background: "#0A110F",
          position: "relative",
          zIndex: 300,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={() => toggleAudio()}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              border: "none",
              background: isAudioMuted ? "#EF4444" : "rgba(255, 255, 255, 0.14)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isAudioMuted ? <MicOff size={19} /> : <Mic size={19} />}
          </button>

          <button
            type="button"
            onClick={() => toggleVideo()}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              border: "none",
              background: isVideoOff ? "#EF4444" : "rgba(255, 255, 255, 0.14)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
          >
            {isVideoOff ? <VideoOff size={19} /> : <Video size={19} />}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === "more" ? "none" : "more")}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              border: "1.5px solid rgba(52, 211, 153, 0.5)",
              background: activeDrawer === "more" ? "#087A5B" : "rgba(255, 255, 255, 0.12)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
            }}
            title="More Options"
          >
            <MoreVertical size={19} />
            {unreadChatCount > 0 && (
              <span style={{ position: "absolute", top: "2px", right: "2px", width: "14px", height: "14px", borderRadius: "50%", background: "#34D399" }} />
            )}
          </button>

          <button
            type="button"
            onClick={handleLeaveMeeting}
            style={{
              padding: "0 14px",
              height: "42px",
              borderRadius: "99px",
              background: "#EF4444",
              border: "none",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <PhoneOff size={15} />
            <span>End</span>
          </button>

          {isHostUser && (
            <button
              type="button"
              onClick={handleEndMeetingAll}
              style={{
                padding: "0 10px",
                height: "42px",
                borderRadius: "99px",
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #EF4444",
                color: "#FCA5A5",
                fontWeight: 700,
                fontSize: "11px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title="End call for all participants"
            >
              All
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function RemotePeerTile({
  peer,
  isHost,
  onMute,
  onCameraOff,
  onKick,
  onPin,
  compact,
}: {
  peer: PeerConnection;
  isHost: boolean;
  onMute: () => void;
  onCameraOff: () => void;
  onKick: () => void;
  onPin: () => void;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !peer.stream) return;

    videoEl.srcObject = peer.stream;
    videoEl.play().catch((err) => console.warn("Remote peer video playback catch:", err));

    const handleStreamTrackEvent = () => {
      if (videoEl && peer.stream) {
        videoEl.srcObject = peer.stream;
        videoEl.play().catch(() => {});
      }
    };

    peer.stream.addEventListener("addtrack", handleStreamTrackEvent);
    peer.stream.addEventListener("removetrack", handleStreamTrackEvent);

    return () => {
      if (peer.stream) {
        peer.stream.removeEventListener("addtrack", handleStreamTrackEvent);
        peer.stream.removeEventListener("removetrack", handleStreamTrackEvent);
      }
    };
  }, [peer.stream]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: compact ? "90px" : "180px",
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
          objectFit: peer.isScreenSharing ? "contain" : "cover",
          display: peer.isVideoOff && !peer.isScreenSharing ? "none" : "block",
        }}
      />

      {peer.isVideoOff && !peer.isScreenSharing && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Avatar name={peer.name} avatar={peer.avatar} size={compact ? 36 : 56} />
        </div>
      )}

      <div style={{ position: "absolute", bottom: "8px", left: "10px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", padding: "3px 7px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
        <span>{peer.name}</span>
        {peer.isAudioMuted && <MicOff size={11} color="#EF4444" />}
      </div>

      {!compact && (
        <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "4px" }}>
          <button
            type="button"
            onClick={onPin}
            style={{ background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "6px", padding: "5px", color: "#FFFFFF", cursor: "pointer" }}
            title="Pin Video"
          >
            <Pin size={13} />
          </button>

          {isHost && (
            <button
              type="button"
              onClick={onKick}
              style={{ background: "#DC2626", border: "none", borderRadius: "6px", padding: "5px", color: "#FFFFFF", cursor: "pointer" }}
              title="Kick Participant Out"
            >
              <UserX size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RemotePinnedVideo({ peer }: { peer?: PeerConnection | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !peer?.stream) return;

    videoEl.srcObject = peer.stream;
    videoEl.play().catch((err) => console.warn("Remote pinned video playback catch:", err));

    const handleStreamTrackEvent = () => {
      if (videoEl && peer?.stream) {
        videoEl.srcObject = peer.stream;
        videoEl.play().catch(() => {});
      }
    };

    peer.stream.addEventListener("addtrack", handleStreamTrackEvent);
    peer.stream.addEventListener("removetrack", handleStreamTrackEvent);

    return () => {
      if (peer?.stream) {
        peer.stream.removeEventListener("addtrack", handleStreamTrackEvent);
        peer.stream.removeEventListener("removetrack", handleStreamTrackEvent);
      }
    };
  }, [peer?.stream]);

  if (!peer) {
    return <div style={{ color: "#94A3B8", fontSize: "13px" }}>Pinned participant not available</div>;
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: peer.isScreenSharing ? "contain" : "cover",
          display: peer.isVideoOff && !peer.isScreenSharing ? "none" : "block",
        }}
      />
      {peer.isVideoOff && !peer.isScreenSharing && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Avatar name={peer.name} avatar={peer.avatar} size={64} />
        </div>
      )}
    </div>
  );
}
