"use client";

import React from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Compass,
  MapPin,
  Navigation,
  Power,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { TOKENS } from "@/components/design-system/tokens";
import { useLocationTracker } from "./useLocationTracker";

export function EmployeeTrackingCard() {
  const {
    trackingStatus,
    currentPoint,
    gpsAccuracy,
    speedKmh,
    lastUpdatedText,
    errorText,
    isActionLoading,
    todaySummary,
    goOnline,
    goOffline,
  } = useLocationTracker();

  const isOnline = trackingStatus === "ONLINE";
  const isGpsLost = trackingStatus === "GPS_LOST";
  const isDisconnected = trackingStatus === "DISCONNECTED";
  const isOffline = trackingStatus === "OFFLINE";
  const isError = trackingStatus === "ERROR";

  return (
    <div
      style={{
        backgroundColor: TOKENS.colors.surfacePanel,
        border: `1px solid ${
          isOnline
            ? TOKENS.colors.brandBorder
            : isGpsLost || isDisconnected
            ? TOKENS.colors.warningBorder
            : TOKENS.colors.borderLight
        }`,
        borderTop: `4px solid ${
          isOnline
            ? TOKENS.colors.brandPrimary
            : isGpsLost || isDisconnected
            ? TOKENS.colors.warning
            : TOKENS.colors.borderStrong
        }`,
        borderRadius: TOKENS.radius.lg,
        padding: "20px 24px",
        boxShadow: TOKENS.shadows.sm,
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Top Header: Title & Live Status Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: TOKENS.radius.md,
              backgroundColor: isOnline ? TOKENS.colors.brandSubtle : TOKENS.colors.surfaceSubtle,
              color: isOnline ? TOKENS.colors.brandPrimary : TOKENS.colors.textSecondary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${isOnline ? TOKENS.colors.brandBorder : TOKENS.colors.borderLight}`,
            }}
          >
            <MapPin size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: TOKENS.colors.textPrimary }}>
              GPS Location Tracking
            </h3>
            <p style={{ fontSize: "12px", color: TOKENS.colors.textSecondary, margin: "2px 0 0 0" }}>
              {isOnline
                ? "Live GPS tracking is active and transmitting."
                : isOffline
                ? "Location tracking is currently inactive."
                : isGpsLost
                ? "GPS signal lost. Trying to reconnect..."
                : isDisconnected
                ? "Connection lost. Local queue active."
                : "Tracking status requires attention."}
            </p>
          </div>
        </div>

        {/* Dynamic Status Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.02em",
            background: isOnline
              ? TOKENS.colors.successBg
              : isGpsLost || isDisconnected
              ? TOKENS.colors.warningBg
              : isError
              ? TOKENS.colors.dangerBg
              : TOKENS.colors.surfaceSubtle,
            color: isOnline
              ? TOKENS.colors.success
              : isGpsLost || isDisconnected
              ? TOKENS.colors.warning
              : isError
              ? TOKENS.colors.danger
              : TOKENS.colors.textMuted,
            border: `1px solid ${
              isOnline
                ? TOKENS.colors.successBorder
                : isGpsLost || isDisconnected
                ? TOKENS.colors.warningBorder
                : isError
                ? TOKENS.colors.dangerBorder
                : TOKENS.colors.borderLight
            }`,
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: isOnline
                ? TOKENS.colors.success
                : isGpsLost || isDisconnected
                ? TOKENS.colors.warning
                : isError
                ? TOKENS.colors.danger
                : "#94A3B8",
              display: "inline-block",
              boxShadow: isOnline ? "0 0 8px rgba(22, 133, 91, 0.8)" : "none",
            }}
          />
          {isOnline
            ? "ONLINE"
            : isGpsLost
            ? "GPS SIGNAL LOST"
            : isDisconnected
            ? "CONNECTION LOST"
            : isError
            ? "PERMISSION ERROR"
            : "OFFLINE"}
        </div>
      </div>

      {/* Error / Alert Message Banner if any */}
      {errorText && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: TOKENS.radius.md,
            background: TOKENS.colors.warningBg,
            border: `1px solid ${TOKENS.colors.warningBorder}`,
            color: "#92400E",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{errorText}</span>
        </div>
      )}

      {/* Live Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "10px",
          background: TOKENS.colors.surfaceSubtle,
          borderRadius: TOKENS.radius.md,
          padding: "12px",
          border: `1px solid ${TOKENS.colors.borderLight}`,
        }}
      >
        <div>
          <span style={{ fontSize: "10px", color: TOKENS.colors.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
            Last Updated
          </span>
          <div style={{ fontSize: "13px", fontWeight: 700, color: TOKENS.colors.textPrimary, marginTop: "2px" }}>
            {lastUpdatedText}
          </div>
        </div>

        <div>
          <span style={{ fontSize: "10px", color: TOKENS.colors.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
            GPS Accuracy
          </span>
          <div style={{ fontSize: "13px", fontWeight: 700, color: TOKENS.colors.textPrimary, marginTop: "2px" }}>
            {gpsAccuracy !== null ? `${gpsAccuracy} metres` : "—"}
          </div>
        </div>

        <div>
          <span style={{ fontSize: "10px", color: TOKENS.colors.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
            Current Speed
          </span>
          <div style={{ fontSize: "13px", fontWeight: 700, color: TOKENS.colors.textPrimary, marginTop: "2px" }}>
            {isOnline ? `${speedKmh} km/h` : "0 km/h"}
          </div>
        </div>

        <div>
          <span style={{ fontSize: "10px", color: TOKENS.colors.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
            Today&apos;s Distance
          </span>
          <div style={{ fontSize: "13px", fontWeight: 700, color: TOKENS.colors.brandPrimary, marginTop: "2px" }}>
            {todaySummary.totalDistanceKm} km
          </div>
        </div>
      </div>

      {/* Primary Action Button (GO ONLINE / GO OFFLINE) */}
      <div>
        {isOnline || isGpsLost || isDisconnected ? (
          <button
            type="button"
            onClick={goOffline}
            disabled={isActionLoading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: TOKENS.radius.md,
              background: TOKENS.colors.danger,
              color: "#FFFFFF",
              border: 0,
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)",
            }}
          >
            <Power size={16} />
            {isActionLoading ? "Stopping Tracking..." : "GO OFFLINE"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goOnline}
            disabled={isActionLoading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: TOKENS.radius.md,
              background: TOKENS.colors.brandPrimary,
              color: "#FFFFFF",
              border: 0,
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 2px 8px rgba(8, 122, 91, 0.25)",
            }}
          >
            <Power size={16} />
            {isActionLoading ? "Requesting GPS & Starting..." : "GO ONLINE"}
          </button>
        )}
      </div>
    </div>
  );
}
