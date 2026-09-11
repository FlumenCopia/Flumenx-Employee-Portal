"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Copy, Check, Shield, Key } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function PasswordGeneratorTool() {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true);
  const [count, setCount] = useState(1);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generatePasswords = useCallback(() => {
    let charset = "";
    if (useUpper) charset += excludeAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (useLower) charset += excludeAmbiguous ? "abcdefghijkmnpqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
    if (useNumbers) charset += excludeAmbiguous ? "23456789" : "0123456789";
    if (useSymbols) charset += "!@#$%^&*()_+~`|}{[]:;?><,.-=";

    if (!charset) {
      setPasswords(["Please select at least one character type."]);
      return;
    }

    const generatedList: string[] = [];
    for (let c = 0; c < count; c++) {
      const array = new Uint32Array(length);
      window.crypto.getRandomValues(array);
      let pwd = "";
      for (let i = 0; i < length; i++) {
        pwd += charset[array[i] % charset.length];
      }
      generatedList.push(pwd);
    }
    setPasswords(generatedList);
  }, [length, useUpper, useLower, useNumbers, useSymbols, excludeAmbiguous, count]);

  useEffect(() => {
    generatePasswords();
  }, [generatePasswords]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(passwords.join("\n"));
    toast.success(`Copied all ${passwords.length} passwords!`);
  };

  // Strength calculation
  const calcStrength = () => {
    let score = 0;
    if (length >= 12) score += 1;
    if (length >= 16) score += 1;
    if (length >= 24) score += 1;
    let sets = 0;
    if (useUpper) sets++;
    if (useLower) sets++;
    if (useNumbers) sets++;
    if (useSymbols) sets++;
    score += sets;

    if (score <= 2) return { label: "Weak", color: "#EF4444", width: "25%" };
    if (score <= 4) return { label: "Fair", color: "#F59E0B", width: "50%" };
    if (score <= 5) return { label: "Good", color: "#3B82F6", width: "75%" };
    return { label: "Very Strong", color: "#10B981", width: "100%" };
  };

  const strength = calcStrength();

  return (
    <div className="tool-two-col">
      {/* Controls */}
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <label className="tool-label" style={{ marginBottom: 0 }}>Password Length: {length}</label>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--tools-primary)" }}>{length} chars</span>
          </div>
          <input
            type="range"
            min="6"
            max="64"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--tools-primary)" }}
          />
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Characters to Include</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", cursor: "pointer" }}>
              <input type="checkbox" checked={useUpper} onChange={(e) => setUseUpper(e.target.checked)} style={{ accentColor: "var(--tools-primary)" }} />
              <span>Uppercase (A-Z)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", cursor: "pointer" }}>
              <input type="checkbox" checked={useLower} onChange={(e) => setUseLower(e.target.checked)} style={{ accentColor: "var(--tools-primary)" }} />
              <span>Lowercase (a-z)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", cursor: "pointer" }}>
              <input type="checkbox" checked={useNumbers} onChange={(e) => setUseNumbers(e.target.checked)} style={{ accentColor: "var(--tools-primary)" }} />
              <span>Numbers (0-9)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", cursor: "pointer" }}>
              <input type="checkbox" checked={useSymbols} onChange={(e) => setUseSymbols(e.target.checked)} style={{ accentColor: "var(--tools-primary)" }} />
              <span>Symbols (!@#$%)</span>
            </label>
          </div>
        </div>

        <div className="tool-field-group">
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", cursor: "pointer" }}>
            <input type="checkbox" checked={excludeAmbiguous} onChange={(e) => setExcludeAmbiguous(e.target.checked)} style={{ accentColor: "var(--tools-primary)" }} />
            <span>Exclude ambiguous characters (0, O, l, 1, I)</span>
          </label>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Generate Quantity</label>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="tool-select">
            <option value={1}>1 Password</option>
            <option value={5}>5 Passwords</option>
            <option value={10}>10 Passwords</option>
            <option value={20}>20 Passwords</option>
          </select>
        </div>

        <button type="button" onClick={generatePasswords} className="tool-btn-primary" style={{ width: "100%", marginTop: "10px" }}>
          <RefreshCw size={16} />
          <span>Regenerate Passwords</span>
        </button>
      </div>

      {/* Output Display */}
      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Generated Password{passwords.length > 1 ? "s" : ""}</span>
          {passwords.length > 1 && (
            <button type="button" onClick={copyAll} style={{ background: "none", border: "none", color: "var(--tools-primary)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
              Copy All
            </button>
          )}
        </div>

        {/* Strength Meter */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "4px" }}>
            <span>Security Strength:</span>
            <span style={{ fontWeight: 700, color: strength.color }}>{strength.label}</span>
          </div>
          <div style={{ height: "6px", backgroundColor: "var(--tools-surface-muted)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: strength.width, backgroundColor: strength.color, transition: "width 0.3s ease" }} />
          </div>
        </div>

        {/* Passwords List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "380px", overflowY: "auto" }}>
          {passwords.map((pwd, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                backgroundColor: "var(--tools-surface)",
                borderRadius: "8px",
                border: "1px solid var(--tools-border)",
                fontFamily: "var(--tools-font-mono)",
                fontSize: "0.95rem",
                wordBreak: "break-all",
              }}
            >
              <span>{pwd}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(pwd, idx)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "6px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: copiedIndex === idx ? "#10B981" : "var(--tools-text-muted)",
                  flexShrink: 0,
                  marginLeft: "10px",
                }}
                title="Copy password"
              >
                {copiedIndex === idx ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
