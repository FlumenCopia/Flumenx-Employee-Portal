"use client";

import React, { useState, useEffect } from "react";
import { X, Download, ZoomIn, ZoomOut, RotateCcw, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";

type ChatMediaLightboxProps = {
  src: string;
  alt?: string;
  isVideo?: boolean;
  onClose: () => void;
};

export function ChatMediaLightbox({ src, alt = "Preview", isVideo = false, onClose }: ChatMediaLightboxProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [fallbackAttempt, setFallbackAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    setCurrentSrc(src);
    setFallbackAttempt(0);
    setLoading(true);
    setHasError(false);
    setZoomLevel(1);
  }, [src]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoomLevel((prev) => Math.min(prev + 0.25, 3));
      if (e.key === "-") setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
      if (e.key === "0") setZoomLevel(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleImageError = () => {
    const filename = currentSrc.split("/").pop() || "";
    if (fallbackAttempt === 0) {
      setFallbackAttempt(1);
      setCurrentSrc(`/media/chat/${filename}`);
    } else if (fallbackAttempt === 1) {
      setFallbackAttempt(2);
      setCurrentSrc(`/media/employee_documents/${filename}`);
    } else if (fallbackAttempt === 2) {
      setFallbackAttempt(3);
      setCurrentSrc(`/media/${filename}`);
    } else if (fallbackAttempt === 3) {
      setFallbackAttempt(4);
      setCurrentSrc(`/uploads/${filename}`);
    } else {
      setLoading(false);
      setHasError(true);
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = currentSrc;
    link.download = alt || "flumenx-media";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 15, 13, 0.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        flexDirection: "column",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      {/* Top Header Action Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: "rgba(20, 28, 24, 0.8)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          color: "#fff",
          zIndex: 10000,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              maxWidth: "280px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {alt}
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "12px",
              background: "rgba(8, 122, 91, 0.35)",
              border: "1px solid rgba(8, 122, 91, 0.6)",
              color: "#34D399",
              fontWeight: 700,
            }}
          >
            {isVideo ? "VIDEO" : "PHOTO"}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {!isVideo && (
            <>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5))}
                title="Zoom Out (-)"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                title="Reset Zoom (0)"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  borderRadius: "8px",
                  padding: "0 10px",
                  height: "36px",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={13} />
                <span>{Math.round(zoomLevel * 100)}%</span>
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(prev + 0.25, 3))}
                title="Zoom In (+)"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <ZoomIn size={16} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDownload}
            title="Download Original File"
            style={{
              background: "rgba(8, 122, 91, 0.8)",
              border: "1px solid rgba(8, 122, 91, 1)",
              color: "#fff",
              borderRadius: "8px",
              padding: "0 12px",
              height: "36px",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <Download size={15} />
            <span>Download</span>
          </button>

          <a
            href={currentSrc}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              borderRadius: "8px",
              width: "36px",
              height: "36px",
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={16} />
          </a>

          <button
            type="button"
            onClick={onClose}
            title="Close Preview (Esc)"
            style={{
              background: "rgba(220, 38, 38, 0.8)",
              border: "1px solid rgba(220, 38, 38, 1)",
              color: "#fff",
              borderRadius: "8px",
              width: "36px",
              height: "36px",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              marginLeft: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Media Canvas Stage */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          overflow: "auto",
          position: "relative",
        }}
      >
        {loading && !hasError && (
          <div
            style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              color: "rgba(255, 255, 255, 0.8)",
              zIndex: 1,
            }}
          >
            <RefreshCw size={28} className="animate-spin" style={{ color: "#34D399" }} />
            <span style={{ fontSize: "13px", fontWeight: 500 }}>Loading media preview...</span>
          </div>
        )}

        {hasError ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              background: "rgba(30, 20, 20, 0.85)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "16px",
              padding: "32px 28px",
              maxWidth: "420px",
              textAlign: "center",
              color: "#fff",
            }}
          >
            <AlertCircle size={40} color="#EF4444" />
            <div>
              <b style={{ fontSize: "15px", display: "block", marginBottom: "4px" }}>Unable to load media directly</b>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                The media file could not be rendered in this view. You can open or download it directly below.
              </span>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <a
                href={currentSrc}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "#087A5B",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Open Original File
              </a>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : isVideo ? (
          <video
            src={currentSrc}
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
            onLoadedData={() => setLoading(false)}
            onError={handleImageError}
            style={{
              maxWidth: "92vw",
              maxHeight: "82vh",
              borderRadius: "12px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
          />
        ) : (
          <img
            src={currentSrc}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            onLoad={() => setLoading(false)}
            onError={handleImageError}
            style={{
              maxWidth: zoomLevel === 1 ? "92vw" : "none",
              maxHeight: zoomLevel === 1 ? "82vh" : "none",
              transform: `scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease",
              borderRadius: "10px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
              objectFit: "contain",
              cursor: zoomLevel > 1 ? "grab" : "default",
              userSelect: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
