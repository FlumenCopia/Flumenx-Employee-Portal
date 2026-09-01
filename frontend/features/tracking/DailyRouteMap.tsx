"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FastForward,
  MapPin,
  Navigation,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sliders,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { TOKENS } from "@/components/design-system/tokens";
import type { DailyRouteData } from "@/lib/types";

// Standard production-ready OSM/Carto tile style
const MAP_STYLE: any = {
  version: 8,
  sources: {
    "carto-voyager": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto-voyager-layer",
      type: "raster",
      source: "carto-voyager",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(dateVal?: string | Date | number | null): string {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

interface DailyRouteMapProps {
  initialEmployeeId?: string;
  initialDate?: string;
  employeesList?: { id: string; name: string; employeeCode: string; department: string }[];
  isEmployeeSelfView?: boolean;
}

export function DailyRouteMap({
  initialEmployeeId,
  initialDate,
  employeesList = [],
  isEmployeeSelfView = false,
}: DailyRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const replayMarkerRef = useRef<maplibregl.Marker | null>(null);
  const staticMarkersRef = useRef<maplibregl.Marker[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(initialEmployeeId || "");
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().split("T")[0]
  );
  const [routeData, setRouteData] = useState<DailyRouteData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorText, setErrorText] = useState<string>("");

  // Route Replay State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [replayProgress, setReplayProgress] = useState<number>(0); // 0 to 100
  const [currentReplayPointIndex, setCurrentReplayPointIndex] = useState<number>(0);

  // 1. Fetch Route Data
  const loadRoute = useCallback(async () => {
    setIsLoading(true);
    setErrorText("");
    setIsPlaying(false);
    setReplayProgress(0);
    setCurrentReplayPointIndex(0);

    try {
      const params = new URLSearchParams();
      if (selectedEmployeeId) params.set("employeeId", selectedEmployeeId);
      if (selectedDate) params.set("date", selectedDate);

      const data = await api<DailyRouteData>(`/tracking/route/?${params.toString()}`);
      setRouteData(data);
    } catch (err: any) {
      setErrorText(err.message || "Failed to load route data.");
      setRouteData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmployeeId, selectedDate]);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  // 2. Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [77.5946, 12.9716],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    mapRef.current = map;

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      staticMarkersRef.current.forEach((m) => m.remove());
      staticMarkersRef.current = [];
      if (replayMarkerRef.current) replayMarkerRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 3. Render Route Layer & Pins on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous static markers
    staticMarkersRef.current.forEach((m) => m.remove());
    staticMarkersRef.current = [];

    const handleRender = () => {
      // Remove previous route layers and sources if they exist
      if (map.getLayer("route-casing")) map.removeLayer("route-casing");
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getSource("daily-route-source")) map.removeSource("daily-route-source");

      if (!routeData || !routeData.points || routeData.points.length === 0) {
        return;
      }

      const points = routeData.points;
      const coordinates = points.map((p) => [p.longitude, p.latitude]);

      // Add GeoJSON Source
      map.addSource("daily-route-source", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      });

      // Add Line Casing (Outline) Layer
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "daily-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#044B37",
          "line-width": 7,
          "line-opacity": 0.4,
        },
      });

      // Add Main Vibrant Line Layer
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "daily-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#087A5B",
          "line-width": 4.5,
          "line-opacity": 0.95,
        },
      });

      // Fit map bounds to route
      if (coordinates.length >= 2) {
        const bounds = coordinates.reduce((acc, coord) => {
          return acc.extend(coord as [number, number]);
        }, new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));

        map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 1000 });
      } else if (coordinates.length === 1) {
        map.flyTo({ center: coordinates[0] as [number, number], zoom: 15 });
      }

      // Add START Pin
      const firstPt = points[0];
      if (firstPt) {
        const startEl = document.createElement("div");
        startEl.innerHTML = `
          <div style="
            background: #16855B;
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 800;
            padding: 4px 8px;
            border-radius: 12px;
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
          ">
            <span>● START</span>
            <span style="opacity: 0.85; font-weight: 600;">${formatTime(firstPt.timestamp)}</span>
          </div>
        `;
        const startMarker = new maplibregl.Marker({ element: startEl })
          .setLngLat([firstPt.longitude, firstPt.latitude])
          .addTo(map);
        staticMarkersRef.current.push(startMarker);
      }

      // Add END Pin
      const lastPt = points[points.length - 1];
      if (lastPt && points.length > 1) {
        const endEl = document.createElement("div");
        endEl.innerHTML = `
          <div style="
            background: #DC2626;
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 800;
            padding: 4px 8px;
            border-radius: 12px;
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
          ">
            <span>● END</span>
            <span style="opacity: 0.85; font-weight: 600;">${formatTime(lastPt.timestamp)}</span>
          </div>
        `;
        const endMarker = new maplibregl.Marker({ element: endEl })
          .setLngLat([lastPt.longitude, lastPt.latitude])
          .addTo(map);
        staticMarkersRef.current.push(endMarker);
      }

      // Add Stationary Stops Pins
      if (routeData.stops && routeData.stops.length > 0) {
        routeData.stops.forEach((stop, i) => {
          const stopEl = document.createElement("div");
          stopEl.innerHTML = `
            <div style="
              background: #D97706;
              color: #FFFFFF;
              font-size: 10px;
              font-weight: 700;
              padding: 3px 6px;
              border-radius: 10px;
              border: 1.5px solid #FFFFFF;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              cursor: pointer;
            ">
              ⏸️ ${Math.round(stop.durationSeconds / 60)}m stop
            </div>
          `;
          const stopMarker = new maplibregl.Marker({ element: stopEl })
            .setLngLat([stop.longitude, stop.latitude])
            .addTo(map);
          staticMarkersRef.current.push(stopMarker);
        });
      }
    };

    if (map.isStyleLoaded()) {
      handleRender();
    } else {
      map.once("styledata", handleRender);
    }
  }, [routeData]);

  // 4. Route Replay Animation Engine
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeData || !routeData.points || routeData.points.length === 0) return;

    const points = routeData.points;

    // Create replay marker if not exists
    if (!replayMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "replay-cursor-marker";
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#2563EB";
      el.style.border = "3px solid #FFFFFF";
      el.style.boxShadow = "0 0 15px rgba(37, 99, 235, 0.7)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.color = "#FFFFFF";
      el.style.zIndex = "40";
      el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
      `;

      replayMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([points[0].longitude, points[0].latitude])
        .addTo(map);
    }

    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let currentIndex = currentReplayPointIndex;
    let lastTick = performance.now();

    const animate = (time: number) => {
      const delta = time - lastTick;
      const intervalMs = Math.max(30, 400 / playbackSpeed);

      if (delta >= intervalMs) {
        lastTick = time;
        currentIndex++;

        if (currentIndex >= points.length) {
          setIsPlaying(false);
          setCurrentReplayPointIndex(points.length - 1);
          setReplayProgress(100);
          return;
        }

        const curr = points[currentIndex];
        setCurrentReplayPointIndex(currentIndex);
        setReplayProgress(Math.round((currentIndex / (points.length - 1)) * 100));

        if (replayMarkerRef.current) {
          replayMarkerRef.current.setLngLat([curr.longitude, curr.latitude]);
          const el = replayMarkerRef.current.getElement();
          if (curr.heading) {
            el.style.transform = `rotate(${curr.heading}deg)`;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, routeData, currentReplayPointIndex]);

  // Handle timeline scrubber change
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setReplayProgress(val);

    if (routeData?.points && routeData.points.length > 0) {
      const idx = Math.min(
        routeData.points.length - 1,
        Math.floor((val / 100) * (routeData.points.length - 1))
      );
      setCurrentReplayPointIndex(idx);
      const pt = routeData.points[idx];
      if (replayMarkerRef.current) {
        replayMarkerRef.current.setLngLat([pt.longitude, pt.latitude]);
      }
    }
  };

  const currentPoint = routeData?.points?.[currentReplayPointIndex] || null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        height: "calc(100vh - 120px)",
        minHeight: "650px",
      }}
    >
      {/* Controls Header & Metric Cards */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: TOKENS.colors.surfacePanel,
          border: `1px solid ${TOKENS.colors.borderLight}`,
          borderRadius: TOKENS.radius.lg,
          padding: "12px 20px",
          boxShadow: TOKENS.shadows.sm,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Employee Selector (Only if not in self view) */}
          {!isEmployeeSelfView && employeesList.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: TOKENS.colors.textSecondary, textTransform: "uppercase" }}>
                Employee:
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: TOKENS.radius.md,
                  border: `1px solid ${TOKENS.colors.borderLight}`,
                  fontSize: "12px",
                  fontWeight: 600,
                  color: TOKENS.colors.textPrimary,
                  background: TOKENS.colors.surfaceSubtle,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Select Employee...</option>
                {employeesList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeCode}) - {emp.department}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: TOKENS.colors.textSecondary, textTransform: "uppercase" }}>
              Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: "5px 10px",
                borderRadius: TOKENS.radius.md,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                fontSize: "12px",
                fontWeight: 600,
                color: TOKENS.colors.textPrimary,
                background: TOKENS.colors.surfaceSubtle,
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>

          {/* Quick Date Shortcuts */}
          <button
            type="button"
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            style={{
              padding: "5px 10px",
              borderRadius: TOKENS.radius.md,
              border: `1px solid ${TOKENS.colors.borderLight}`,
              fontSize: "11px",
              fontWeight: 700,
              background:
                selectedDate === new Date().toISOString().split("T")[0]
                  ? TOKENS.colors.brandPrimary
                  : TOKENS.colors.surfaceSubtle,
              color:
                selectedDate === new Date().toISOString().split("T")[0] ? "#FFFFFF" : TOKENS.colors.textSecondary,
              cursor: "pointer",
            }}
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              setSelectedDate(yesterday.toISOString().split("T")[0]);
            }}
            style={{
              padding: "5px 10px",
              borderRadius: TOKENS.radius.md,
              border: `1px solid ${TOKENS.colors.borderLight}`,
              fontSize: "11px",
              fontWeight: 700,
              background: TOKENS.colors.surfaceSubtle,
              color: TOKENS.colors.textSecondary,
              cursor: "pointer",
            }}
          >
            Yesterday
          </button>
        </div>

        <button
          type="button"
          onClick={loadRoute}
          disabled={isLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: TOKENS.colors.surfaceSubtle,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            padding: "6px 12px",
            borderRadius: TOKENS.radius.md,
            fontSize: "12px",
            fontWeight: 600,
            color: TOKENS.colors.textSecondary,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={13} className={isLoading ? "spin" : ""} />
          Reload
        </button>
      </div>

      {/* Summary Metrics Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        <div
          style={{
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            borderRadius: TOKENS.radius.md,
            padding: "12px 16px",
            boxShadow: TOKENS.shadows.sm,
          }}
        >
          <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted, fontWeight: 600, textTransform: "uppercase" }}>
            Total Distance
          </span>
          <div style={{ fontSize: "20px", fontWeight: 800, color: TOKENS.colors.brandPrimary, marginTop: "2px" }}>
            {routeData?.summary?.totalDistanceKm !== undefined ? `${routeData.summary.totalDistanceKm} km` : "0 km"}
          </div>
        </div>

        <div
          style={{
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            borderRadius: TOKENS.radius.md,
            padding: "12px 16px",
            boxShadow: TOKENS.shadows.sm,
          }}
        >
          <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted, fontWeight: 600, textTransform: "uppercase" }}>
            Tracking Duration
          </span>
          <div style={{ fontSize: "20px", fontWeight: 800, color: TOKENS.colors.textPrimary, marginTop: "2px" }}>
            {routeData?.summary?.totalDurationSeconds !== undefined
              ? formatDuration(routeData.summary.totalDurationSeconds)
              : "0m"}
          </div>
        </div>

        <div
          style={{
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            borderRadius: TOKENS.radius.md,
            padding: "12px 16px",
            boxShadow: TOKENS.shadows.sm,
          }}
        >
          <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted, fontWeight: 600, textTransform: "uppercase" }}>
            Start Time
          </span>
          <div style={{ fontSize: "20px", fontWeight: 800, color: TOKENS.colors.success, marginTop: "2px" }}>
            {formatTime(routeData?.summary?.startedAt)}
          </div>
        </div>

        <div
          style={{
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            borderRadius: TOKENS.radius.md,
            padding: "12px 16px",
            boxShadow: TOKENS.shadows.sm,
          }}
        >
          <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted, fontWeight: 600, textTransform: "uppercase" }}>
            End Time
          </span>
          <div style={{ fontSize: "20px", fontWeight: 800, color: TOKENS.colors.danger, marginTop: "2px" }}>
            {formatTime(routeData?.summary?.endedAt)}
          </div>
        </div>

        <div
          style={{
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            borderRadius: TOKENS.radius.md,
            padding: "12px 16px",
            boxShadow: TOKENS.shadows.sm,
          }}
        >
          <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted, fontWeight: 600, textTransform: "uppercase" }}>
            GPS Points
          </span>
          <div style={{ fontSize: "20px", fontWeight: 800, color: TOKENS.colors.textPrimary, marginTop: "2px" }}>
            {routeData?.summary?.pointCount || 0}
          </div>
        </div>
      </div>

      {/* Route Map Canvas & Interactive Replay Controller Overlay */}
      <div
        style={{
          position: "relative",
          flex: 1,
          borderRadius: TOKENS.radius.lg,
          overflow: "hidden",
          border: `1px solid ${TOKENS.colors.borderLight}`,
          boxShadow: TOKENS.shadows.sm,
          background: "#E5E7EB",
          minHeight: 0,
        }}
      >
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* No Points Empty State Alert */}
        {!isLoading && (!routeData || !routeData.points || routeData.points.length === 0) && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(255, 255, 255, 0.95)",
              padding: "24px 32px",
              borderRadius: TOKENS.radius.lg,
              boxShadow: TOKENS.shadows.lg,
              textAlign: "center",
              border: `1px solid ${TOKENS.colors.borderLight}`,
            }}
          >
            <Navigation size={36} style={{ color: TOKENS.colors.brandPrimary, margin: "0 auto 10px", opacity: 0.8 }} />
            <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 700, color: TOKENS.colors.textPrimary }}>
              No Route Points Recorded
            </h4>
            <p style={{ margin: 0, fontSize: "12px", color: TOKENS.colors.textMuted }}>
              No GPS location history was recorded for this employee on {selectedDate}.
            </p>
          </div>
        )}

        {/* Floating Route Replay Controller Bar */}
        {routeData && routeData.points && routeData.points.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "20px",
              right: "20px",
              maxWidth: "680px",
              margin: "0 auto",
              background: "rgba(19, 35, 31, 0.92)",
              backdropFilter: "blur(12px)",
              color: "#FFFFFF",
              borderRadius: TOKENS.radius.lg,
              padding: "14px 20px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
              zIndex: 30,
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            {/* Live HUD Status in Replay */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: isPlaying ? "#10B981" : "#6B7280",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontWeight: 700 }}>
                  {isPlaying ? "Replaying Route..." : "Route Replay"}
                </span>
                {currentPoint && (
                  <span style={{ color: "#9CA3AF" }}>
                    • Time: {formatTime(currentPoint.timestamp)}
                  </span>
                )}
              </div>

              {currentPoint && (
                <div style={{ display: "flex", gap: "12px", color: "#D1D5DB" }}>
                  <span>Speed: {currentPoint.speed ? `${Math.round(currentPoint.speed * 3.6)} km/h` : "0 km/h"}</span>
                  <span>Point: {currentReplayPointIndex + 1} / {routeData.points.length}</span>
                </div>
              )}
            </div>

            {/* Timeline Progress Slider */}
            <div style={{ marginBottom: "12px" }}>
              <input
                type="range"
                min="0"
                max="100"
                value={replayProgress}
                onChange={handleScrubberChange}
                style={{
                  width: "100%",
                  accentColor: "#10B981",
                  cursor: "pointer",
                  height: "5px",
                }}
              />
            </div>

            {/* Replay Controls & Speed Selector */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#10B981",
                    color: "#FFFFFF",
                    border: 0,
                    padding: "7px 16px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {isPlaying ? "Pause" : "Play Replay"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentReplayPointIndex(0);
                    setReplayProgress(0);
                    if (routeData.points[0] && replayMarkerRef.current) {
                      replayMarkerRef.current.setLngLat([
                        routeData.points[0].longitude,
                        routeData.points[0].latitude,
                      ]);
                    }
                  }}
                  style={{
                    background: "rgba(255, 255, 255, 0.12)",
                    color: "#FFFFFF",
                    border: 0,
                    padding: "7px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <RotateCcw size={13} />
                  Reset
                </button>
              </div>

              {/* Speed Multiplier */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "11px", color: "#9CA3AF", marginRight: "4px" }}>Speed:</span>
                {[1, 2, 5, 10].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPlaybackSpeed(s)}
                    style={{
                      background: playbackSpeed === s ? "#10B981" : "rgba(255, 255, 255, 0.1)",
                      color: "#FFFFFF",
                      border: 0,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
