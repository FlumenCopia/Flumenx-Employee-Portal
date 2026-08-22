"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, RefreshCw, RotateCcw, ShieldCheck, X } from "lucide-react";

interface AttendanceCameraModalProps {
  mode: "check-in" | "check-out";
  distanceMeters: number;
  onConfirm: (photoBlob: Blob | null) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function AttendanceCameraModal({
  mode,
  distanceMeters,
  onConfirm,
  onCancel,
  submitting = false,
}: AttendanceCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [cameraLoading, setCameraLoading] = useState<boolean>(true);

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not access camera. Please ensure camera permissions are enabled.";
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraError(
          "Camera permission was denied. Please allow camera access in your browser site settings and try again."
        );
      } else {
        setCameraError(msg);
      }
    } finally {
      setCameraLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "check-in") {
      startCamera();
    }
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-deps
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
          stopStream();
        }
      },
      "image/jpeg",
      0.85
    );
  };

  const retakePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedBlob(null);
    startCamera();
  };

  const handleConfirm = () => {
    onConfirm(capturedBlob);
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "var(--panel, #1e1e24)",
          border: "1px solid var(--border2, #2e2e38)",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border2, rgba(255,255,255,0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "var(--goldD, #cba86e)",
                textTransform: "uppercase",
              }}
            >
              ATTENDANCE VERIFICATION
            </span>
            <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "2px 0 0 0" }}>
              {mode === "check-in" ? "Live Photo Verification" : "Confirm Check-Out"}
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--muted, #8e8e93)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Location badge */}
        <div
          style={{
            padding: "10px 20px",
            background: "rgba(34, 197, 94, 0.1)",
            borderBottom: "1px solid rgba(34, 197, 94, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "#4ade80",
            fontWeight: 600,
          }}
        >
          <ShieldCheck size={16} />
          Location Verified • Within {distanceMeters}m of office
        </div>

        {/* Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {mode === "check-in" && (
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "4/3",
                borderRadius: "12px",
                background: "#000000",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                border: "1px solid var(--border, #333)",
              }}
            >
              {cameraLoading && !previewUrl && (
                <div style={{ textAlign: "center", color: "#8e8e93", fontSize: "13px" }}>
                  <RefreshCw className="spin" size={24} style={{ marginBottom: "8px" }} />
                  <p>Starting front camera...</p>
                </div>
              )}

              {cameraError && !previewUrl && (
                <div style={{ padding: "20px", textAlign: "center", color: "#ef4444" }}>
                  <p style={{ fontSize: "13px", marginBottom: "12px" }}>{cameraError}</p>
                  <button
                    onClick={startCamera}
                    style={{
                      background: "var(--panel, #333)",
                      color: "#fff",
                      border: "1px solid #555",
                      borderRadius: "6px",
                      padding: "6px 14px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Retry Camera
                  </button>
                </div>
              )}

              {!previewUrl && !cameraError && (
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)", // Mirror mode for natural selfie
                  }}
                />
              )}

              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Attendance selfie preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                  }}
                />
              )}

              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          )}

          {mode === "check-out" && (
            <div style={{ fontSize: "13.5px", color: "var(--text)", lineHeight: "1.5" }}>
              Are you sure you want to mark your office checkout for today? Your checkout location has been verified within <b>{distanceMeters} meters</b> of the office.
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            {mode === "check-in" && !previewUrl && (
              <button
                onClick={capturePhoto}
                disabled={cameraLoading || Boolean(cameraError) || submitting}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #cba86e 0%, #a8874e 100%)",
                  color: "#ffffff",
                  border: 0,
                  borderRadius: "10px",
                  padding: "12px",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: cameraLoading || cameraError ? "not-allowed" : "pointer",
                  opacity: cameraLoading || cameraError ? 0.6 : 1,
                }}
              >
                <Camera size={18} />
                Capture Photo
              </button>
            )}

            {mode === "check-in" && previewUrl && (
              <>
                <button
                  onClick={retakePhoto}
                  disabled={submitting}
                  style={{
                    background: "transparent",
                    color: "var(--text, #fff)",
                    border: "1px solid var(--border2, #444)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    fontWeight: 600,
                    fontSize: "13px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                  }}
                >
                  <RotateCcw size={16} />
                  Retake
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    background: "linear-gradient(135deg, #cba86e 0%, #a8874e 100%)",
                    color: "#ffffff",
                    border: 0,
                    borderRadius: "10px",
                    padding: "12px",
                    fontWeight: 700,
                    fontSize: "13.5px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  <CheckCircle2 size={18} />
                  {submitting ? "Submitting..." : "Confirm & Submit"}
                </button>
              </>
            )}

            {mode === "check-out" && (
              <>
                <button
                  onClick={onCancel}
                  disabled={submitting}
                  style={{
                    background: "transparent",
                    color: "var(--text, #fff)",
                    border: "1px solid var(--border2, #444)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    background: "linear-gradient(135deg, #cba86e 0%, #a8874e 100%)",
                    color: "#ffffff",
                    border: 0,
                    borderRadius: "10px",
                    padding: "12px",
                    fontWeight: 700,
                    fontSize: "13.5px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  <CheckCircle2 size={18} />
                  {submitting ? "Processing..." : "Confirm Check-Out"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
