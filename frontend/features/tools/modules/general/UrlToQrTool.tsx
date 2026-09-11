"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Download, Copy, RefreshCw, Check, Globe } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function UrlToQrTool() {
  const [url, setUrl] = useState("https://flumenx.com");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrSvgString, setQrSvgString] = useState("");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [size, setSize] = useState(300);
  const [margin, setMargin] = useState(2);
  const [ecLevel, setEcLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [loading, setLoading] = useState(false);

  const generateQr = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const pngUrl = await QRCode.toDataURL(url, {
        width: size,
        margin: margin,
        color: {
          dark: fgColor,
          light: bgColor,
        },
        errorCorrectionLevel: ecLevel,
      });
      setQrDataUrl(pngUrl);

      const svg = await QRCode.toString(url, {
        type: "svg",
        width: size,
        margin: margin,
        color: {
          dark: fgColor,
          light: bgColor,
        },
        errorCorrectionLevel: ecLevel,
      });
      setQrSvgString(svg);
    } catch (err) {
      toast.error("Failed to generate QR code. Please check your URL.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateQr();
  }, [url, fgColor, bgColor, size, margin, ecLevel]);

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qrcode_${Date.now()}.png`;
    link.click();
    toast.success("PNG downloaded successfully!");
  };

  const handleDownloadSvg = () => {
    if (!qrSvgString) return;
    const blob = new Blob([qrSvgString], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `qrcode_${Date.now()}.svg`;
    link.click();
    toast.success("SVG downloaded successfully!");
  };

  const handleCopyImage = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast.success("QR code copied to clipboard!");
    } catch {
      navigator.clipboard.writeText(url);
      toast.info("Copied URL to clipboard!");
    }
  };

  return (
    <div className="tool-two-col">
      {/* Left Column: Controls */}
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Website URL</label>
          <div style={{ position: "relative" }}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/promo"
              className="tool-input"
              style={{ paddingLeft: "36px" }}
            />
            <Globe
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--tools-text-muted)",
              }}
            />
          </div>
          <p className="tool-help-text">Enter any destination web address including https://</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className="tool-field-group">
            <label className="tool-label">Foreground Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="color"
                value={fgColor}
                onChange={(e) => setFgColor(e.target.value)}
                style={{
                  width: "42px",
                  height: "38px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              />
              <input
                type="text"
                value={fgColor}
                onChange={(e) => setFgColor(e.target.value)}
                className="tool-input"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Background Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                style={{
                  width: "42px",
                  height: "38px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              />
              <input
                type="text"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="tool-input"
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className="tool-field-group">
            <label className="tool-label">Size: {size}px</label>
            <input
              type="range"
              min="150"
              max="600"
              step="10"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--tools-primary)" }}
            />
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Error Correction</label>
            <select
              value={ecLevel}
              onChange={(e) => setEcLevel(e.target.value as any)}
              className="tool-select"
            >
              <option value="L">Low (7% recovery)</option>
              <option value="M">Medium (15% recovery)</option>
              <option value="Q">Quartile (25% recovery)</option>
              <option value="H">High (30% recovery)</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={generateQr}
          className="tool-btn-primary"
          style={{ width: "100%", marginTop: "10px" }}
        >
          <RefreshCw size={16} />
          <span>Regenerate QR Code</span>
        </button>
      </div>

      {/* Right Column: Preview & Downloads */}
      <div className="tool-output-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="tool-output-header" style={{ width: "100%" }}>
          <span className="tool-output-title">Live QR Preview</span>
          <span style={{ fontSize: "0.78rem", color: "var(--tools-text-muted)" }}>
            {size} × {size} px
          </span>
        </div>

        <div
          style={{
            padding: "20px",
            backgroundColor: bgColor,
            borderRadius: "12px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            border: "1px solid var(--tools-border)",
            margin: "20px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "260px",
          }}
        >
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Generated QR Code"
              style={{ maxWidth: "100%", maxHeight: "280px", objectFit: "contain" }}
            />
          ) : (
            <div style={{ color: "var(--tools-text-muted)", fontSize: "0.9rem" }}>
              Enter a URL to generate QR code
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", width: "100%", justifyContent: "center" }}>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={!qrDataUrl}
            className="tool-btn-primary"
          >
            <Download size={15} />
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            disabled={!qrSvgString}
            className="tool-btn-secondary"
          >
            <Download size={15} />
            <span>Download SVG</span>
          </button>

          <button
            type="button"
            onClick={handleCopyImage}
            disabled={!qrDataUrl}
            className="tool-btn-secondary"
          >
            <Copy size={15} />
            <span>Copy Image</span>
          </button>
        </div>
      </div>
    </div>
  );
}
