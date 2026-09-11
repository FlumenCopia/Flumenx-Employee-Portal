"use client";

import React, { useState, useRef } from "react";
import { Upload, Download, Lock, Unlock, Image as ImageIcon } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function ImageResizerTool() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string>("");
  const [origW, setOrigW] = useState<number>(0);
  const [origH, setOrigH] = useState<number>(0);

  const [targetW, setTargetW] = useState<number>(0);
  const [targetH, setTargetH] = useState<number>(0);
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [resizedSrc, setResizedSrc] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setOriginalSrc(url);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      setOrigW(img.naturalWidth);
      setOrigH(img.naturalHeight);
      setTargetW(img.naturalWidth);
      setTargetH(img.naturalHeight);
    };
  };

  const handleWidthChange = (w: number) => {
    setTargetW(w);
    if (lockAspect && origW > 0) {
      setTargetH(Math.round((w * origH) / origW));
    }
  };

  const handleHeightChange = (h: number) => {
    setTargetH(h);
    if (lockAspect && origH > 0) {
      setTargetW(Math.round((h * origW) / origH));
    }
  };

  const applyPercent = (pct: number) => {
    if (origW > 0 && origH > 0) {
      setTargetW(Math.round((origW * pct) / 100));
      setTargetH(Math.round((origH * pct) / 100));
    }
  };

  const applyPreset = (w: number, h: number) => {
    setTargetW(w);
    setTargetH(h);
  };

  const executeResize = () => {
    if (!originalSrc || targetW <= 0 || targetH <= 0) return;
    const img = new Image();
    img.src = originalSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const res = canvas.toDataURL(originalFile?.type || "image/png");
      setResizedSrc(res);
      toast.success("Image resized!");
    };
  };

  const handleDownload = () => {
    if (!resizedSrc) return;
    const a = document.createElement("a");
    a.href = resizedSrc;
    a.download = `resized_${targetW}x${targetH}_${Date.now()}.png`;
    a.click();
    toast.success("Downloaded resized image!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
          }}
        />

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
          <div className="tool-dropzone-title">Upload Image to Resize</div>
          <div className="tool-dropzone-sub">
            {originalFile ? `${originalFile.name} (${origW} × ${origH} px)` : "JPG, PNG, WebP supported"}
          </div>
        </div>

        {origW > 0 && (
          <div style={{ marginTop: "20px" }}>
            {/* Dimensions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "10px", alignItems: "end", marginBottom: "16px" }}>
              <div>
                <label className="tool-label">Width (px)</label>
                <input
                  type="number"
                  min="1"
                  value={targetW}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="tool-input"
                />
              </div>

              <div style={{ paddingBottom: "8px" }}>
                <button
                  type="button"
                  onClick={() => setLockAspect(!lockAspect)}
                  className={`tool-btn-secondary ${lockAspect ? "active" : ""}`}
                  style={{ padding: "10px", borderRadius: "8px" }}
                  title={lockAspect ? "Lock Aspect Ratio" : "Unlock Aspect Ratio"}
                >
                  {lockAspect ? <Lock size={15} /> : <Unlock size={15} />}
                </button>
              </div>

              <div>
                <label className="tool-label">Height (px)</label>
                <input
                  type="number"
                  min="1"
                  value={targetH}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  className="tool-input"
                />
              </div>
            </div>

            {/* Percentage shortcuts */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", marginBottom: "6px" }}>Scale Percentage</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {[25, 50, 75, 100, 200].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyPercent(pct)}
                    className="tool-cat-pill"
                    style={{ flex: 1, textAlign: "center", padding: "6px" }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Presets */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", marginBottom: "6px" }}>Common Presets</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {[
                  { name: "Avatar (400×400)", w: 400, h: 400 },
                  { name: "Square (1080×1080)", w: 1080, h: 1080 },
                  { name: "Full HD (1920×1080)", w: 1920, h: 1080 },
                  { name: "Story (1080×1920)", w: 1080, h: 1920 },
                  { name: "Banner (1200×630)", w: 1200, h: 630 },
                ].map((pre) => (
                  <button
                    key={pre.name}
                    type="button"
                    onClick={() => applyPreset(pre.w, pre.h)}
                    className="tool-cat-pill"
                    style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                  >
                    {pre.name}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" onClick={executeResize} className="tool-btn-primary" style={{ width: "100%" }}>
              Apply Resize
            </button>
          </div>
        )}
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Preview & Download</span>
          {resizedSrc && (
            <button type="button" onClick={handleDownload} className="tool-btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
              <Download size={13} />
              <span>Download</span>
            </button>
          )}
        </div>

        {resizedSrc ? (
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--tools-text-secondary)", marginBottom: "10px" }}>
              New Dimensions: <b>{targetW} × {targetH} px</b>
            </div>
            <div
              style={{
                maxHeight: "340px",
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
              <img src={resizedSrc} alt="Resized" style={{ maxWidth: "100%", maxHeight: "340px", objectFit: "contain" }} />
            </div>
          </div>
        ) : (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--tools-text-muted)" }}>
            <ImageIcon size={36} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
            <div>Configure dimensions and click "Apply Resize" to generate.</div>
          </div>
        )}
      </div>
    </div>
  );
}
