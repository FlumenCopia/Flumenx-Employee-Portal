"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { getGlobalSocket } from "@/lib/socket";
import { DirectCallModal } from "./DirectCallModal";
import { toast } from "@/components/ToastContext";
import { api } from "@/lib/api";

export type CallType = "audio" | "video";
export type CallStateMode = "incoming" | "outgoing" | "connected";

export interface ActiveCall {
  mode: CallStateMode;
  callType: CallType;
  partnerId: string;
  partnerSocketId?: string;
  partnerName: string;
  partnerAvatar?: string;
  conversationId?: string;
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
  startCall: (params: {
    toUserId: string;
    partnerName: string;
    partnerAvatar?: string;
    callType: CallType;
    conversationId?: string;
  }) => Promise<void>;
  acceptCall: () => Promise<void>;
  endCall: () => void;
}

const WebRTCContext = createContext<WebRTCContextValue | null>(null);

export function WebRTCProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingRemoteCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingLocalCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const incomingOfferRef = useRef<any>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  activeCallRef.current = activeCall;

  const endCallCleanup = useCallback(() => {
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
      });
    };

    const handleCallAccepted = async (data: {
      fromSocketId: string;
      fromUserId: string;
      sdpAnswer: any;
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

          setActiveCall((prev) => (prev ? { ...prev, mode: "connected", partnerSocketId: data.fromSocketId } : null));
        } catch (err) {
          console.error("Error setting remote description on accept:", err);
        }
      }
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

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:rejected", handleCallRejected);
      socket.off("call:ended", handleCallEnded);
      socket.off("call:unavailable", handleCallUnavailable);
      socket.off("call:error", handleCallError);
    };
  }, [endCallCleanup]);

  // Start outgoing call
  const startCall = async (params: {
    toUserId: string;
    partnerName: string;
    partnerAvatar?: string;
    callType: CallType;
    conversationId?: string;
  }) => {
    const socket = getGlobalSocket();

    // 1. Instantly display Outgoing Call UI Modal
    setActiveCall({
      mode: "outgoing",
      callType: params.callType,
      partnerId: params.toUserId,
      partnerName: params.partnerName,
      partnerAvatar: params.partnerAvatar,
      conversationId: params.conversationId,
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
        });
      }
    } catch (err: any) {
      console.error("Failed to start call:", err);
      endCallCleanup();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    const socket = getGlobalSocket();
    if (!activeCall || !activeCall.partnerSocketId || !socket) return;

    try {
      const stream = await acquireMediaStream(activeCall.callType);
      if (!stream) {
        alert("Could not access camera or microphone. Please ensure permissions are granted.");
        endCallCleanup();
        return;
      }
      setLocalStream(stream);

      const pc = createPeerConnection(activeCall.partnerSocketId);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      if (incomingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:accept", {
        toSocketId: activeCall.partnerSocketId,
        sdpAnswer: answer,
      });

      // Process any queued candidates received before setRemoteDescription
      while (pendingRemoteCandidatesRef.current.length > 0) {
        const cand = pendingRemoteCandidatesRef.current.shift();
        if (cand) {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
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
        startCall,
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
      startCall: async () => {
        console.error("[WebRTC] startCall called outside WebRTCProvider");
        toast.error("Call service unavailable, please refresh page.");
      },
      acceptCall: async () => {},
      endCall: () => {},
    };
  }
  return context;
}
