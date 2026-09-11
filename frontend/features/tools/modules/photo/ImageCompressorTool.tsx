"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Download, RefreshCw, Image as ImageIcon, Check, Trash2 } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function ImageCompressorTool() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string>("");
  const [compressedSrc, setCompressedSrc] = useState<string>("");
  const [quality, setQuality] = useState(75);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleClear = useCallback(() => {
    if (originalSrc) URL.revokeObjectURL(originalSrc);
    if (compressedSrc) URL.revokeObjectURL(compressedSrc);
    setOriginalFile(null);
    setOriginalSrc("");
    setCompressedSrc("");
    setOriginalSize(0);
    setCompressedSize(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [originalSrc, compressedSrc]);

  // Clean up object URLs on component unmount or global wipe event
  useEffect(() => {
    const onWipe = () => handleClear();
    window.addEventListener("flumenx:wipe_tool_data", onWipe);
    return () => {
      window.removeEventListener("flumenx:wipe_tool_data", onWipe);
      if (originalSrc) URL.revokeObjectURL(originalSrc);
      if (compressedSrc) URL.revokeObjectURL(compressedSrc);
    };
  }, [originalSrc, compressedSrc, handleClear]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    if (originalSrc) URL.revokeObjectURL(originalSrc);
    if (compressedSrc) URL.revokeObjectURL(compressedSrc);

    setOriginalFile(file);
    setOriginalSize(file.size);
    const url = URL.createObjectURL(file);
    setOriginalSrc(url);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("flumenx:touch_tool_data"));
    }
  };

  const compressImage = () => {
    if (!originalSrc || !originalFile) return;
    setIsProcessing(true);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = originalSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsProcessing(false);
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Determine output mime type (JPEG or WebP provide highest compression)
      const mimeType = originalFile.type === "image/png" ? "image/webp" : originalFile.type;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            if (compressedSrc) URL.revokeObjectURL(compressedSrc);
            setCompressedSize(blob.size);
            const compUrl = URL.createObjectURL(blob);
            setCompressedSrc(compUrl);
          }
          setIsProcessing(false);
        },
        mimeType,
        quality / 100
      );
    };
  };

  useEffect(() => {
    if (originalSrc) {
      compressImage();
    }
  }, [originalSrc, quality]);

  const handleDownload = () => {
    if (!compressedSrc || !originalFile) return;
    const a = document.createElement("a");
    a.href = compressedSrc;
    const ext = originalFile.type === "image/png" ? "webp" : originalFile.name.split(".").pop();
    a.download = `compressed_${originalFile.name.replace(/\.[^/.]+$/, "")}.${ext}`;
    a.click();
    toast.success("Compressed image downloaded!");
  };

  const savingsPercent = originalSize > 0 && compressedSize > 0
    ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
    : 0;

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
          }}
        />

        {/* Dropzone */}
        <div
          className="tool-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
          }}
        >
          <Upload size={32} className="tool-dropzone-icon" />
          <div className="tool-dropzone-title">Upload Image to Compress</div>
          <div className="tool-dropzone-sub">
            {originalFile ? `${originalFile.name} (${formatBytes(originalSize)})` : "JPG, PNG, or WebP up to 50MB"}
          </div>
        </div>

        {originalFile && (
          <div style={{ marginTop: "20px" }}>
            <div className="tool-field-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="tool-label" style={{ margin: 0 }}>Compression Quality</label>
                <span style={{ fontWeight: 800, color: "var(--tools-primary)", fontSize: "0.9rem" }}>{quality}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="95"
                step="5"
                value={quality}
                onChange={(e) => {
                  setQuality(Number(e.target.value));
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("flumenx:touch_tool_data"));
                  }
                }}
                style={{ width: "100%", accentColor: "var(--tools-primary)" }}
              />
              <span className="tool-help-text">70-80% provides the optimal balance of sharp clarity and tiny file size.</span>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="tool-btn-secondary"
                style={{ flex: 1 }}
              >
                Choose Different Image
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="tool-btn-secondary"
                style={{ color: "#DC2626", borderColor: "#FCA5A5" }}
                title="Wipe image from browser memory"
              >
                <Trash2 size={14} />
                <span>Wipe</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Compression Results</span>
          {compressedSrc && (
            <button type="button" onClick={handleDownload} className="tool-btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
              <Download size={13} />
              <span>Download</span>
            </button>
          )}
        </div>

        {compressedSrc ? (
          <div>
            {/* Savings Banner */}
            <div
              style={{
                padding: "14px",
                backgroundColor: savingsPercent > 0 ? "rgba(16, 185, 129, 0.12)" : "var(--tools-surface)",
                borderRadius: "10px",
                border: "1px solid var(--tools-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div>
                <div style={{ fontSize: "0.82rem", color: "var(--tools-text-muted)" }}>File Size Comparison:</div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                  {formatBytes(originalSize)} → <span style={{ color: "var(--tools-primary)" }}>{formatBytes(compressedSize)}</span>
                </div>
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "#10B981",
                }}
              >
                -{savingsPercent}%
              </div>
            </div>

            {/* Preview image */}
            <div
              style={{
                maxHeight: "320px",
                overflow: "hidden",
                borderRadius: "10px",
                border: "1px solid var(--tools-border)",
                backgroundColor: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={compressedSrc}
                alt="Compressed preview"
                style={{ maxWidth: "100%", maxHeight: "320px", objectFit: "contain" }}
              />
            </div>
          </div>
        ) : (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--tools-text-muted)" }}>
            <ImageIcon size={36} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
            <div>Upload an image to see immediate compression savings.</div>
          </div>
        )}
      </div>
    </div>
  );
}
