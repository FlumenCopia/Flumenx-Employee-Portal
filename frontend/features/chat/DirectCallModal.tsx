"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/icons";

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

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === "audio");
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        zIndex: 2000,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: mode === "connected" && callType === "video" ? "880px" : "440px",
          background: "linear-gradient(180deg, #1e1e24 0%, #15151a 100%)",
          border: "1px solid var(--border2, #333)",
          borderRadius: "20px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          animation: "scaleUp 0.25s ease",
        }}
      >
        {/* INCOMING / OUTGOING RINGING SCREEN */}
        {mode !== "connected" ? (
          <div style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "20px" }}>
            {/* Caller Avatar Pulse */}
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Avatar name={partnerName} avatar={partnerAvatar} size={96} />
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
                {partnerName}
              </h3>
              <p style={{ fontSize: "13px", color: "#34d399", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                {callType === "video" ? <Video size={15} /> : <PhoneCall size={15} />}
                {mode === "incoming" ? `Incoming ${callType.toUpperCase()} Call...` : `Calling ${partnerName}...`}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "24px", marginTop: "16px" }}>
              {mode === "incoming" ? (
                <>
                  <button
                    onClick={onDecline}
                    style={{
                      width: "60px",
                      height: "60px",
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
                    <PhoneOff size={24} />
                  </button>

                  <button
                    onClick={onAccept}
                    style={{
                      width: "60px",
                      height: "60px",
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
                    <Phone size={24} />
                  </button>
                </>
              ) : (
                <button
                  onClick={onEndCall}
                  style={{
                    width: "60px",
                    height: "60px",
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
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{partnerName}</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#34d399", fontFamily: "monospace" }}>
                {formatDuration(callDuration)}
              </span>
            </div>

            {/* Video Streams / Audio Avatar Canvas */}
            <div style={{ position: "relative", minHeight: callType === "video" ? "380px" : "220px", background: "#0c0c10", display: "grid", placeItems: "center" }}>
              {callType === "video" ? (
                <>
                  {/* Remote Video (Main) */}
                  <video
                    ref={remoteVideoRef}
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
                    }}
                  >
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                    />
                  </div>
                </>
              ) : (
                /* Audio Only Avatar View */
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "30px 0" }}>
                  <Avatar name={partnerName} avatar={partnerAvatar} size={80} />
                  <span style={{ fontSize: "12px", color: "var(--muted, #888)", fontWeight: 600 }}>FLUMENX Direct Audio Active</span>
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
                  }}
                  title={isVideoOff ? "Start Camera" : "Stop Camera"}
                >
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

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
                }}
                title="End Call"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
