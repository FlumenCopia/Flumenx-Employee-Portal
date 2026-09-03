"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { getGlobalSocket } from "@/lib/socket";
import { DirectCallModal } from "./DirectCallModal";
import { toast } from "@/components/ToastContext";
import { api } from "@/lib/api";

import { soundService } from "@/lib/soundService";

export type CallType = "audio" | "video";
export type CallStateMode = "incoming" | "outgoing" | "connected";

export interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  status: "calling" | "connected";
}

export interface RemotePeer {
  socketId: string;
  userId?: string;
  name: string;
  avatar?: string;
  stream: MediaStream;
}

export interface ActiveCall {
  mode: CallStateMode;
  callType: CallType;
  partnerId: string;
  partnerSocketId?: string;
  partnerName: string;
  partnerAvatar?: string;
  conversationId?: string;
  roomId?: string;
  isGroup?: boolean;
  participants?: CallParticipant[];
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:global.stun.twilio.com:3478" },
    { urls: "stun:openrelay.metered.ca:80" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

interface WebRTCContextValue {
  activeCall: ActiveCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remotePeers: RemotePeer[];
  startCall: (params: {
    toUserId: string;
    partnerName: string;
    partnerAvatar?: string;
    callType: CallType;
    conversationId?: string;
  }) => Promise<void>;
  startGroupCall: (params: {
    conversationId: string;
    conversationName: string;
    callType: CallType;
    memberIds?: string[];
  }) => Promise<void>;
  inviteToCall: (params: {
    id?: string;
    userId?: string;
    name: string;
    avatar?: string;
  }) => void;
  acceptCall: () => Promise<void>;
  endCall: () => void;
}

const WebRTCContext = createContext<WebRTCContextValue | null>(null);

export function WebRTCProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingRemoteCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingLocalCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const incomingOfferRef = useRef<any>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  activeCallRef.current = activeCall;
  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;

  // Request browser Notification permission on mount for calls & chats
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Call Ringing Lifecycle (Sound Effects)
  useEffect(() => {
    if (!activeCall) {
      soundService.stopAll();
      return;
    }
    if (activeCall.mode === "outgoing") {
      soundService.startOutgoingRing();
    } else if (activeCall.mode === "incoming") {
      soundService.startIncomingRingtone();
    } else if (activeCall.mode === "connected") {
      soundService.stopAll();
    }
    return () => {
      soundService.stopAll();
    };
  }, [activeCall?.mode]);

  const endCallCleanup = useCallback(() => {
    soundService.stopAll();
    const socket = getGlobalSocket();
    if (activeCallRef.current?.roomId && socket) {
      socket.emit("call:leave-room", { roomId: activeCallRef.current.roomId });
    }
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peerConnectionsRef.current.clear();
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((t) => t.stop());
      setRemoteStream(null);
    }
    setRemotePeers([]);
    pendingRemoteCandidatesRef.current = [];
    pendingLocalCandidatesRef.current = [];
    incomingOfferRef.current = null;
    setActiveCall(null);
  }, [localStream, remoteStream]);

  // Acquire media stream with robust fallback
  const acquireMediaStream = async (callType: CallType): Promise<MediaStream | null> => {
    try {
      if (callType === "video") {
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          });
        } catch (firstErr) {
          console.warn("[WebRTC] Ideal video constraint failed, trying basic video:true:", firstErr);
          try {
            return await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
              video: true,
            });
          } catch (errVideo) {
            console.warn("[WebRTC] Video capture failed, attempting audio only:", errVideo);
            toast.warning("Camera could not be accessed. Proceeding with audio only.");
            return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          }
        }
      } else {
        return await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      }
    } catch (err) {
      console.error("Failed to acquire user media:", err);
      return null;
    }
  };

  const createPeerConnection = useCallback((targetSocketId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getGlobalSocket();
        const partnerSocket = targetSocketId || activeCallRef.current?.partnerSocketId;
        if (partnerSocket && socket) {
          socket.emit("call:ice-candidate", {
            toSocketId: partnerSocket,
            candidate: event.candidate,
          });
        } else {
          pendingLocalCandidatesRef.current.push(event.candidate);
        }
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else if (event.track) {
        setRemoteStream(new MediaStream([event.track]));
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    return pc;
  }, []);

  const createPeerForSocket = useCallback(
    (targetSocketId: string, stream: MediaStream, meta?: { name?: string; avatar?: string; userId?: string }) => {
      const existing = peerConnectionsRef.current.get(targetSocketId);
      if (existing && existing.signalingState !== "closed") {
        return existing;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(targetSocketId, pc);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getGlobalSocket();
          socket?.emit("call:relay-ice", {
            toSocketId: targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const incomingStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
        setRemoteStream(incomingStream);
        setRemotePeers((prev) => {
          const filtered = prev.filter((p) => p.socketId !== targetSocketId);
          return [
            ...filtered,
            {
              socketId: targetSocketId,
              userId: meta?.userId,
              name: meta?.name || "Colleague",
              avatar: meta?.avatar,
              stream: incomingStream,
            },
          ];
        });
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          pc.restartIce();
        } else if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "closed") {
          setRemotePeers((prev) => prev.filter((p) => p.socketId !== targetSocketId));
        }
      };

      return pc;
    },
    []
  );

  // Listen to Socket.IO signaling events
  useEffect(() => {
    const socket = getGlobalSocket();
    if (!socket) return;

    const handleIncomingCall = (data: {
      fromUserId: string;
      fromSocketId: string;
      callerName: string;
      callerAvatar?: string;
      callType: CallType;
      sdpOffer: any;
      conversationId?: string;
      roomId?: string;
      isGroup?: boolean;
    }) => {
      incomingOfferRef.current = data.sdpOffer;
      setActiveCall({
        mode: "incoming",
        callType: data.callType || "audio",
        partnerId: data.fromUserId,
        partnerSocketId: data.fromSocketId,
        partnerName: data.callerName || "Colleague",
        partnerAvatar: data.callerAvatar,
        conversationId: data.conversationId,
        roomId: data.roomId,
        isGroup: data.isGroup || false,
      });

      // Browser Native Notification (rings/alerts even if minimized or on other tabs)
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          const notif = new Notification(`${data.callerName || "Colleague"} is calling...`, {
            body: `Incoming ${data.isGroup ? "Group " : ""}${data.callType === "video" ? "Video" : "Voice"} Call. Click to answer.`,
            icon: data.callerAvatar || "/icon.png",
            requireInteraction: true,
            tag: "flumenx-incoming-call",
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        } catch {}
      }
    };

    const handleCallAccepted = async (data: {
      fromSocketId: string;
      fromUserId: string;
      sdpAnswer: any;
      roomId?: string;
    }) => {
      const pc = peerConnectionRef.current;
      if (pc && data.sdpAnswer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer));

          // Flush queued local candidates
          while (pendingLocalCandidatesRef.current.length > 0) {
            const cand = pendingLocalCandidatesRef.current.shift();
            if (cand) {
              socket.emit("call:ice-candidate", {
                toSocketId: data.fromSocketId,
                candidate: cand,
              });
            }
          }

          // Apply queued remote candidates
          while (pendingRemoteCandidatesRef.current.length > 0) {
            const cand = pendingRemoteCandidatesRef.current.shift();
            if (cand) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }

          const resolvedRoomId = data.roomId || activeCallRef.current?.roomId;
          if (resolvedRoomId) {
            socket.emit("call:join-room", {
              roomId: resolvedRoomId,
              name: activeCallRef.current?.partnerName || "Colleague",
              callType: activeCallRef.current?.callType || "video",
            });
          }

          setActiveCall((prev) => (prev ? { ...prev, mode: "connected", partnerSocketId: data.fromSocketId, roomId: resolvedRoomId } : null));
        } catch (err) {
          console.error("Error setting remote description on accept:", err);
        }
      }
    };

    // MULTI-PEER MESH EVENTS
    const handlePeerJoined = async (data: {
      peerSocketId: string;
      userId: string;
      name: string;
      avatar?: string;
      callType?: CallType;
    }) => {
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await acquireMediaStream(activeCallRef.current?.callType || "video");
        if (stream) setLocalStream(stream);
      }
      if (!stream) return;

      const pc = createPeerForSocket(data.peerSocketId, stream, {
        name: data.name,
        avatar: data.avatar,
        userId: data.userId,
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:relay-offer", {
        toSocketId: data.peerSocketId,
        sdpOffer: offer,
        name: activeCallRef.current?.partnerName || "Colleague",
        roomId: activeCallRef.current?.roomId,
      });

      setActiveCall((prev) => {
        if (!prev) return null;
        const existing = prev.participants || [];
        const filtered = existing.filter((p) => p.id !== data.userId);
        return {
          ...prev,
          isGroup: true,
          participants: [...filtered, { id: data.userId, name: data.name, avatar: data.avatar, status: "connected" }],
        };
      });
    };

    const handleRelayOffer = async (data: {
      fromSocketId: string;
      fromUserId: string;
      sdpOffer: any;
      name: string;
      avatar?: string;
      roomId?: string;
    }) => {
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await acquireMediaStream(activeCallRef.current?.callType || "video");
        if (stream) setLocalStream(stream);
      }
      if (!stream) return;

      const pc = createPeerForSocket(data.fromSocketId, stream, {
        name: data.name,
        avatar: data.avatar,
        userId: data.fromUserId,
      });

      await pc.setRemoteDescription(new RTCSessionDescription(data.sdpOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:relay-answer", {
        toSocketId: data.fromSocketId,
        sdpAnswer: answer,
        roomId: data.roomId,
      });

      setActiveCall((prev) => {
        if (!prev) return null;
        const existing = prev.participants || [];
        const filtered = existing.filter((p) => p.id !== data.fromUserId);
        return {
          ...prev,
          mode: "connected",
          isGroup: true,
          participants: [...filtered, { id: data.fromUserId, name: data.name, avatar: data.avatar, status: "connected" }],
        };
      });
    };

    const handleRelayAnswer = async (data: { fromSocketId: string; sdpAnswer: any }) => {
      const pc = peerConnectionsRef.current.get(data.fromSocketId);
      if (pc && pc.signalingState !== "closed") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer)).catch((e) => console.warn(e));
        setActiveCall((prev) => (prev ? { ...prev, mode: "connected" } : null));
      }
    };

    const handleRelayIce = async (data: { fromSocketId: string; candidate: any }) => {
      const pc = peerConnectionsRef.current.get(data.fromSocketId);
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      }
    };

    const handlePeerLeft = (data: { peerSocketId: string; userId?: string }) => {
      const pc = peerConnectionsRef.current.get(data.peerSocketId);
      if (pc) {
        try {
          pc.close();
        } catch {}
        peerConnectionsRef.current.delete(data.peerSocketId);
      }
      setRemotePeers((prev) => prev.filter((p) => p.socketId !== data.peerSocketId));
      setActiveCall((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          participants: (prev.participants || []).filter((p) => p.id !== data.userId),
        };
      });
    };

    const handleIceCandidate = async (data: { fromSocketId: string; candidate: any }) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error("Error adding ice candidate:", err);
        }
      } else {
        pendingRemoteCandidatesRef.current.push(data.candidate);
      }
    };

    const handleCallRejected = (data?: { reason?: string }) => {
      toast.error(data?.reason || "Call was declined.");
      endCallCleanup();
    };

    const handleCallEnded = () => {
      toast.info("Call ended.");
      endCallCleanup();
    };

    const handleCallUnavailable = (data: { message?: string }) => {
      toast.error(data?.message || "The recipient is currently offline.");
      endCallCleanup();
    };

    const handleCallError = (data: { message?: string }) => {
      toast.error(data?.message || "Failed to establish call.");
      endCallCleanup();
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:rejected", handleCallRejected);
    socket.on("call:ended", handleCallEnded);
    socket.on("call:unavailable", handleCallUnavailable);
    socket.on("call:error", handleCallError);

    // Multi-peer listeners
    socket.on("call:peer-joined", handlePeerJoined);
    socket.on("call:relay-offer", handleRelayOffer);
    socket.on("call:relay-answer", handleRelayAnswer);
    socket.on("call:relay-ice", handleRelayIce);
    socket.on("call:peer-left", handlePeerLeft);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:rejected", handleCallRejected);
      socket.off("call:ended", handleCallEnded);
      socket.off("call:unavailable", handleCallUnavailable);
      socket.off("call:error", handleCallError);

      socket.off("call:peer-joined", handlePeerJoined);
      socket.off("call:relay-offer", handleRelayOffer);
      socket.off("call:relay-answer", handleRelayAnswer);
      socket.off("call:relay-ice", handleRelayIce);
      socket.off("call:peer-left", handlePeerLeft);
    };
  }, [endCallCleanup, createPeerForSocket, localStream]);

  // Start outgoing call
  const startCall = async (params: {
    toUserId: string;
    partnerName: string;
    partnerAvatar?: string;
    callType: CallType;
    conversationId?: string;
  }) => {
    const socket = getGlobalSocket();

    const roomId = params.conversationId ? `room_${params.conversationId}` : `call_${params.toUserId}_${Date.now()}`;

    // 1. Instantly display Outgoing Call UI Modal
    setActiveCall({
      mode: "outgoing",
      callType: params.callType,
      partnerId: params.toUserId,
      partnerName: params.partnerName,
      partnerAvatar: params.partnerAvatar,
      conversationId: params.conversationId,
      roomId,
    });

    // Join room so caller is in room for multi-party mesh
    socket?.emit("call:join-room", {
      roomId,
      name: "Me",
      callType: params.callType,
    });

    // 2. Trigger REST API call initiation so HTTP request shows in Network tab and notifies server
    api("/chat/call/initiate/", {
      method: "POST",
      body: JSON.stringify({
        to_user_id: params.toUserId,
        call_type: params.callType,
        conversation_id: params.conversationId,
      }),
    }).catch(() => {});

    try {
      const stream = await acquireMediaStream(params.callType);
      if (!stream) {
        toast.error("Could not access camera or microphone. Please check browser permissions.");
        endCallCleanup();
        return;
      }
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      pendingLocalCandidatesRef.current = [];
      pendingRemoteCandidatesRef.current = [];

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          if (activeCallRef.current?.partnerSocketId) {
            socket?.emit("call:ice-candidate", {
              toSocketId: activeCallRef.current.partnerSocketId,
              candidate: event.candidate,
            });
          } else {
            pendingLocalCandidatesRef.current.push(event.candidate);
          }
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else if (event.track) {
          setRemoteStream(new MediaStream([event.track]));
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          pc.restartIce();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit("call:start", {
          toUserId: params.toUserId,
          callType: params.callType,
          sdpOffer: offer,
          conversationId: params.conversationId,
          roomId,
        });
      }
    } catch (err: any) {
      console.error("Failed to start call:", err);
      endCallCleanup();
    }
  };

  // Start native group call
  const startGroupCall = async (params: {
    conversationId: string;
    conversationName: string;
    callType: CallType;
    memberIds?: string[];
  }) => {
    const socket = getGlobalSocket();
    const roomId = `room_${params.conversationId}`;

    setActiveCall({
      mode: "outgoing",
      callType: params.callType,
      partnerId: params.conversationId,
      partnerName: `${params.conversationName}`,
      conversationId: params.conversationId,
      roomId,
      isGroup: true,
      participants: [],
    });

    try {
      const stream = await acquireMediaStream(params.callType);
      if (!stream) {
        toast.error("Could not access camera or microphone. Please check permissions.");
        endCallCleanup();
        return;
      }
      setLocalStream(stream);

      // Caller joins room
      socket?.emit("call:join-room", {
        roomId,
        name: "Me",
        callType: params.callType,
      });

      socket?.emit("call:group-start", {
        conversationId: params.conversationId,
        conversationName: params.conversationName,
        callType: params.callType,
      });
    } catch (err: any) {
      console.error("Failed to start group call:", err);
      endCallCleanup();
    }
  };

  // Add/Invite colleague to ongoing call
  const inviteToCall = (params: { id?: string; userId?: string; name: string; avatar?: string }) => {
    const socket = getGlobalSocket();
    if (!socket || !activeCall) return;
    const targetId = String(params.userId || params.id || "");
    if (!targetId) return;

    const roomId = activeCall.roomId || (activeCall.conversationId ? `room_${activeCall.conversationId}` : `call_${activeCall.partnerId}`);

    // Ensure the inviter is in the room
    socket.emit("call:join-room", {
      roomId,
      name: "Me",
      callType: activeCall.callType,
    });

    socket.emit("call:invite-user", {
      toUserId: targetId,
      callType: activeCall.callType,
      conversationId: activeCall.conversationId,
      roomId,
    });

    setActiveCall((prev) => {
      if (!prev) return null;
      const existing = prev.participants || [];
      if (existing.some((p) => p.id === targetId)) return prev;
      return {
        ...prev,
        isGroup: true,
        roomId,
        participants: [
          ...existing,
          { id: targetId, name: params.name, avatar: params.avatar, status: "calling" },
        ],
      };
    });

    toast.info(`Calling ${params.name}...`);
  };

  // Accept incoming call
  const acceptCall = async () => {
    const socket = getGlobalSocket();
    if (!activeCall || !socket) return;

    try {
      const stream = await acquireMediaStream(activeCall.callType);
      if (!stream) {
        alert("Could not access camera or microphone. Please ensure permissions are granted.");
        endCallCleanup();
        return;
      }
      setLocalStream(stream);

      // 1. If 1:1 direct SDP offer is present, answer it
      if (incomingOfferRef.current && activeCall.partnerSocketId) {
        const pc = createPeerConnection(activeCall.partnerSocketId);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("call:accept", {
          toSocketId: activeCall.partnerSocketId,
          sdpAnswer: answer,
          roomId: activeCall.roomId,
        });

        // Process any queued candidates received before setRemoteDescription
        while (pendingRemoteCandidatesRef.current.length > 0) {
          const cand = pendingRemoteCandidatesRef.current.shift();
          if (cand) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }
      }

      // 2. If this call has a roomId (group call or colleague added), join the mesh room
      if (activeCall.roomId) {
        socket.emit("call:join-room", {
          roomId: activeCall.roomId,
          name: activeCall.partnerName,
          callType: activeCall.callType,
        });
      }

      setActiveCall((prev) => (prev ? { ...prev, mode: "connected" } : null));
    } catch (err) {
      console.error("Failed to accept call:", err);
      endCallCleanup();
    }
  };

  // Decline / End Call
  const endCall = () => {
    const socket = getGlobalSocket();
    if (activeCall && activeCall.partnerSocketId && socket) {
      if (activeCall.mode === "incoming") {
        socket.emit("call:reject", { toSocketId: activeCall.partnerSocketId });
      } else {
        socket.emit("call:end", { toSocketId: activeCall.partnerSocketId });
      }
    }
    endCallCleanup();
  };

  return (
    <WebRTCContext.Provider
      value={{
        activeCall,
        localStream,
        remoteStream,
        remotePeers,
        startCall,
        startGroupCall,
        inviteToCall,
        acceptCall,
        endCall,
      }}
    >
      {children}

      {/* Global Direct Call Modal (Single Global Instance) */}
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
          remotePeers={remotePeers}
          isGroup={activeCall.isGroup}
          participants={activeCall.participants}
          onInvitePerson={inviteToCall}
        />
      )}
    </WebRTCContext.Provider>
  );
}

export function useWebRTC() {
  const context = useContext(WebRTCContext);
  if (!context) {
    console.warn("[WebRTC] useWebRTC() was called outside <WebRTCProvider>.");
    return {
      activeCall: null,
      localStream: null,
      remoteStream: null,
      remotePeers: [],
      startCall: async () => {
        console.error("[WebRTC] startCall called outside WebRTCProvider");
        toast.error("Call service unavailable, please refresh page.");
      },
      startGroupCall: async () => {},
      inviteToCall: () => {},
      acceptCall: async () => {},
      endCall: () => {},
    };
  }
  return context;
}
