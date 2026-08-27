"use client";

import React, { useEffect, useState } from "react";

export function AppInitialLoader({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Only show the splash screen on first session load or PWA cold launch
    const hasSeenSplash = typeof window !== "undefined" ? sessionStorage.getItem("flumenx_os_splash_seen") : "true";

    if (!hasSeenSplash) {
      setShowSplash(true);
      sessionStorage.setItem("flumenx_os_splash_seen", "true");

      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setHiding(true);
              setTimeout(() => setShowSplash(false), 500);
            }, 300);
            return 100;
          }
          return prev + Math.floor(Math.random() * 25) + 10;
        });
      }, 70);

      return () => clearInterval(interval);
    }
  }, []);

  return (
    <>
      {showSplash && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "radial-gradient(circle at 50% 40%, #13231F 0%, #080E0C 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: hiding ? 0 : 1,
            transform: hiding ? "scale(1.04)" : "scale(1)",
            transition: "opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: hiding ? "none" : "auto",
          }}
        >
          {/* Ambient Glow */}
          <div
            style={{
              position: "absolute",
              width: "280px",
              height: "280px",
              background: "radial-gradient(circle, rgba(8, 122, 91, 0.35) 0%, rgba(0,0,0,0) 70%)",
              borderRadius: "50%",
              filter: "blur(40px)",
              pointerEvents: "none",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              zIndex: 2,
            }}
          >
            {/* Animated Logo */}
            <div
              style={{
                position: "relative",
                marginBottom: "20px",
                animation: "floatSlow 3s ease-in-out infinite",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/flumenx-mark-only.png"
                alt="FLUMENX OS"
                style={{
                  width: "72px",
                  height: "72px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 0 25px rgba(52, 211, 153, 0.45))",
                }}
              />
            </div>

            {/* Typography */}
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 900,
                  letterSpacing: "0.28em",
                  color: "#FFFFFF",
                  fontFamily: "var(--font-body), sans-serif",
                  marginBottom: "4px",
                  textShadow: "0 0 20px rgba(255,255,255,0.3)",
                }}
              >
                FLUMENX <span style={{ color: "#34D399" }}>OS</span>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  color: "rgba(255, 255, 255, 0.5)",
                  textTransform: "uppercase",
                }}
              >
                Enterprise Workspace Hub
              </div>
            </div>

            {/* Progress Track */}
            <div
              style={{
                width: "200px",
                height: "3px",
                background: "rgba(255, 255, 255, 0.08)",
                borderRadius: "999px",
                overflow: "hidden",
                position: "relative",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #087A5B 0%, #34D399 100%)",
                  boxShadow: "0 0 10px #34D399",
                  borderRadius: "999px",
                  transition: "width 0.15s ease-out",
                }}
              />
            </div>

            <div
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "rgba(255, 255, 255, 0.4)",
                fontFamily: "monospace",
              }}
            >
              INITIALIZING {Math.min(100, progress)}%
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
