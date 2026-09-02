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
  Route,
} from "lucide-react";
import { api } from "@/lib/api";
import { TOKENS } from "@/components/design-system/tokens";
import type { DailyRouteData } from "@/lib/types";

// Free raster tile styles (zero watermark, no API key required)
const MAP_STYLES = {
  dark: {
    name: "Night Radar",
    version: 8,
    sources: {
      "dark-tiles": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: '&copy; CartoDB & OpenStreetMap',
      },
    },
    layers: [
      {
        id: "dark-tiles-layer",
        type: "raster",
        source: "dark-tiles",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
  streets: {
    name: "Street Map",
    version: 8,
    sources: {
      "osm-tiles": {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap',
      },
    },
    layers: [
      {
        id: "osm-tiles-layer",
        type: "raster",
        source: "osm-tiles",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
  light: {
    name: "Clean Light",
    version: 8,
    sources: {
      "light-tiles": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: '&copy; CartoDB & OpenStreetMap',
      },
    },
    layers: [
      {
        id: "light-tiles-layer",
        type: "raster",
        source: "light-tiles",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
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
  const dashAnimFrameRef = useRef<number | null>(null);
  const dashOffsetRef = useRef<number>(0);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(initialEmployeeId || "");
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().split("T")[0]
  );
  const [currentMapStyle, setCurrentMapStyle] = useState<"dark" | "streets" | "light">("dark");
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

    const styleObj = MAP_STYLES[currentMapStyle] || MAP_STYLES.dark;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleObj as any,
      center: [77.5946, 12.9716],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    mapRef.current = map;

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (dashAnimFrameRef.current) cancelAnimationFrame(dashAnimFrameRef.current);
      staticMarkersRef.current.forEach((m) => m.remove());
      staticMarkersRef.current = [];
      if (replayMarkerRef.current) replayMarkerRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleSwitchMapStyle = (styleKey: "dark" | "streets" | "light") => {
    setCurrentMapStyle(styleKey);
    const map = mapRef.current;
    if (map) {
      map.setStyle(MAP_STYLES[styleKey] as any);
    }
  };

  // 3. Render Route Layer & Pins on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous static markers
    staticMarkersRef.current.forEach((m) => m.remove());
    staticMarkersRef.current = [];

    const handleRender = () => {
      // Remove previous route layers and sources if they exist
      if (map.getLayer("route-glow")) map.removeLayer("route-glow");
      if (map.getLayer("route-casing")) map.removeLayer("route-casing");
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getLayer("route-dash")) map.removeLayer("route-dash");
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

      // Layer 1: Ambient Glow
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "daily-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#10B981",
          "line-width": 12,
          "line-blur": 6,
          "line-opacity": 0.5,
        },
      });

      // Layer 2: Line Casing
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "daily-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#064E3B",
          "line-width": 7,
          "line-opacity": 0.85,
        },
      });

      // Layer 3: Main Vibrant Emerald Line
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "daily-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#34D399",
          "line-width": 4,
          "line-opacity": 0.95,
        },
      });

      // Layer 4: Animated Flowing Laser Dash
      map.addLayer({
        id: "route-dash",
        type: "line",
        source: "daily-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 3,
          "line-dasharray": [0, 4, 3],
          "line-opacity": 0.9,
        },
      });

      // Fit map bounds to route
      if (coordinates.length >= 2) {
        const bounds = coordinates.reduce((acc, coord) => {
          return acc.extend(coord as [number, number]);
        }, new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));

        map.fitBounds(bounds, { padding: 90, maxZoom: 16, duration: 1000 });
      } else if (coordinates.length === 1) {
        map.flyTo({ center: coordinates[0] as [number, number], zoom: 15 });
      }

      // Add START Pin
      const firstPt = points[0];
      if (firstPt) {
        const startEl = document.createElement("div");
        startEl.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #10B981 0%, #047857 100%);
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 800;
            padding: 5px 10px;
            border-radius: 16px;
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5);
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
          ">
            <span>🏁 START</span>
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
            background: linear-gradient(135deg, #EF4444 0%, #B91C1C 100%);
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 800;
            padding: 5px 10px;
            border-radius: 16px;
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.5);
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
          ">
            <span>🛑 FINISH</span>
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
              padding: 4px 8px;
              border-radius: 12px;
              border: 1.5px solid #FFFFFF;
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
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
  }, [routeData, currentMapStyle]);

  // Dash Line Animation Loop
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let lastStep = 0;
    const animateDash = (timestamp: number) => {
      if (timestamp - lastStep > 60) {
        lastStep = timestamp;
        dashOffsetRef.current = (dashOffsetRef.current + 1) % 12;

        if (map.getLayer("route-dash")) {
          const dash1 = (dashOffsetRef.current % 6);
          const dash2 = ((dashOffsetRef.current + 3) % 6);
          map.setPaintProperty("route-dash", "line-dasharray", [0, dash1 + 1, dash2 + 2, 2]);
        }
      }
      dashAnimFrameRef.current = requestAnimationFrame(animateDash);
    };

    dashAnimFrameRef.current = requestAnimationFrame(animateDash);

    return () => {
      if (dashAnimFrameRef.current) cancelAnimationFrame(dashAnimFrameRef.current);
    };
  }, []);

  // 4. Route Replay Animation Engine with Smooth Vector Interpolation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeData || !routeData.points || routeData.points.length === 0) return;

    const points = routeData.points;

    // Create replay marker if not exists
    if (!replayMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "replay-cursor-marker";
      el.style.width = "40px";
      el.style.height = "40px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#10B981";
      el.style.border = "3px solid #FFFFFF";
      el.style.boxShadow = "0 0 20px rgba(16, 185, 129, 0.9)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.color = "#FFFFFF";
      el.style.zIndex = "40";
      el.style.transition = "transform 0.15s ease-out";
      el.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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
      const intervalMs = Math.max(25, 350 / playbackSpeed);

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
        height: "calc(100vh - 180px)",
        minHeight: "440px",
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
          padding: "14px 20px",
          boxShadow: TOKENS.shadows.sm,
        }}
      >
        {/* Left: Filters & Dropdowns */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {!isEmployeeSelfView && employeesList.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: TOKENS.colors.textSecondary }}>
                Employee:
              </span>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: TOKENS.radius.md,
                  border: `1px solid ${TOKENS.colors.borderLight}`,
                  background: TOKENS.colors.surfaceSubtle,
                  fontSize: "12px",
                  fontWeight: 600,
                  color: TOKENS.colors.textPrimary,
                  cursor: "pointer",
                }}
              >
                <option value="">All Tracked Staff</option>
                {employeesList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeCode} • {emp.department})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: TOKENS.colors.textSecondary }}>
              Date:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: "5px 10px",
                borderRadius: TOKENS.radius.md,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                background: TOKENS.colors.surfaceSubtle,
                fontSize: "12px",
                fontWeight: 600,
                color: TOKENS.colors.textPrimary,
                cursor: "pointer",
              }}
            />
          </div>

          {/* Map Style Selector */}
          <div
            style={{
              display: "flex",
              background: TOKENS.colors.surfaceSubtle,
              padding: "2px",
              borderRadius: TOKENS.radius.md,
              border: `1px solid ${TOKENS.colors.borderLight}`,
            }}
          >
            {(["dark", "streets", "light"] as const).map((styleKey) => (
              <button
                key={styleKey}
                type="button"
                onClick={() => handleSwitchMapStyle(styleKey)}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: 0,
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: currentMapStyle === styleKey ? TOKENS.colors.brandPrimary : "transparent",
                  color: currentMapStyle === styleKey ? "#FFFFFF" : TOKENS.colors.textSecondary,
                  transition: "all 0.15s ease",
                }}
              >
                {styleKey === "dark" ? "Night Radar" : styleKey === "streets" ? "Streets" : "Light"}
              </button>
            ))}
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
            Sync
          </button>
        </div>

        {/* Right Summary Metrics */}
        {routeData && routeData.summary && (
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10px", color: TOKENS.colors.textMuted, textTransform: "uppercase" }}>Distance</div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: TOKENS.colors.brandPrimary }}>
                {routeData.summary.totalDistanceKm} km
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10px", color: TOKENS.colors.textMuted, textTransform: "uppercase" }}>Duration</div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: TOKENS.colors.textPrimary }}>
                {formatDuration(routeData.summary.totalDurationSeconds)}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10px", color: TOKENS.colors.textMuted, textTransform: "uppercase" }}>Checkpoints</div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#10B981" }}>
                {routeData.summary.pointCount} points
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Canvas with Floating Replay HUD */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: "450px",
          borderRadius: TOKENS.radius.lg,
          overflow: "hidden",
          border: `1px solid ${TOKENS.colors.borderLight}`,
          boxShadow: TOKENS.shadows.sm,
          background: "#0F172A",
        }}
      >
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* Floating Route Replay Controller */}
        {routeData && routeData.points && routeData.points.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "24px",
              left: "24px",
              right: "24px",
              maxWidth: "680px",
              margin: "0 auto",
              background: "rgba(15, 23, 42, 0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: TOKENS.radius.lg,
              padding: "16px 20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              zIndex: 20,
              color: "#FFFFFF",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "#10B981",
                    color: "#FFFFFF",
                    border: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 14px rgba(16, 185, 129, 0.6)",
                  }}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: "2px" }} />}
                </button>

                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>
                    {isPlaying ? "Replaying Animated Route..." : "Route Playback Paused"}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                    Time: {formatTime(currentPoint?.timestamp)} • Speed:{" "}
                    {currentPoint?.speed ? `${Math.round(currentPoint.speed * 3.6)} km/h` : "0 km/h"}
                  </div>
                </div>
              </div>

              {/* Playback Speed Switcher */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {[1, 2, 5, 10].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: playbackSpeed === spd ? "#10B981" : "rgba(255,255,255,0.08)",
                      color: "#FFFFFF",
                    }}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Scrubber Slider */}
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
              }}
            />
          </div>
        )}
      </div>

      <style jsx global>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
