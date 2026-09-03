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
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio");
  const [callDuration, setCallDuration] = useState(0);

  // Robust callback ref for local video attachment
  const attachLocalVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      (localVideoRef as any).current = el;
      if (el && localStream) {
        if (el.srcObject !== localStream) {
          el.srcObject = localStream;
        }
        el.muted = true;
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

  // Local stream attachment effect (triggers when localStream or mode changes to connected)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => {});
    }
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

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff((prev) => !prev);
    }
  };

  const handleUpgradeToGroupCall = async () => {
    try {
      const res = await api<any>("/meetings/create-instant/", {
        method: "POST",
        body: JSON.stringify({
          title: `Group Call with ${partnerName}`,
        }),
      });
      const code = res?.meeting_code || res?.code || "flumenx-hq";
      const meetUrl = `${window.location.origin}/meet/${code}`;
      await navigator.clipboard.writeText(meetUrl).catch(() => {});
      toast.success("Group meeting link created & copied! Opening room...");
      window.open(`/meet/${code}`, "_blank");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create group meeting");
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
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div
        style={{
          width: "100%",
          maxWidth: callType === "video" && mode === "connected" ? "680px" : "400px",
          background: "#121816",
          borderRadius: "20px",
          overflow: "hidden",
          border: "1.5px solid rgba(16, 185, 129, 0.3)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
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
                ? `Incoming ${callType === "video" ? "Video" : "Voice"} Call...`
                : `Calling ${partnerName}...`}
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
                    }}
                    title="Decline Call"
                  >
                    <PhoneOff size={22} />
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
                    }}
                    title="Accept Call"
                  >
                    <Phone size={22} />
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
                  }}
                  title="Cancel Call"
                >
                  <PhoneOff size={22} />
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
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{partnerName}</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#34d399", fontFamily: "monospace" }}>
                {formatDuration(callDuration)}
              </span>
            </div>

            {/* Video Streams / Audio Avatar Canvas */}
            <div style={{ position: "relative", minHeight: callType === "video" ? "380px" : "240px", background: "#0c0c10", display: "grid", placeItems: "center" }}>
              {callType === "video" ? (
                <>
                  {/* Remote Video (Main) */}
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
                    }}
                  >
                    <video
                      ref={attachLocalVideo}
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
                    )}
                  </div>
                </>
              ) : (
                /* Audio Only Avatar View */
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
                    background: isVideoOff ? "#ef4444" : "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: 0,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    transition: "all 0.15s ease",
                  }}
                  title={isVideoOff ? "Start Camera" : "Stop Camera"}
                >
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

              {/* Add Person / Switch to Group Meeting Room */}
              <button
                onClick={handleUpgradeToGroupCall}
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  border: 0,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  transition: "all 0.15s ease",
                }}
                title="Add Persons / Convert to Group Meeting"
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
