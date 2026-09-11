"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Maximize2, Image as ImageIcon, Trash2 } from "lucide-react";

export function ImageDimensionsTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

  const handleClear = useCallback(() => {
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setFile(null);
    setPreviewSrc("");
    setWidth(0);
    setHeight(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewSrc]);

  useEffect(() => {
    const onWipe = () => handleClear();
    window.addEventListener("flumenx:wipe_tool_data", onWipe);
    return () => {
      window.removeEventListener("flumenx:wipe_tool_data", onWipe);
      if (previewSrc) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc, handleClear]);

  const handleFile = (f: File) => {
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewSrc(url);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);
    };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("flumenx:touch_tool_data"));
    }
  };

  const aspect = (() => {
    if (width <= 0 || height <= 0) return "";
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  })();

  const megapixels = width > 0 && height > 0 ? ((width * height) / 1000000).toFixed(2) : "0";

  const orientation = (() => {
    if (width === 0) return "";
    if (width > height) return "Landscape";
    if (height > width) return "Portrait";
    return "Square";
  })();

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />

        <div
          className="tool-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
          }}
        >
          <Upload size={32} className="tool-dropzone-icon" />
          <div className="tool-dropzone-title">Upload Image to Inspect Dimensions</div>
          <div className="tool-dropzone-sub">
            {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "Click to browse or drop an image here"}
          </div>
        </div>

        {file && width > 0 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "20px" }}>
              <div style={{ padding: "14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Width</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--tools-primary)" }}>{width} px</div>
              </div>

              <div style={{ padding: "14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Height</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--tools-primary)" }}>{height} px</div>
              </div>

              <div style={{ padding: "14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Aspect Ratio</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{aspect}</div>
              </div>

              <div style={{ padding: "14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Megapixels</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{megapixels} MP</div>
              </div>

              <div style={{ padding: "14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Orientation</div>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>{orientation}</div>
              </div>

              <div style={{ padding: "14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>File Size</div>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="tool-btn-secondary"
                style={{ flex: 1 }}
              >
                Inspect Another Image
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
          <span className="tool-output-title">Image Preview</span>
          {file && (
            <span style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)" }}>{file.type}</span>
          )}
        </div>

        {previewSrc ? (
          <div
            style={{
              maxHeight: "360px",
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
            <img src={previewSrc} alt="Preview" style={{ maxWidth: "100%", maxHeight: "360px", objectFit: "contain" }} />
          </div>
        ) : (
          <div style={{ padding: "80px 20px", textAlign: "center", color: "var(--tools-text-muted)" }}>
            <ImageIcon size={36} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
            <div>Upload any image to inspect full dimensions and aspect ratio metrics.</div>
          </div>
        )}
      </div>
    </div>
  );
}
