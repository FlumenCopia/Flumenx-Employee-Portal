"use client";

import React, { useEffect, useState } from "react";
import { Download, Smartphone, Laptop, X, Check, Share2, PlusSquare, ExternalLink } from "lucide-react";
import { Modal } from "@/features/common/Modal";

let deferredPromptGlobal: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    deferredPromptGlobal = e;
    window.dispatchEvent(new CustomEvent("flumenx:pwa_installable"));
  });
}

export function PwaInstallButton({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const [canInstall, setCanInstall] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIphoneOrIpad = /iphone|ipad|ipod/.test(ua);
    const isWinOrMac = /windows|macintosh|mac os x|linux/.test(ua) && !/android|iphone|ipad/.test(ua);

    setIsIos(isIphoneOrIpad);
    setIsDesktop(isWinOrMac);

    if (deferredPromptGlobal) {
      setCanInstall(true);
    }

    const handleInstallable = () => setCanInstall(true);
    window.addEventListener("flumenx:pwa_installable", handleInstallable);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setCanInstall(false);
    });

    return () => {
      window.removeEventListener("flumenx:pwa_installable", handleInstallable);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPromptGlobal) {
      deferredPromptGlobal.prompt();
      const { outcome } = await deferredPromptGlobal.userChoice;
      if (outcome === "accepted") {
        deferredPromptGlobal = null;
        setCanInstall(false);
      }
    } else {
      setShowModal(true);
    }
  };

  if (installed) return null;

  if (variant === "sidebar") {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className="sidebar-pwa-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            width: "100%",
            padding: "9px 12px",
            borderRadius: "10px",
            background: "rgba(8, 122, 91, 0.15)",
            border: "1px solid rgba(8, 122, 91, 0.35)",
            color: "#34D399",
            fontSize: "12.5px",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "10px",
            transition: "all 0.2s ease",
          }}
          title="Install FLUMENX BOS App to your phone or desktop"
        >
          <Smartphone size={16} />
          <span>Install FLUMENX App</span>
          <Download size={14} style={{ marginLeft: "auto", opacity: 0.8 }} />
        </button>

        {showModal && <PwaInstructionsModal isIos={isIos} isDesktop={isDesktop} onClose={() => setShowModal(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="topbar-pwa-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 11px",
          borderRadius: "8px",
          background: "rgba(8, 122, 91, 0.1)",
          border: "1px solid rgba(8, 122, 91, 0.3)",
          color: "#087A5B",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        title="Download FLUMENX App"
      >
        <Smartphone size={14} />
        <span>Install App</span>
      </button>

      {showModal && <PwaInstructionsModal isIos={isIos} isDesktop={isDesktop} onClose={() => setShowModal(false)} />}
    </>
  );
}

function PwaInstructionsModal({ isIos, isDesktop, onClose }: { isIos: boolean; isDesktop: boolean; onClose: () => void }) {
  return (
    <Modal title="Install FLUMENX BOS" onClose={onClose}>
      <div style={{ padding: "6px 0", color: "#18231F" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/flumenx-mark-only.png"
            alt="FLUMENX BOS"
            style={{ width: "44px", height: "44px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
          />
          <div>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>FLUMENX BOS Enterprise</h4>
            <p style={{ margin: 0, fontSize: "12.5px", color: "#64748B" }}>Standalone Desktop & Mobile Application</p>
          </div>
        </div>

        {isDesktop ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
            <div style={{ padding: "12px", background: "rgba(8, 122, 91, 0.08)", borderRadius: "10px", border: "1px solid rgba(8, 122, 91, 0.25)" }}>
              <div style={{ fontWeight: 800, color: "#087A5B", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Laptop size={16} />
                <span>Desktop App / Shortcut</span>
              </div>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#334155", lineHeight: "1.4" }}>
                If you already installed the shortcut on your Windows PC, click the <b>&quot;Open in app&quot;</b> button in your Chrome address bar (top right).
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <span style={{ background: "#087A5B", color: "#FFFFFF", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800 }}>1</span>
              <span>Click the <b>Install App icon (<Download size={14} style={{ display: "inline", verticalAlign: "middle" }} />)</b> in your browser address bar.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <span style={{ background: "#087A5B", color: "#FFFFFF", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800 }}>2</span>
              <span>Or click <b>Menu (⋮) &rarr; &quot;Cast, save, and share&quot; &rarr; &quot;Install FLUMENX BOS&quot;</b>.</span>
            </div>
          </div>
        ) : isIos ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <span style={{ background: "#087A5B", color: "#FFFFFF", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800 }}>1</span>
              <span>Tap the <Share2 size={16} style={{ display: "inline", verticalAlign: "middle", margin: "0 4px", color: "#087A5B" }} /> <b>Share button</b> at the bottom of Safari.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <span style={{ background: "#087A5B", color: "#FFFFFF", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800 }}>2</span>
              <span>Scroll down and tap <PlusSquare size={16} style={{ display: "inline", verticalAlign: "middle", margin: "0 4px", color: "#087A5B" }} /> <b>Add to Home Screen</b>.</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <span style={{ background: "#087A5B", color: "#FFFFFF", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800 }}>1</span>
              <span>Tap the <b>three dots menu (⋮)</b> in your browser.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <span style={{ background: "#087A5B", color: "#FFFFFF", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800 }}>2</span>
              <span>Select <Download size={16} style={{ display: "inline", verticalAlign: "middle", margin: "0 4px", color: "#087A5B" }} /> <b>Install app</b> or <b>Add to Home screen</b>.</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              background: "#087A5B",
              color: "#FFFFFF",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}
