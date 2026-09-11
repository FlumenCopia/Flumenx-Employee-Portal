"use client";

import React, { useState, useRef } from "react";
import { Upload, Download, ArrowRight, Image as ImageIcon } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function ImageConverterTool() {
  const [file, setFile] = useState<File | null>(null);
  const [fileSrc, setFileSrc] = useState<string>("");
  const [targetFormat, setTargetFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/webp");
  const [quality, setQuality] = useState(90);
  const [convertedSrc, setConvertedSrc] = useState<string>("");
  const [convertedSize, setConvertedSize] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setFileSrc(url);
    setConvertedSrc("");
  };

  const convert = () => {
    if (!fileSrc || !file) return;
    const img = new Image();
    img.src = fileSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Fill white background for JPEG if PNG had transparency
      if (targetFormat === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            setConvertedSize(blob.size);
            setConvertedSrc(URL.createObjectURL(blob));
            toast.success("Image format converted successfully!");
          }
        },
        targetFormat,
        quality / 100
      );
    };
  };

  const downloadConverted = () => {
    if (!convertedSrc || !file) return;
    const ext = targetFormat === "image/png" ? "png" : targetFormat === "image/jpeg" ? "jpg" : "webp";
    const a = document.createElement("a");
    a.href = convertedSrc;
    a.download = `${file.name.replace(/\.[^/.]+$/, "")}_converted.${ext}`;
    a.click();
    toast.success("Downloaded converted image!");
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
          <div className="tool-dropzone-title">Upload Image to Convert</div>
          <div className="tool-dropzone-sub">
            {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "Upload PNG, JPG, WebP, GIF, or SVG"}
          </div>
        </div>

        {file && (
          <div style={{ marginTop: "20px" }}>
            <div className="tool-field-group">
              <label className="tool-label">Convert To Format</label>
              <select
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value as any)}
                className="tool-select"
              >
                <option value="image/webp">WebP (Modern, high quality, small file)</option>
                <option value="image/png">PNG (Lossless, supports transparency)</option>
                <option value="image/jpeg">JPEG (Standard universal photo format)</option>
              </select>
            </div>

            {targetFormat !== "image/png" && (
              <div className="tool-field-group">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label className="tool-label" style={{ marginBottom: 0 }}>Encoding Quality: {quality}%</label>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--tools-primary)" }}>{quality}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--tools-primary)" }}
                />
              </div>
            )}

            <button type="button" onClick={convert} className="tool-btn-primary" style={{ width: "100%", marginTop: "10px" }}>
              Convert Image
            </button>
          </div>
        )}
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Converted Result</span>
          {convertedSrc && (
            <button type="button" onClick={downloadConverted} className="tool-btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
              <Download size={13} />
              <span>Download</span>
            </button>
          )}
        </div>

        {convertedSrc ? (
          <div>
            <div style={{ padding: "10px 14px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", marginBottom: "14px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--tools-text-secondary)" }}>
                Output Format: <b>{targetFormat.replace("image/", "").toUpperCase()}</b> | Size: <b>{(convertedSize / 1024).toFixed(1)} KB</b>
              </div>
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
              <img src={convertedSrc} alt="Converted" style={{ maxWidth: "100%", maxHeight: "340px", objectFit: "contain" }} />
            </div>
          </div>
        ) : (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--tools-text-muted)" }}>
            <ImageIcon size={36} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
            <div>Choose an image and click "Convert Image" to process.</div>
          </div>
        )}
      </div>
    </div>
  );
}
