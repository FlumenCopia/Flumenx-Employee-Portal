"use client";

import React, { useState, useEffect, useRef } from "react";
import { Hash, Copy, Upload, Check } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function HashGeneratorTool() {
  const [sourceText, setSourceText] = useState("Flumenx Secure Hashing System");
  const [uppercase, setUppercase] = useState(false);
  const [hashes, setHashes] = useState<{ [algo: string]: string }>({});
  const [isHashingFile, setIsHashingFile] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateHashes = async (data: ArrayBuffer | string) => {
    const algos = ["SHA-256", "SHA-384", "SHA-512", "SHA-1"];
    const results: { [algo: string]: string } = {};

    let buffer: BufferSource;
    if (typeof data === "string") {
      buffer = new TextEncoder().encode(data);
    } else {
      buffer = data;
    }

    for (const algo of algos) {
      try {
        const hashBuf = await window.crypto.subtle.digest(algo, buffer);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        let hex = hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
        if (uppercase) hex = hex.toUpperCase();
        results[algo] = hex;
      } catch (err) {
        results[algo] = "Algorithm unsupported";
      }
    }

    setHashes(results);
  };

  useEffect(() => {
    if (!fileName) {
      calculateHashes(sourceText);
    }
  }, [sourceText, uppercase, fileName]);

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    setIsHashingFile(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        await calculateHashes(e.target.result);
      }
      setIsHashingFile(false);
      toast.success(`Calculated checksums for ${file.name}`);
    };
    reader.readAsArrayBuffer(file);
  };

  const copyHash = (val: string, algo: string) => {
    navigator.clipboard.writeText(val);
    toast.success(`Copied ${algo} hash!`);
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
          }}
        />

        <div className="tool-field-group">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <label className="tool-label" style={{ marginBottom: 0 }}>Input String</label>
            {fileName && (
              <button
                type="button"
                onClick={() => {
                  setFileName("");
                  calculateHashes(sourceText);
                }}
                style={{ background: "none", border: "none", color: "var(--tools-primary)", fontSize: "0.8rem", cursor: "pointer" }}
              >
                Switch back to text
              </button>
            )}
          </div>
          <textarea
            rows={6}
            disabled={Boolean(fileName)}
            value={fileName ? `[File Mode: ${fileName}]` : sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Type or paste any text to calculate hashes..."
            className="tool-textarea tool-textarea-mono"
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="tool-btn-secondary"
            style={{ width: "100%", fontSize: "0.85rem" }}
          >
            <Upload size={14} />
            <span>Compute Hash from File Checksum</span>
          </button>
        </div>

        <div className="tool-field-group">
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              style={{ accentColor: "var(--tools-primary)" }}
            />
            <span>Uppercase Hexadecimal Output</span>
          </label>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Cryptographic Hashes</span>
        </div>

        {isHashingFile ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--tools-text-muted)" }}>
            Calculating checksum for large file...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {["SHA-256", "SHA-512", "SHA-384", "SHA-1"].map((algo) => {
              const val = hashes[algo] || "...";
              return (
                <div
                  key={algo}
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "var(--tools-surface)",
                    borderRadius: "8px",
                    border: "1px solid var(--tools-border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--tools-primary)" }}>{algo}</span>
                    <button
                      type="button"
                      onClick={() => copyHash(val, algo)}
                      className="tool-btn-secondary"
                      style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                    >
                      <Copy size={12} />
                      <span>Copy</span>
                    </button>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--tools-font-mono)",
                      fontSize: "0.8rem",
                      wordBreak: "break-all",
                      color: "var(--tools-text-primary)",
                      lineHeight: "1.4",
                    }}
                  >
                    {val}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
