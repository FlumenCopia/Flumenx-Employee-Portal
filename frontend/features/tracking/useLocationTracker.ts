"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "@/lib/api";
import type { LiveLocationPoint, TrackingStatus, TrackingSession } from "@/lib/types";

interface UseLocationTrackerReturn {
  trackingStatus: TrackingStatus;
  currentPoint: LiveLocationPoint | null;
  gpsAccuracy: number | null;
  speedKmh: number;
  lastUpdatedText: string;
  lastLocationTime: Date | null;
  errorText: string;
  isActionLoading: boolean;
  activeSession: TrackingSession | null;
  todaySummary: {
    totalDistanceKm: number;
    totalDurationSeconds: number;
    totalPoints: number;
    trackingStarted: string | null;
  };
  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export function useLocationTracker(): UseLocationTrackerReturn {
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("OFFLINE");
  const [currentPoint, setCurrentPoint] = useState<LiveLocationPoint | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [lastLocationTime, setLastLocationTime] = useState<Date | null>(null);
  const [lastUpdatedText, setLastUpdatedText] = useState<string>("Never");
  const [errorText, setErrorText] = useState<string>("");
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<TrackingSession | null>(null);
  const [todaySummary, setTodaySummary] = useState({
    totalDistanceKm: 0,
    totalDurationSeconds: 0,
    totalPoints: 0,
    trackingStarted: null as string | null,
  });

  const socketRef = useRef<Socket | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const offlineQueueRef = useRef<any[]>([]);
  const lastTransmittedPointRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const isOnlineStateRef = useRef<boolean>(false);

  // Helper for relative time text
  const updateRelativeTime = useCallback(() => {
    if (!lastLocationTime) {
      setLastUpdatedText("Never");
      return;
    }
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastLocationTime.getTime()) / 1000));
    if (elapsedSeconds < 5) {
      setLastUpdatedText("Just now");
    } else if (elapsedSeconds < 60) {
      setLastUpdatedText(`${elapsedSeconds} seconds ago`);
    } else if (elapsedSeconds < 3600) {
      setLastUpdatedText(`${Math.floor(elapsedSeconds / 60)} minutes ago`);
    } else {
      setLastUpdatedText(lastLocationTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    }
  }, [lastLocationTime]);

  // Tick relative time every 5 seconds
  useEffect(() => {
    const interval = setInterval(updateRelativeTime, 5000);
    return () => clearInterval(interval);
  }, [updateRelativeTime]);

  // 1. Initialize Socket.IO connection
  useEffect(() => {
    let socketUrl = "";
    if (typeof window !== "undefined") {
      socketUrl = window.location.origin;
    }

    const socket = io(socketUrl || "", {
      path: "/socket.io/",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // If we have buffered points in offline queue, flush them
      if (offlineQueueRef.current.length > 0) {
        const queueToSync = [...offlineQueueRef.current];
        offlineQueueRef.current = [];
        socket.emit("tracking:sync-batch", { points: queueToSync });
      }

      if (isOnlineStateRef.current) {
        setTrackingStatus("ONLINE");
        setErrorText("");
      }
    });

    socket.on("disconnect", () => {
      if (isOnlineStateRef.current) {
        setTrackingStatus("DISCONNECTED");
      }
    });

    socket.on("tracking:status-update", (data: any) => {
      if (data?.trackingStatus === "ONLINE") {
        setTrackingStatus("ONLINE");
        isOnlineStateRef.current = true;
        if (data.currentLocation) {
          setCurrentPoint(data.currentLocation);
          setGpsAccuracy(data.currentLocation.accuracy || null);
          setLastLocationTime(new Date(data.currentLocation.timestamp || Date.now()));
        }
      } else if (data?.trackingStatus === "OFFLINE") {
        setTrackingStatus("OFFLINE");
        isOnlineStateRef.current = false;
      }
    });

    socket.on("tracking:location-ack", (ack: any) => {
      if (ack?.totalDistanceKm !== undefined) {
        setTodaySummary((prev) => ({
          ...prev,
          totalDistanceKm: ack.totalDistanceKm,
          totalPoints: prev.totalPoints + (ack.persisted ? 1 : 0),
        }));
      }
    });

    socket.on("tracking:batch-synced", (res: any) => {
      if (res?.totalDistanceKm !== undefined) {
        setTodaySummary((prev) => ({
          ...prev,
          totalDistanceKm: res.totalDistanceKm,
        }));
      }
    });

    socket.on("tracking:error", (err: any) => {
      setErrorText(err?.message || "Tracking error occurred.");
    });

    socket.on("tracking:location-error", (err: any) => {
      setErrorText(err?.message || "GPS location update error.");
      setTrackingStatus("GPS_LOST");
    });

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      socket.disconnect();
    };
  }, []);

  // 2. Fetch Initial Tracking Status from Backend REST API
  const refreshStatus = useCallback(async () => {
    try {
      const data = await api<any>("/tracking/status/");
      if (data) {
        const status = data.trackingStatus || "OFFLINE";
        setTrackingStatus(status === "ONLINE" ? "ONLINE" : "OFFLINE");
        isOnlineStateRef.current = status === "ONLINE";
        setActiveSession(data.activeSession || null);

        if (data.currentLocation) {
          setCurrentPoint(data.currentLocation);
          setGpsAccuracy(data.currentLocation.accuracy || null);
          if (data.currentLocation.speed) {
            setSpeedKmh(Math.round(data.currentLocation.speed * 3.6));
          }
          if (data.currentLocation.timestamp) {
            setLastLocationTime(new Date(data.currentLocation.timestamp));
          }
        }

        if (data.todaySummary) {
          setTodaySummary({
            totalDistanceKm: data.todaySummary.totalDistanceKm || 0,
            totalDurationSeconds: data.todaySummary.totalDurationSeconds || 0,
            totalPoints: data.todaySummary.totalPoints || 0,
            trackingStarted: data.todaySummary.trackingStarted || null,
          });
        }

        // If backend reports tracking is already active, resume watchPosition
        if (status === "ONLINE" && watchIdRef.current === null) {
          startGpsWatch();
        }
      }
    } catch {
      // Status fetch fallback
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // 3. Handle GPS Position Update with Smart Throttling
  const handleGpsPosition = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    const timestamp = new Date(position.timestamp || Date.now());

    // Ignore fix if accuracy is extremely poor (> 100 meters)
    if (accuracy && accuracy > 100) {
      setGpsAccuracy(Math.round(accuracy));
      return;
    }

    const currentSpeedKmh = speed && speed > 0 ? Math.round(speed * 3.6) : 0;
    setSpeedKmh(currentSpeedKmh);
    setGpsAccuracy(accuracy ? Math.round(accuracy) : null);
    setLastLocationTime(timestamp);
    setErrorText("");

    const newPoint: LiveLocationPoint = {
      latitude,
      longitude,
      accuracy: accuracy || 0,
      speed: speed || 0,
      heading: heading || 0,
      timestamp,
    };
    setCurrentPoint(newPoint);

    // Smart Throttling Decision:
    // If moving (> 3.6 km/h / 1 m/s): transmit if >= 5s passed or moved >= 10m
    // If stationary: transmit if >= 30s passed
    const now = Date.now();
    const prev = lastTransmittedPointRef.current;
    let shouldTransmit = false;

    if (!prev) {
      shouldTransmit = true;
    } else {
      const elapsedMs = now - prev.time;
      const isMoving = (speed || 0) > 1.0;

      if (isMoving && elapsedMs >= 5000) {
        shouldTransmit = true;
      } else if (!isMoving && elapsedMs >= 30000) {
        shouldTransmit = true;
      }
    }

    if (shouldTransmit) {
      lastTransmittedPointRef.current = { lat: latitude, lng: longitude, time: now };

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("tracking:location-update", newPoint);
      } else {
        // Enqueue to local offline buffer (cap at 50 points)
        if (offlineQueueRef.current.length >= 50) {
          offlineQueueRef.current.shift();
        }
        offlineQueueRef.current.push(newPoint);
        setTrackingStatus("DISCONNECTED");
      }
    }
  }, []);

  const handleGpsError = useCallback((error: GeolocationPositionError) => {
    let msg = "GPS Signal Lost.";
    if (error.code === error.PERMISSION_DENIED) {
      msg = "Location permission was denied. Please allow location access in your browser settings.";
      setTrackingStatus("ERROR");
      if (socketRef.current) socketRef.current.emit("tracking:permission-denied");
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      msg = "GPS signal is currently unavailable. Trying to reconnect...";
      setTrackingStatus("GPS_LOST");
      if (socketRef.current) socketRef.current.emit("tracking:location-error", { message: msg });
    } else if (error.code === error.TIMEOUT) {
      msg = "GPS location request timed out. Retrying...";
      setTrackingStatus("GPS_LOST");
    }
    setErrorText(msg);
  }, []);

  // 4. Start GPS Watch
  const startGpsWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorText("Geolocation API is not supported on this browser.");
      setTrackingStatus("ERROR");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const watchId = navigator.geolocation.watchPosition(
      handleGpsPosition,
      handleGpsError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
    watchIdRef.current = watchId;
  }, [handleGpsPosition, handleGpsError]);

  // 5. Stop GPS Watch
  const stopGpsWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // 6. Action: GO ONLINE
  const goOnline = useCallback(async () => {
    setIsActionLoading(true);
    setErrorText("");

    try {
      // 1. Explicitly prompt for current position first to verify permission
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        throw new Error("Geolocation is not supported by your browser.");
      }

      const initialPos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        });
      });

      const initialPoint = {
        latitude: initialPos.coords.latitude,
        longitude: initialPos.coords.longitude,
        accuracy: initialPos.coords.accuracy || 0,
        speed: initialPos.coords.speed || 0,
        heading: initialPos.coords.heading || 0,
        timestamp: new Date(),
      };

      // 2. Call backend via Socket or REST
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("tracking:go-online", {
          location: initialPoint,
          deviceInfo: navigator.userAgent,
        });
      } else {
        const res = await api<any>("/tracking/go-online/", {
          method: "POST",
          body: JSON.stringify({ location: initialPoint, deviceInfo: navigator.userAgent }),
        });
        setActiveSession(res.session);
      }

      isOnlineStateRef.current = true;
      setTrackingStatus("ONLINE");
      setCurrentPoint(initialPoint);
      setGpsAccuracy(Math.round(initialPoint.accuracy));
      setLastLocationTime(new Date());
      updateRelativeTime();

      // 3. Start continuous watch
      startGpsWatch();
    } catch (err: any) {
      let msg = err.message || "Failed to start location tracking.";
      if (err.code === 1 || err.name === "GeolocationPositionError") {
        msg = "Location permission denied. Please enable location permissions in browser settings to Go Online.";
      }
      setErrorText(msg);
      setTrackingStatus("ERROR");
    } finally {
      setIsActionLoading(false);
    }
  }, [startGpsWatch, updateRelativeTime]);

  // 7. Action: GO OFFLINE
  const goOffline = useCallback(async () => {
    setIsActionLoading(true);
    setErrorText("");

    try {
      stopGpsWatch();

      let finalPoint = currentPoint;
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 3000,
              maximumAge: 10000,
            });
          });
          finalPoint = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 0,
            speed: 0,
            heading: 0,
            timestamp: new Date(),
          };
        } catch {
          // Use last known point
        }
      }

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("tracking:go-offline", { location: finalPoint });
      } else {
        await api<any>("/tracking/go-offline/", {
          method: "POST",
          body: JSON.stringify({ location: finalPoint }),
        });
      }

      isOnlineStateRef.current = false;
      setTrackingStatus("OFFLINE");
      setSpeedKmh(0);
      setActiveSession(null);
      lastTransmittedPointRef.current = null;
    } catch (err: any) {
      setErrorText(err.message || "Failed to stop location tracking.");
    } finally {
      setIsActionLoading(false);
    }
  }, [currentPoint, stopGpsWatch]);

  return {
    trackingStatus,
    currentPoint,
    gpsAccuracy,
    speedKmh,
    lastUpdatedText,
    lastLocationTime,
    errorText,
    isActionLoading,
    activeSession,
    todaySummary,
    goOnline,
    goOffline,
    refreshStatus,
  };
}
