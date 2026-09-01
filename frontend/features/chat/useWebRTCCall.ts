"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getGlobalSocket } from "@/lib/socket";

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

export function useWebRTCCall(currentUserId?: string) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localQueuedCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const incomingOfferRef = useRef<any>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  activeCallRef.current = activeCall;

  // Cleanup helper
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
    pendingCandidatesRef.current = [];
    localQueuedCandidatesRef.current = [];
    incomingOfferRef.current = null;
    setActiveCall(null);
  }, [localStream, remoteStream]);

  // Setup PeerConnection
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
          localQueuedCandidatesRef.current.push(event.candidate);
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

          // Send any local ICE candidates queued before receiver socket was known
          while (localQueuedCandidatesRef.current.length > 0) {
            const cand = localQueuedCandidatesRef.current.shift();
            if (cand) {
              socket.emit("call:ice-candidate", {
                toSocketId: data.fromSocketId,
                candidate: cand,
              });
            }
          }

          // Apply any pending remote candidates queued before remote description
          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
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
        pendingCandidatesRef.current.push(data.candidate);
      }
    };

    const handleCallRejected = (data: { reason?: string }) => {
      endCallCleanup();
    };

    const handleCallEnded = () => {
      endCallCleanup();
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:rejected", handleCallRejected);
    socket.on("call:ended", handleCallEnded);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:rejected", handleCallRejected);
      socket.off("call:ended", handleCallEnded);
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
    if (!socket) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: params.callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      setLocalStream(stream);

      setActiveCall({
        mode: "outgoing",
        callType: params.callType,
        partnerId: params.toUserId,
        partnerName: params.partnerName,
        partnerAvatar: params.partnerAvatar,
        conversationId: params.conversationId,
      });

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      localQueuedCandidatesRef.current = [];
      pendingCandidatesRef.current = [];

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          if (activeCallRef.current?.partnerSocketId) {
            socket.emit("call:ice-candidate", {
              toSocketId: activeCallRef.current.partnerSocketId,
              candidate: event.candidate,
            });
          } else {
            localQueuedCandidatesRef.current.push(event.candidate);
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

      socket.emit("call:start", {
        toUserId: params.toUserId,
        callType: params.callType,
        sdpOffer: offer,
        conversationId: params.conversationId,
      });
    } catch (err: any) {
      console.error("Failed to acquire user media or start call:", err);
      endCallCleanup();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    const socket = getGlobalSocket();
    if (!activeCall || !activeCall.partnerSocketId || !socket) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: activeCall.callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
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
      while (pendingCandidatesRef.current.length > 0) {
        const cand = pendingCandidatesRef.current.shift();
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

  return {
    activeCall,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    endCall,
  };
}
