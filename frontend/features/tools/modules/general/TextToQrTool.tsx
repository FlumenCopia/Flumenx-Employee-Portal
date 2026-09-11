"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Download, Copy, RefreshCw, FileText } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function TextToQrTool() {
  const [text, setText] = useState("Flumenx Employee Quick Memo\nInternal Reference #49281");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrSvgString, setQrSvgString] = useState("");
  const [size, setSize] = useState(300);

  const generateQr = async () => {
    if (!text.trim()) {
      setQrDataUrl("");
      setQrSvgString("");
      return;
    }
    try {
      const pngUrl = await QRCode.toDataURL(text, {
        width: size,
        margin: 2,
        color: { dark: "#18231F", light: "#FFFFFF" },
      });
      setQrDataUrl(pngUrl);

      const svg = await QRCode.toString(text, {
        type: "svg",
        width: size,
        margin: 2,
        color: { dark: "#18231F", light: "#FFFFFF" },
      });
      setQrSvgString(svg);
    } catch (err) {
      toast.error("Text is too long or invalid for single QR code.");
    }
  };

  useEffect(() => {
    generateQr();
  }, [text, size]);

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `text_qr_${Date.now()}.png`;
    link.click();
    toast.success("PNG downloaded!");
  };

  const handleDownloadSvg = () => {
    if (!qrSvgString) return;
    const blob = new Blob([qrSvgString], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `text_qr_${Date.now()}.svg`;
    link.click();
    toast.success("SVG downloaded!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <label className="tool-label" style={{ marginBottom: 0 }}>Text / Message Content</label>
            <span style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)" }}>
              {text.length} characters
            </span>
          </div>
          <textarea
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste any text, notes, instructions..."
            className="tool-textarea"
          />
          <p className="tool-help-text">Can encode any alphanumeric text, notes, or multi-line messages.</p>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Resolution: {size} × {size} px</label>
          <input
            type="range"
            min="200"
            max="600"
            step="20"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--tools-primary)" }}
          />
        </div>
      </div>

      <div className="tool-output-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="tool-output-header" style={{ width: "100%" }}>
          <span className="tool-output-title">QR Preview</span>
        </div>

        <div
          style={{
            padding: "16px",
            backgroundColor: "#FFFFFF",
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
            <img src={qrDataUrl} alt="Text QR" style={{ maxWidth: "100%", maxHeight: "280px" }} />
          ) : (
            <div style={{ color: "var(--tools-text-muted)" }}>Type text to generate QR</div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "center" }}>
          <button type="button" onClick={handleDownloadPng} disabled={!qrDataUrl} className="tool-btn-primary">
            <Download size={15} />
            <span>Download PNG</span>
          </button>
          <button type="button" onClick={handleDownloadSvg} disabled={!qrSvgString} className="tool-btn-secondary">
            <Download size={15} />
            <span>Download SVG</span>
          </button>
        </div>
      </div>
    </div>
  );
}
