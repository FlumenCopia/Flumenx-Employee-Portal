"use client";

import React, { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import { Download, Copy, Wifi, User, Mail, Phone, Globe, FileText, Check } from "lucide-react";
import { toast } from "@/components/ToastContext";

type QrType = "url" | "text" | "wifi" | "vcard" | "email" | "phone";

export function QrGeneratorTool() {
  const [activeTab, setActiveTab] = useState<QrType>("wifi");

  // URL state
  const [urlVal, setUrlVal] = useState("https://flumenx.com");

  // Text state
  const [textVal, setTextVal] = useState("Flumenx Office Utility");

  // Email state
  const [emailTo, setEmailTo] = useState("support@flumenx.com");
  const [emailSubject, setEmailSubject] = useState("Internal Request");
  const [emailBody, setEmailBody] = useState("Hello,\nI need help with...");

  // Phone state
  const [phoneNum, setPhoneNum] = useState("+91 98765 43210");

  // Wi-Fi state
  const [wifiSsid, setWifiSsid] = useState("Flumenx-Guest");
  const [wifiPass, setWifiPass] = useState("WelcomeFlumenx2026");
  const [wifiSec, setWifiSec] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [wifiHidden, setWifiHidden] = useState(false);

  // vCard state
  const [vFirstName, setVFirstName] = useState("Rahul");
  const [vLastName, setVLastName] = useState("Sharma");
  const [vOrg, setVOrg] = useState("Flumenx Corporation");
  const [vTitle, setVTitle] = useState("Product Lead");
  const [vPhone, setVPhone] = useState("+91 9876543210");
  const [vEmail, setVEmail] = useState("rahul@flumenx.com");
  const [vUrl, setVUrl] = useState("https://flumenx.com");

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrSvgString, setQrSvgString] = useState("");

  const payload = useMemo(() => {
    switch (activeTab) {
      case "url":
        return urlVal.trim();
      case "text":
        return textVal;
      case "email": {
        const query = new URLSearchParams();
        if (emailSubject) query.set("subject", emailSubject);
        if (emailBody) query.set("body", emailBody);
        const qStr = query.toString();
        return `mailto:${emailTo}${qStr ? `?${qStr}` : ""}`;
      }
      case "phone":
        return `tel:${phoneNum.replace(/\s+/g, "")}`;
      case "wifi":
        return `WIFI:S:${wifiSsid};T:${wifiSec};P:${wifiPass};H:${wifiHidden ? "true" : "false"};;`;
      case "vcard":
        return `BEGIN:VCARD
VERSION:3.0
N:${vLastName};${vFirstName};;;
FN:${vFirstName} ${vLastName}
ORG:${vOrg}
TITLE:${vTitle}
TEL;TYPE=CELL:${vPhone}
EMAIL:${vEmail}
URL:${vUrl}
END:VCARD`.trim();
      default:
        return "";
    }
  }, [
    activeTab,
    urlVal,
    textVal,
    emailTo,
    emailSubject,
    emailBody,
    phoneNum,
    wifiSsid,
    wifiPass,
    wifiSec,
    wifiHidden,
    vFirstName,
    vLastName,
    vOrg,
    vTitle,
    vPhone,
    vEmail,
    vUrl,
  ]);

  useEffect(() => {
    if (!payload) return;
    QRCode.toDataURL(payload, { width: 320, margin: 2 })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});

    QRCode.toString(payload, { type: "svg", width: 320, margin: 2 })
      .then((svg) => setQrSvgString(svg))
      .catch(() => {});
  }, [payload]);

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `flumenx_qr_${activeTab}_${Date.now()}.png`;
    a.click();
    toast.success("PNG downloaded!");
  };

  const handleDownloadSvg = () => {
    if (!qrSvgString) return;
    const blob = new Blob([qrSvgString], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `flumenx_qr_${activeTab}_${Date.now()}.svg`;
    a.click();
    toast.success("SVG downloaded!");
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payload);
    toast.success("QR payload data copied to clipboard!");
  };

  return (
    <div className="tool-two-col">
      {/* Controls */}
      <div>
        {/* Type Selector Tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
          {[
            { id: "wifi", label: "Wi-Fi Network", icon: Wifi },
            { id: "vcard", label: "vCard Contact", icon: User },
            { id: "url", label: "Website URL", icon: Globe },
            { id: "text", label: "Plain Text", icon: FileText },
            { id: "email", label: "Email", icon: Mail },
            { id: "phone", label: "Phone Call", icon: Phone },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as QrType)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: active ? "1px solid var(--tools-primary)" : "1px solid var(--tools-border)",
                  backgroundColor: active ? "var(--tools-primary-subtle)" : "var(--tools-surface-subtle)",
                  color: active ? "var(--tools-primary)" : "var(--tools-text-secondary)",
                  fontWeight: active ? 600 : 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Inputs */}
        {activeTab === "wifi" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="tool-label">Network Name (SSID)</label>
              <input
                type="text"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="Office-Guest-5G"
                className="tool-input"
              />
            </div>
            <div>
              <label className="tool-label">Password</label>
              <input
                type="text"
                value={wifiPass}
                onChange={(e) => setWifiPass(e.target.value)}
                placeholder="Password"
                className="tool-input"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="tool-label">Security Type</label>
                <select
                  value={wifiSec}
                  onChange={(e) => setWifiSec(e.target.value as any)}
                  className="tool-select"
                >
                  <option value="WPA">WPA / WPA2 / WPA3</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">None (Open)</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", paddingTop: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
                  <input
                    type="checkbox"
                    checked={wifiHidden}
                    onChange={(e) => setWifiHidden(e.target.checked)}
                    style={{ accentColor: "var(--tools-primary)" }}
                  />
                  <span>Hidden Network</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === "vcard" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="tool-label">First Name</label>
              <input type="text" value={vFirstName} onChange={(e) => setVFirstName(e.target.value)} className="tool-input" />
            </div>
            <div>
              <label className="tool-label">Last Name</label>
              <input type="text" value={vLastName} onChange={(e) => setVLastName(e.target.value)} className="tool-input" />
            </div>
            <div>
              <label className="tool-label">Company / Org</label>
              <input type="text" value={vOrg} onChange={(e) => setVOrg(e.target.value)} className="tool-input" />
            </div>
            <div>
              <label className="tool-label">Job Title</label>
              <input type="text" value={vTitle} onChange={(e) => setVTitle(e.target.value)} className="tool-input" />
            </div>
            <div>
              <label className="tool-label">Phone</label>
              <input type="text" value={vPhone} onChange={(e) => setVPhone(e.target.value)} className="tool-input" />
            </div>
            <div>
              <label className="tool-label">Email</label>
              <input type="email" value={vEmail} onChange={(e) => setVEmail(e.target.value)} className="tool-input" />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label className="tool-label">Website</label>
              <input type="url" value={vUrl} onChange={(e) => setVUrl(e.target.value)} className="tool-input" />
            </div>
          </div>
        )}

        {activeTab === "url" && (
          <div className="tool-field-group">
            <label className="tool-label">Target URL</label>
            <input type="url" value={urlVal} onChange={(e) => setUrlVal(e.target.value)} className="tool-input" />
          </div>
        )}

        {activeTab === "text" && (
          <div className="tool-field-group">
            <label className="tool-label">Content</label>
            <textarea rows={5} value={textVal} onChange={(e) => setTextVal(e.target.value)} className="tool-textarea" />
          </div>
        )}

        {activeTab === "email" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label className="tool-label">Recipient Email</label>
              <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="tool-input" />
            </div>
            <div>
              <label className="tool-label">Subject</label>
              <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="tool-input" />
            </div>
            <div>
              <label className="tool-label">Body</label>
              <textarea rows={3} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="tool-textarea" />
            </div>
          </div>
        )}

        {activeTab === "phone" && (
          <div className="tool-field-group">
            <label className="tool-label">Phone Number</label>
            <input type="tel" value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)} className="tool-input" />
            <p className="tool-help-text">Scanning automatically opens the dialer on smartphones.</p>
          </div>
        )}
      </div>

      {/* Output preview */}
      <div className="tool-output-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="tool-output-header" style={{ width: "100%" }}>
          <span className="tool-output-title">Scannable QR</span>
          <button type="button" onClick={handleCopyPayload} style={{ background: "none", border: "none", color: "var(--tools-primary)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
            Copy payload
          </button>
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
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Multi-Type QR" style={{ maxWidth: "100%", maxHeight: "280px" }} />
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "center" }}>
          <button type="button" onClick={handleDownloadPng} className="tool-btn-primary">
            <Download size={15} />
            <span>Download PNG</span>
          </button>
          <button type="button" onClick={handleDownloadSvg} className="tool-btn-secondary">
            <Download size={15} />
            <span>Download SVG</span>
          </button>
        </div>
      </div>
    </div>
  );
}
