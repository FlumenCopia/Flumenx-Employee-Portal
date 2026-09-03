"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  UserPlus,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/icons";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";

type CallMode = "incoming" | "outgoing" | "connected";

export interface RemotePeer {
  socketId: string;
  userId?: string;
  name: string;
  avatar?: string;
  stream: MediaStream;
}

function RemotePeerAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline />;
}

function ParticipantVideoTile({ peer }: { peer: RemotePeer }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [peer.stream]);

  const hasVideo = peer.stream && peer.stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "180px",
        background: "#18231F",
        borderRadius: "12px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(255,255,255,0.1)",
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
          display: hasVideo ? "block" : "none",
        }}
      />
      {!hasVideo && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "16px" }}>
          <Avatar name={peer.name} avatar={peer.avatar} size={56} />
          <span style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: 700 }}>{peer.name}</span>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          left: "8px",
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(4px)",
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: 700,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          zIndex: 5,
        }}
      >
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
        {peer.name}
      </div>
    </div>
  );
}

type Props = {
  mode: CallMode;
  callType: "audio" | "video";
  partnerName: string;
  partnerAvatar?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onEndCall: () => void;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  remotePeers?: RemotePeer[];
  isGroup?: boolean;
  participants?: { id: string; name: string; avatar?: string; status: "calling" | "connected" }[];
  onInvitePerson?: (user: { id: string; name: string; avatar?: string }) => void;
};

export function DirectCallModal({
  mode,
  callType,
  partnerName,
  partnerAvatar,
  onAccept,
  onDecline,
  onEndCall,
  localStream,
  remoteStream,
  remotePeers,
  isGroup,
  participants,
  onInvitePerson,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio");
  const [callDuration, setCallDuration] = useState(0);

  // In-call Add Person modal state
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [addPersonSearch, setAddPersonSearch] = useState("");
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [loadingColleagues, setLoadingColleagues] = useState(false);

  useEffect(() => {
    if (showAddPerson && colleagues.length === 0) {
      setLoadingColleagues(true);
      api<any[]>("/chat/users/")
        .then((data) => setColleagues(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setLoadingColleagues(false));
    }
  }, [showAddPerson, colleagues.length]);

  const [hasLocalVideoTrack, setHasLocalVideoTrack] = useState(false);

  // Monitor live video tracks on localStream
  useEffect(() => {
    if (!localStream) {
      setHasLocalVideoTrack(false);
      return;
    }
    const updateTrackStatus = () => {
      const vTracks = localStream.getVideoTracks();
      const isLive = vTracks.length > 0 && vTracks.some((t) => t.readyState === "live" && t.enabled);
      setHasLocalVideoTrack(isLive);
    };

    updateTrackStatus();
    localStream.addEventListener("addtrack", updateTrackStatus);
    localStream.addEventListener("removetrack", updateTrackStatus);
    return () => {
      localStream.removeEventListener("addtrack", updateTrackStatus);
      localStream.removeEventListener("removetrack", updateTrackStatus);
    };
  }, [localStream]);

  // Robust callback ref for local video attachment
  const attachLocalVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      (localVideoRef as any).current = el;
      if (el && localStream) {
        el.defaultMuted = true;
        el.muted = true;
        el.setAttribute("muted", "true");
        el.setAttribute("playsinline", "true");
        el.setAttribute("autoplay", "true");
        if (el.srcObject !== localStream) {
          el.srcObject = localStream;
        }
        el.play().catch((err) => {
          console.warn("[WebRTC] Local video play error:", err);
        });
      }
    },
    [localStream]
  );

  // Robust callback ref for remote video attachment
  const attachRemoteVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      (remoteVideoRef as any).current = el;
      if (el && remoteStream) {
        el.setAttribute("playsinline", "true");
        el.setAttribute("autoplay", "true");
        if (el.srcObject !== remoteStream) {
          el.srcObject = remoteStream;
        }
        el.play().catch((err) => {
          console.warn("[WebRTC] Remote video play error:", err);
        });
      }
    },
    [remoteStream]
  );

  // Local stream attachment & camera auto-recovery effect
  useEffect(() => {
    let active = true;
    const videoEl = localVideoRef.current;

    const syncLocalStream = async () => {
      let stream = localStream;

      // If call is video but localStream has no video tracks, attempt camera recovery
      if (callType === "video" && (!stream || stream.getVideoTracks().length === 0)) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            audio: false,
          });
          if (!active) return;
          if (stream) {
            camStream.getVideoTracks().forEach((t) => stream!.addTrack(t));
          } else {
            stream = camStream;
          }
          setHasLocalVideoTrack(true);
        } catch (camErr) {
          console.warn("[WebRTC] Camera auto-recovery failed:", camErr);
        }
      }

      if (!active || !videoEl || !stream) return;

      videoEl.defaultMuted = true;
      videoEl.muted = true;
      videoEl.setAttribute("muted", "true");
      videoEl.setAttribute("playsinline", "true");
      videoEl.setAttribute("autoplay", "true");

      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }

      const playSafely = () => {
        videoEl.play().catch((err) => {
          console.warn("[WebRTC] Local video play error:", err);
        });
      };

      videoEl.onloadedmetadata = playSafely;
      playSafely();
    };

    syncLocalStream();

    return () => {
      active = false;
    };
  }, [localStream, mode, callType]);

  // Remote stream attachment (Both Audio & Video)
  useEffect(() => {
    if (remoteStream) {
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch((err) => {
          console.warn("[WebRTC] Remote audio autoplay blocked by browser policy:", err);
        });
      }
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((err) => {
          console.warn("[WebRTC] Remote video autoplay error:", err);
        });
      }
    }
  }, [remoteStream, mode, callType]);

  // Call timer when connected
  useEffect(() => {
    if (mode !== "connected") return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [mode]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted((prev) => !prev);
    }
  };

  const toggleVideo = async () => {
    if (localStream) {
      const vTracks = localStream.getVideoTracks();
      if (vTracks.length === 0) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            audio: false,
          });
          camStream.getVideoTracks().forEach((t) => localStream.addTrack(t));
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(() => {});
          }
          setIsVideoOff(false);
          setHasLocalVideoTrack(true);
          return;
        } catch {
          toast.error("Could not access camera");
          return;
        }
      }

      vTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff((prev) => !prev);
    }
  };

  const handleAcceptClick = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }
    if (onAccept) onAccept();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      {/* Dedicated Hidden Audio Element for Remote Stream (Always mounted) */}
      {/* Dedicated Hidden Audio Element for Remote Stream (Always mounted) */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      {/* Audio playback for each multi-peer remote stream */}
      {remotePeers && remotePeers.map((p) => <RemotePeerAudio key={p.socketId} stream={p.stream} />)}

      <div
        style={{
          width: "100%",
          maxWidth: callType === "video" && mode === "connected" ? (remotePeers && remotePeers.length > 1 ? "920px" : "680px") : (remotePeers && remotePeers.length > 1 ? "560px" : "400px"),
          background: "#121816",
          borderRadius: "20px",
          overflow: "hidden",
          border: "1.5px solid rgba(16, 185, 129, 0.3)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          transition: "all 0.3s ease",
        }}
      >
        {mode !== "connected" ? (
          /* RINGING / INCOMING / CALLING SCREEN */
          <div style={{ padding: "36px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ position: "relative", marginBottom: "20px" }}>
              <div
                style={{
                  position: "absolute",
                  inset: "-12px",
                  borderRadius: "50%",
                  border: "2px solid #10b981",
                  animation: "pulseRing 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite",
                }}
              />
              <Avatar name={partnerName} avatar={partnerAvatar} size={84} />
            </div>

            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px 0", color: "#FFFFFF" }}>
              {partnerName}
            </h3>

            <p style={{ fontSize: "13px", color: "var(--muted, #94A3B8)", margin: "0 0 28px 0" }}>
              {mode === "incoming"
                ? `Incoming ${isGroup ? "Group " : ""}${callType === "video" ? "Video" : "Voice"} Call...`
                : `Ringing ${partnerName}...`}
            </p>

            <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
              {mode === "incoming" ? (
                <>
                  <button
                    onClick={onDecline || onEndCall}
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "#ef4444",
                      color: "#fff",
                      border: 0,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
                      transition: "transform 0.15s ease",
                    }}
                    title="Decline Call"
                  >
                    <PhoneOff size={24} />
                  </button>

                  <button
                    onClick={handleAcceptClick}
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "#10b981",
                      color: "#fff",
                      border: 0,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "0 4px 15px rgba(16, 185, 129, 0.4)",
                      animation: "pulse 1.5s infinite",
                      transition: "transform 0.15s ease",
                    }}
                    title="Accept Call"
                  >
                    <Phone size={24} />
                  </button>
                </>
              ) : (
                <button
                  onClick={onEndCall}
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#ef4444",
                    color: "#fff",
                    border: 0,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
                    transition: "transform 0.15s ease",
                  }}
                  title="Cancel Call"
                >
                  <PhoneOff size={24} />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* CONNECTED CALL SCREEN */
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header info */}
            <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                  {partnerName} {remotePeers && remotePeers.length > 1 && `(${remotePeers.length + 1} People)`}
                </span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#34d399", fontFamily: "monospace" }}>
                {formatDuration(callDuration)}
              </span>
            </div>

            {/* In-Call Active/Calling Participants Bar */}
            {participants && participants.length > 0 && (
              <div style={{ padding: "8px 16px", background: "rgba(16, 185, 129, 0.08)", borderBottom: "1px solid rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", gap: "8px", overflowX: "auto" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981", whiteSpace: "nowrap" }}>In Call:</span>
                {participants.map((p) => (
                  <span
                    key={p.id}
                    style={{
                      fontSize: "11px",
                      background: p.status === "calling" ? "rgba(245, 158, 11, 0.2)" : "rgba(255,255,255,0.1)",
                      color: p.status === "calling" ? "#fbbf24" : "#fff",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name} {p.status === "calling" && "(Ringing...)"}
                  </span>
                ))}
              </div>
            )}

            {/* Video Streams / Audio Avatar Canvas */}
            <div style={{ position: "relative", minHeight: callType === "video" ? "380px" : "240px", background: "#0c0c10", display: "grid", placeItems: "center" }}>
              {callType === "video" ? (
                remotePeers && remotePeers.length > 1 ? (
                  /* MULTI-PEER RESPONSIVE GRID (2, 3, 4+ participants) */
                  <div
                    style={{
                      width: "100%",
                      minHeight: "380px",
                      display: "grid",
                      gridTemplateColumns: remotePeers.length === 2 ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "10px",
                      padding: "12px",
                      background: "#0c0c10",
                      position: "relative",
                    }}
                  >
                    {remotePeers.map((peer) => (
                      <ParticipantVideoTile key={peer.socketId} peer={peer} />
                    ))}
                    {/* Floating Local PIP */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        right: "16px",
                        width: "140px",
                        height: "100px",
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "2px solid #10b981",
                        background: "#18181b",
                        boxShadow: "0 6px 15px rgba(0,0,0,0.6)",
                        zIndex: 40,
                        isolation: "isolate",
                      }}
                    >
                      <video
                        ref={(el) => {
                          (localVideoRef as any).current = el;
                          attachLocalVideo(el);
                        }}
                        autoPlay
                        playsInline
                        muted
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          v.muted = true;
                          v.play().catch(() => {});
                        }}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          transform: "scaleX(-1)",
                          WebkitTransform: "scaleX(-1)",
                          display: isVideoOff ? "none" : "block",
                          background: "#18181b",
                        }}
                      />
                      {isVideoOff && (
                        <div style={{ width: "100%", height: "100%", background: "#18181b", display: "grid", placeItems: "center" }}>
                          <VideoOff size={20} color="#94a3b8" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* 1:1 CALL MAIN REMOTE + LOCAL PIP */
                  <>
                    <video
                      ref={attachRemoteVideo}
                      autoPlay
                      playsInline
                      style={{ width: "100%", height: "100%", maxHeight: "420px", objectFit: "cover" }}
                    />

                    {/* Local Video (Floating Picture-in-Picture) */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        right: "16px",
                        width: "140px",
                        height: "100px",
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "2px solid #10b981",
                        background: "#18181b",
                        boxShadow: "0 6px 15px rgba(0,0,0,0.5)",
                        zIndex: 10,
                        isolation: "isolate",
                      }}
                    >
                      <video
                        ref={(el) => {
                          (localVideoRef as any).current = el;
                          attachLocalVideo(el);
                        }}
                        autoPlay
                        playsInline
                        muted
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          v.muted = true;
                          v.play().catch(() => {});
                        }}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          transform: "scaleX(-1)",
                          WebkitTransform: "scaleX(-1)",
                          display: isVideoOff ? "none" : "block",
                          background: "#18181b",
                        }}
                      />
                      {isVideoOff ? (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#18181b",
                            gap: "4px",
                          }}
                        >
                          <VideoOff size={22} color="#94a3b8" />
                          <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Camera Off</span>
                        </div>
                      ) : !hasLocalVideoTrack ? (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#18181b",
                            gap: "4px",
                            position: "absolute",
                            inset: 0,
                            cursor: "pointer",
                          }}
                          onClick={toggleVideo}
                          title="Click to turn on camera"
                        >
                          <VideoOff size={22} color="#f59e0b" />
                          <span style={{ fontSize: "9px", color: "#f59e0b", fontWeight: 700 }}>Enable Cam</span>
                        </div>
                      ) : null}
                    </div>
                  </>
                )
              ) : (
                /* Audio Only Avatar View */
                remotePeers && remotePeers.length > 1 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "24px", padding: "36px 20px" }}>
                    {remotePeers.map((peer) => (
                      <div key={peer.socketId} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <div style={{ position: "relative" }}>
                          <div
                            style={{
                              position: "absolute",
                              inset: "-8px",
                              borderRadius: "50%",
                              border: "2px solid #10b981",
                              animation: "pulseRing 2.5s infinite",
                            }}
                          />
                          <Avatar name={peer.name} avatar={peer.avatar} size={64} />
                        </div>
                        <span style={{ fontSize: "12px", color: "#fff", fontWeight: 700 }}>{peer.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", padding: "36px 0" }}>
                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          position: "absolute",
                          inset: "-10px",
                          borderRadius: "50%",
                          border: "2px solid #10b981",
                          animation: "pulseRing 2.5s infinite",
                        }}
                      />
                      <Avatar name={partnerName} avatar={partnerAvatar} size={84} />
                    </div>
                    <span style={{ fontSize: "13px", color: "#34D399", fontWeight: 700 }}>FLUMENX Audio Call Connected</span>
                  </div>
                )
              )}
            </div>

            {/* Bottom Controls */}
            <div style={{ padding: "16px 20px", background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", gap: "16px" }}>
              <button
                onClick={toggleAudio}
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "50%",
                  background: isAudioMuted ? "#ef4444" : "rgba(255,255,255,0.1)",
                  color: "#fff",
                  border: 0,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  transition: "all 0.15s ease",
                }}
                title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {callType === "video" && (
                <button
                  onClick={toggleVideo}
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "50%",
                    background: isVideoOff || !hasLocalVideoTrack ? "#ef4444" : "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: 0,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    transition: "all 0.15s ease",
                  }}
                  title={isVideoOff || !hasLocalVideoTrack ? "Turn Camera On" : "Turn Camera Off"}
                >
                  {isVideoOff || !hasLocalVideoTrack ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

              {/* Add Person to Call (Native In-App) */}
              <button
                type="button"
                onClick={() => setShowAddPerson((prev) => !prev)}
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "50%",
                  background: showAddPerson ? "#10b981" : "rgba(255,255,255,0.12)",
                  color: "#fff",
                  border: 0,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  transition: "all 0.15s ease",
                }}
                title="Add Colleague to Call"
              >
                <UserPlus size={20} />
              </button>

              <button
                onClick={onEndCall}
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "#ef4444",
                  color: "#fff",
                  border: 0,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
                  transition: "transform 0.15s ease",
                }}
                title="End Call"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          </div>
        )}

        {/* IN-CALL ADD PERSON MODAL OVERLAY */}
        {showAddPerson && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(10, 15, 13, 0.96)",
              backdropFilter: "blur(12px)",
              zIndex: 200,
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              borderRadius: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserPlus size={18} color="#10b981" />
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#fff" }}>Add People to Call</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPerson(false)}
                style={{ background: "transparent", border: 0, color: "#94a3b8", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search colleague by name..."
              value={addPersonSearch}
              onChange={(e) => setAddPersonSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontSize: "13px",
                marginBottom: "12px",
                outline: "none",
              }}
            />

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {loadingColleagues ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: "13px" }}>Loading colleagues...</div>
              ) : colleagues.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: "13px" }}>No colleagues found.</div>
              ) : (
                colleagues
                  .filter((c) => !addPersonSearch || c.name?.toLowerCase().includes(addPersonSearch.toLowerCase()))
                  .map((c) => {
                    const isAlreadyInCall = participants?.some((p) => String(p.id) === String(c.id || c.user_id));
                    return (
                      <div
                        key={c.id || c.user_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Avatar name={c.name} avatar={c.avatar} size={34} />
                          <div>
                            <b style={{ fontSize: "13px", color: "#fff", display: "block" }}>{c.name}</b>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>{c.department || c.role || "Colleague"}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isAlreadyInCall}
                          onClick={() => {
                            if (onInvitePerson) {
                              onInvitePerson({ id: String(c.user_id || c.id), name: c.name, avatar: c.avatar });
                            }
                            setShowAddPerson(false);
                          }}
                          style={{
                            padding: "6px 14px",
                            fontSize: "12px",
                            fontWeight: 700,
                            borderRadius: "7px",
                            border: 0,
                            background: isAlreadyInCall ? "rgba(255,255,255,0.1)" : "#10b981",
                            color: isAlreadyInCall ? "#94a3b8" : "#ffffff",
                            cursor: isAlreadyInCall ? "default" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {isAlreadyInCall ? "Calling..." : <><Phone size={12} /> Call</>}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulseRing {
          0% {
            transform: scale(0.9);
            opacity: 0.8;
          }
          50% {
            opacity: 0.3;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
