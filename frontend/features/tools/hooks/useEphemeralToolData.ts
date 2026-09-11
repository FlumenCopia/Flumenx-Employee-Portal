"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ToastContext";

interface UseEphemeralToolDataOptions {
  /** Time-to-live in seconds before auto-purging data (default: 15 minutes = 900s) */
  defaultTtlSeconds?: number;
  /** Callback fired when auto-cleanup occurs */
  onCleanup?: () => void;
  /** Whether the tool currently has active user data loaded */
  hasData?: boolean;
}

export function useEphemeralToolData({
  defaultTtlSeconds = 900, // 15 minutes
  onCleanup,
  hasData = false,
}: UseEphemeralToolDataOptions = {}) {
  const [ttlSeconds, setTtlSeconds] = useState<number>(defaultTtlSeconds);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(defaultTtlSeconds);
  const onCleanupRef = useRef(onCleanup);
  onCleanupRef.current = onCleanup;

  // Reset timer whenever user interacts or provides new data
  const touchActivity = useCallback(() => {
    setSecondsRemaining(ttlSeconds);
  }, [ttlSeconds]);

  // Change TTL preset (e.g. 5m = 300, 15m = 900, 30m = 1800)
  const changeTtl = useCallback((newTtlSeconds: number) => {
    setTtlSeconds(newTtlSeconds);
    setSecondsRemaining(newTtlSeconds);
    toast.info(`Auto-delete timer set to ${Math.round(newTtlSeconds / 60)} minutes.`);
  }, []);

  // Explicit wipe function
  const wipeData = useCallback(() => {
    if (onCleanupRef.current) {
      onCleanupRef.current();
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("flumenx:wipe_tool_data"));
    }
    setSecondsRemaining(ttlSeconds);
    toast.success("All tool data & browser memory purged.");
  }, [ttlSeconds]);

  // Countdown effect
  useEffect(() => {
    if (!hasData) {
      setSecondsRemaining(ttlSeconds);
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (onCleanupRef.current) {
            onCleanupRef.current();
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("flumenx:wipe_tool_data"));
          }
          toast.info("Auto-cleanup: Tool data automatically deleted for your privacy.");
          return ttlSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [hasData, ttlSeconds]);

  // Listen to global wipe event from header or other components
  useEffect(() => {
    const handleGlobalWipe = () => {
      if (onCleanupRef.current) {
        onCleanupRef.current();
      }
      setSecondsRemaining(ttlSeconds);
    };

    const handleGlobalTouch = () => {
      setSecondsRemaining(ttlSeconds);
    };

    window.addEventListener("flumenx:wipe_tool_data", handleGlobalWipe);
    window.addEventListener("flumenx:touch_tool_data", handleGlobalTouch);

    return () => {
      window.removeEventListener("flumenx:wipe_tool_data", handleGlobalWipe);
      window.removeEventListener("flumenx:touch_tool_data", handleGlobalTouch);
    };
  }, [ttlSeconds]);

  // Format mm:ss
  const formatTimeRemaining = () => {
    const m = Math.floor(secondsRemaining / 60);
    const s = secondsRemaining % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return {
    secondsRemaining,
    ttlSeconds,
    timeRemainingFormatted: formatTimeRemaining(),
    touchActivity,
    changeTtl,
    wipeData,
  };
}
