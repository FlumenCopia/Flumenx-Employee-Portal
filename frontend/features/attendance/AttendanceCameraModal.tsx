"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, RefreshCw, RotateCcw, ShieldCheck, UserCheck, X, AlertTriangle } from "lucide-react";

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

  // Real-time Face Detection state
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [faceDetectionStatus, setFaceDetectionStatus] = useState<string>("Align face inside the frame");

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError("");
    setFaceDetected(false);
    setFaceDetectionStatus("Initializing camera...");

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

  // Real-time face detection loop
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    let isActive = true;

    const runFaceAnalysis = async () => {
      if (!isActive || !videoRef.current || previewUrl || cameraError) return;
      const video = videoRef.current;
      if (video.paused || video.ended || video.readyState < 2) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      try {
        // 1. Try Browser Native FaceDetector API if supported (Chrome / Edge)
        if (typeof window !== "undefined" && "FaceDetector" in window) {
          try {
            const detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            const faces = await detector.detect(video);
            if (faces && faces.length > 0) {
              setFaceDetected(true);
              setFaceDetectionStatus("Face Detected · Ready to Capture");
              return;
            }
          } catch {
            // Fallback to canvas skin-tone & luminance analysis
          }
        }

        // 2. Real-time Canvas-based Face & Skin-Tone Luminance Analyzer
        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = 160;
        sampleCanvas.height = 120;
        const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
          const imgData = ctx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
          const data = imgData.data;

          let skinPixels = 0;
          let totalCenterPixels = 0;

          // Target center oval region where user's face is positioned
          const minX = Math.floor(sampleCanvas.width * 0.25);
          const maxX = Math.floor(sampleCanvas.width * 0.75);
          const minY = Math.floor(sampleCanvas.height * 0.15);
          const maxY = Math.floor(sampleCanvas.height * 0.85);

          for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
              const idx = (y * sampleCanvas.width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              totalCenterPixels++;

              // YCbCr & RGB skin-tone detection algorithm
              const maxRGB = Math.max(r, g, b);
              const minRGB = Math.min(r, g, b);
              if (
                r > 45 && g > 35 && b > 20 &&
                (maxRGB - minRGB) > 12 &&
                Math.abs(r - g) > 10 &&
                r > g && r > b
              ) {
                skinPixels++;
              }
            }
          }

          const skinRatio = skinPixels / totalCenterPixels;

          if (skinRatio >= 0.14) {
            setFaceDetected(true);
            setFaceDetectionStatus("Face Detected · Ready to Capture");
          } else {
            setFaceDetected(false);
            setFaceDetectionStatus("No face detected. Position your face clearly inside the frame.");
          }
        }
      } catch {
        setFaceDetected(false);
      }
    };

    if (mode === "check-in" && !previewUrl && !cameraLoading && !cameraError) {
      timerId = setInterval(runFaceAnalysis, 250);
    }

    return () => {
      isActive = false;
      if (timerId) clearInterval(timerId);
    };
  }, [mode, previewUrl, cameraLoading, cameraError]);

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
    if (!faceDetected) return; // Strict block if face is not properly detected
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
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
    setFaceDetected(false);
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
              {mode === "check-in" ? "Live Face Verification" : "Confirm Check-Out"}
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
            <>
              {/* Face Detection Status Banner */}
              {!previewUrl && !cameraError && (
                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: faceDetected ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    border: `1px solid ${faceDetected ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    color: faceDetected ? "#4ade80" : "#f87171",
                    transition: "all 0.3s ease",
                  }}
                >
                  {faceDetected ? <UserCheck size={16} /> : <AlertTriangle size={16} />}
                  <span>{faceDetectionStatus}</span>
                </div>
              )}

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
                  border: `2px solid ${
                    previewUrl
                      ? "#333"
                      : faceDetected
                      ? "#22c55e"
                      : "rgba(239, 68, 68, 0.6)"
                  }`,
                  transition: "border-color 0.3s ease",
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
                  <>
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

                    {/* Face Target Oval Guide */}
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "55%",
                        height: "75%",
                        borderRadius: "50%",
                        border: `2.5px ${faceDetected ? "solid #22c55e" : "dashed #ef4444"}`,
                        boxShadow: faceDetected
                          ? "0 0 20px rgba(34, 197, 94, 0.4), inset 0 0 15px rgba(34, 197, 94, 0.2)"
                          : "0 0 15px rgba(239, 68, 68, 0.3)",
                        pointerEvents: "none",
                        transition: "all 0.3s ease",
                      }}
                    />
                  </>
                )}

                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Attendance selfie preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                )}

                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            </>
          )}

          {mode === "check-out" && (
            <div style={{ fontSize: "13.5px", color: "var(--text)", lineHeight: "1.5" }}>
              Are you sure you want to mark your office checkout for today? Your checkout location has been verified within <b>{distanceMeters} meters</b> of the office.
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            {mode === "check-in" && !previewUrl && (
              <>
                <button
                  onClick={capturePhoto}
                  disabled={!faceDetected || cameraLoading || Boolean(cameraError) || submitting}
                  style={{
                    width: "100%",
                    background: faceDetected
                      ? "linear-gradient(135deg, #cba86e 0%, #a8874e 100%)"
                      : "#2e2e38",
                    color: faceDetected ? "#ffffff" : "#71717a",
                    border: 0,
                    borderRadius: "10px",
                    padding: "12px",
                    fontWeight: 700,
                    fontSize: "13.5px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: faceDetected && !cameraLoading && !submitting ? "pointer" : "not-allowed",
                    opacity: faceDetected ? 1 : 0.6,
                    transition: "all 0.3s ease",
                  }}
                >
                  <Camera size={18} />
                  {faceDetected ? "Capture Photo" : "Detecting Face..."}
                </button>

                {!faceDetected && !cameraLoading && !cameraError && (
                  <p style={{ fontSize: "11.5px", color: "#f87171", textAlign: "center", margin: 0 }}>
                    ⚠️ Position your face inside the green oval frame to enable photo capture.
                  </p>
                )}
              </>
            )}

            {mode === "check-in" && previewUrl && (
              <div style={{ display: "flex", gap: "10px" }}>
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
              </div>
            )}

            {mode === "check-out" && (
              <div style={{ display: "flex", gap: "10px" }}>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
