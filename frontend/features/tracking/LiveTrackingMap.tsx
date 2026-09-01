"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { io, Socket } from "socket.io-client";
import {
  Activity,
  Compass,
  Eye,
  Maximize2,
  Navigation,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  User,
  Users,
  Wifi,
  WifiOff,
  Zap,
  Clock,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  Radio,
  Crosshair,
  Route,
} from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { TOKENS } from "@/components/design-system/tokens";
import type { LiveEmployeeTracking } from "@/lib/types";

// Free, fast raster tile styles (zero watermark, no API key required)
const MAP_STYLES = {
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
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
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

interface LiveTrackingMapProps {
  onViewRoute?: (employeeId: string) => void;
  onViewHistory?: (employeeId: string) => void;
  onViewSummary?: (employeeId: string) => void;
}

function timeAgo(dateString?: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Never";
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function LiveTrackingMap({ onViewRoute, onViewHistory, onViewSummary }: LiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const markerPositionsRef = useRef<Map<string, { lng: number; lat: number }>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dashOffsetRef = useRef<number>(0);

  const [employees, setEmployees] = useState<LiveEmployeeTracking[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeRoutePoints, setSelectedEmployeeRoutePoints] = useState<[number, number][]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ONLINE" | "DISCONNECTED" | "OFFLINE">("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [currentMapStyle, setCurrentMapStyle] = useState<"streets" | "dark" | "light">("dark");
  const [showAnimatedTrails, setShowAnimatedTrails] = useState<boolean>(true);
  const [showRadarPulses, setShowRadarPulses] = useState<boolean>(true);
  const [followSelected, setFollowSelected] = useState<boolean>(true);
  const [stats, setStats] = useState({ totalEmployees: 0, onlineCount: 0, disconnectedCount: 0, offlineCount: 0 });

  // 1. Fetch live employees from REST API
  const loadEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api<{ employees: LiveEmployeeTracking[]; stats: any }>("/tracking/live/");
      if (data?.employees) {
        setEmployees(data.employees);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error("Failed to load live tracking list:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Fetch Selected Employee's Today Route Trail
  const loadSelectedEmployeeRoute = useCallback(async (empId: string) => {
    if (!empId) {
      setSelectedEmployeeRoutePoints([]);
      return;
    }
    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await api<any>(`/tracking/route/?employeeId=${empId}&date=${today}`);
      if (data?.points && Array.isArray(data.points)) {
        const coords: [number, number][] = data.points
          .filter((p: any) => typeof p.longitude === "number" && typeof p.latitude === "number")
          .map((p: any) => [p.longitude, p.latitude]);
        setSelectedEmployeeRoutePoints(coords);
      } else {
        setSelectedEmployeeRoutePoints([]);
      }
    } catch (err) {
      console.error("Failed to load route points for employee:", err);
      setSelectedEmployeeRoutePoints([]);
    }
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadSelectedEmployeeRoute(selectedEmployeeId);
    } else {
      setSelectedEmployeeRoutePoints([]);
    }
  }, [selectedEmployeeId, loadSelectedEmployeeRoute]);

  // 3. Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const styleObj = MAP_STYLES[currentMapStyle] || MAP_STYLES.dark;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleObj as any,
      center: [77.5946, 12.9716],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    mapRef.current = map;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle Map Style Switch
  const handleSwitchMapStyle = (styleKey: "streets" | "dark" | "light") => {
    setCurrentMapStyle(styleKey);
    const map = mapRef.current;
    if (map) {
      map.setStyle(MAP_STYLES[styleKey] as any);
    }
  };

  // 4. Initialize Socket.IO Live Updates
  useEffect(() => {
    let socketUrl = "";
    if (typeof window !== "undefined") {
      socketUrl = window.location.origin;
    }

    const socket = io(socketUrl || "", {
      path: "/socket.io/",
      transports: ["polling", "websocket"],
      reconnection: true,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsSocketConnected(true);
      socket.emit("tracking:subscribe-live");
    });

    socket.on("disconnect", () => {
      setIsSocketConnected(false);
    });

    socket.on("tracking:initial-state", (data: { employees: LiveEmployeeTracking[] }) => {
      if (data?.employees) {
        setEmployees(data.employees);
      }
    });

    socket.on("tracking:employee-updated", (updated: any) => {
      setEmployees((prev) => {
        const id = updated.id || updated._id;
        const index = prev.findIndex((e) => e.id === id || e._id === id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = {
            ...next[index],
            ...updated,
            currentLocation: updated.currentLocation || next[index].currentLocation,
            lastLocationAt: updated.lastLocationAt || next[index].lastLocationAt,
            trackingStatus: updated.trackingStatus || next[index].trackingStatus,
          };
          return next;
        } else {
          return [updated, ...prev];
        }
      });

      // If this is the selected employee, append to live route trail
      const updateId = updated.id || updated._id;
      if (selectedEmployeeId === updateId && updated.currentLocation) {
        const newCoord: [number, number] = [updated.currentLocation.longitude, updated.currentLocation.latitude];
        setSelectedEmployeeRoutePoints((prev) => {
          if (prev.length === 0) return [newCoord];
          const last = prev[prev.length - 1];
          if (last[0] === newCoord[0] && last[1] === newCoord[1]) return prev;
          return [...prev, newCoord];
        });

        if (followSelected && mapRef.current) {
          mapRef.current.easeTo({
            center: newCoord,
            duration: 1200,
          });
        }
      }
    });

    return () => {
      socket.emit("tracking:unsubscribe-live");
      socket.disconnect();
    };
  }, [selectedEmployeeId, followSelected]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Recalculate stats
  useEffect(() => {
    const online = employees.filter((e) => e.trackingStatus === "ONLINE").length;
    const disconnected = employees.filter((e) => e.trackingStatus === "DISCONNECTED").length;
    setStats({
      totalEmployees: employees.length,
      onlineCount: online,
      disconnectedCount: disconnected,
      offlineCount: employees.length - online - disconnected,
    });
  }, [employees]);

  // 5. Update MapLibre Animated Line Trails
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const setupRouteLayers = () => {
      // Remove old layers & source if exists
      if (map.getLayer("live-route-glow")) map.removeLayer("live-route-glow");
      if (map.getLayer("live-route-casing")) map.removeLayer("live-route-casing");
      if (map.getLayer("live-route-main")) map.removeLayer("live-route-main");
      if (map.getLayer("live-route-dash")) map.removeLayer("live-route-dash");
      if (map.getSource("live-route-source")) map.removeSource("live-route-source");

      if (!showAnimatedTrails || selectedEmployeeRoutePoints.length < 2) {
        return;
      }

      // Add GeoJSON Source
      map.addSource("live-route-source", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: selectedEmployeeRoutePoints,
          },
        },
      });

      // Layer 1: Ambient Neon Glow
      map.addLayer({
        id: "live-route-glow",
        type: "line",
        source: "live-route-source",
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

      // Layer 2: High Contrast Casing
      map.addLayer({
        id: "live-route-casing",
        type: "line",
        source: "live-route-source",
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

      // Layer 3: Vibrant Core Line
      map.addLayer({
        id: "live-route-main",
        type: "line",
        source: "live-route-source",
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

      // Layer 4: Animated Flowing Dash (Laser Trail)
      map.addLayer({
        id: "live-route-dash",
        type: "line",
        source: "live-route-source",
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
    };

    if (map.isStyleLoaded()) {
      setupRouteLayers();
    } else {
      map.once("styledata", setupRouteLayers);
    }
  }, [selectedEmployeeRoutePoints, showAnimatedTrails, currentMapStyle]);

  // 6. Dash Array Animation Loop (Ant-Path laser line animation)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showAnimatedTrails) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    let lastStep = 0;
    const animateDash = (timestamp: number) => {
      if (timestamp - lastStep > 60) {
        lastStep = timestamp;
        dashOffsetRef.current = (dashOffsetRef.current + 1) % 12;

        if (map.getLayer("live-route-dash")) {
          // Dynamic dash phase shift creates a smooth laser flow animation
          const dash1 = (dashOffsetRef.current % 6);
          const dash2 = ((dashOffsetRef.current + 3) % 6);
          map.setPaintProperty("live-route-dash", "line-dasharray", [0, dash1 + 1, dash2 + 2, 2]);
        }
      }
      animationFrameRef.current = requestAnimationFrame(animateDash);
    };

    animationFrameRef.current = requestAnimationFrame(animateDash);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [showAnimatedTrails]);

  // 7. Update MapLibre High-Visibility Radar Markers with Smooth Coordinate Gliding
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentMarkerIds = new Set<string>();

    employees.forEach((emp) => {
      const id = emp.id || emp._id;
      const loc = emp.currentLocation;

      if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
        return;
      }

      currentMarkerIds.add(id);
      const isOnline = emp.trackingStatus === "ONLINE";
      const isDisconnected = emp.trackingStatus === "DISCONNECTED";
      const isSelected = selectedEmployeeId === id;
      const targetLngLat: [number, number] = [loc.longitude, loc.latitude];

      let marker = markersRef.current.get(id);

      if (!marker) {
        // Create Rich High-Contrast HTML Marker
        const el = document.createElement("div");
        el.className = `employee-live-beacon ${isOnline ? "online" : isDisconnected ? "disconnected" : "offline"} ${
          isSelected ? "selected" : ""
        }`;
        el.style.position = "relative";
        el.style.cursor = "pointer";
        el.style.width = "54px";
        el.style.height = "54px";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.zIndex = isSelected ? "40" : isOnline ? "30" : "15";
        el.style.transition = "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";

        const speedText = loc.speed ? `${Math.round(loc.speed * 3.6)} km/h` : "Stationary";
        const headingAngle = loc.heading || 0;

        el.innerHTML = `
          <!-- Multi-Ring Expanding Pulsing Radar Waves -->
          <div class="radar-wave wave-1" style="display: ${showRadarPulses && isOnline ? "block" : "none"};"></div>
          <div class="radar-wave wave-2" style="display: ${showRadarPulses && isOnline ? "block" : "none"};"></div>
          <div class="radar-wave wave-3" style="display: ${showRadarPulses && isOnline ? "block" : "none"};"></div>

          <!-- Directional Compass Arrow -->
          <div class="beacon-arrow" style="
            position: absolute;
            inset: -4px;
            pointer-events: none;
            transform: rotate(${headingAngle}deg);
            display: ${loc.speed && loc.speed > 0.5 ? "block" : "none"};
          ">
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-bottom: 10px solid #10B981;
              margin: 0 auto;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
            "></div>
          </div>

          <!-- Floating High-Visibility Name & Speed Badge -->
          <div class="beacon-nametag" style="
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            white-space: nowrap;
            background: rgba(15, 23, 42, 0.92);
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 16px;
            border: 1.5px solid ${isSelected ? "#10B981" : "rgba(255,255,255,0.25)"};
            box-shadow: 0 4px 16px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            gap: 6px;
            pointer-events: none;
            z-index: 50;
          ">
            <span style="
              width: 7px;
              height: 7px;
              border-radius: 50%;
              background: ${isOnline ? "#10B981" : isDisconnected ? "#F59E0B" : "#94A3B8"};
              box-shadow: 0 0 6px ${isOnline ? "#10B981" : "transparent"};
            "></span>
            <span>${emp.name}</span>
            <span style="opacity: 0.75; font-size: 10px; font-weight: 500;">• ${speedText}</span>
          </div>

          <!-- Avatar Core with Glowing Rings -->
          <div class="beacon-avatar-core" style="
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #087A5B;
            border: 3px solid ${isSelected ? "#FFFFFF" : isOnline ? "#10B981" : isDisconnected ? "#F59E0B" : "#64748B"};
            box-shadow: 0 0 16px ${isSelected ? "rgba(16, 185, 129, 0.8)" : isOnline ? "rgba(16, 185, 129, 0.4)" : "rgba(0,0,0,0.25)"};
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 800;
            color: #FFFFFF;
            position: relative;
            z-index: 10;
          ">
            ${
              emp.avatar
                ? `<img src="${emp.avatar}" style="width: 100%; height: 100%; object-fit: cover;" />`
                : (() => {
                    const parts = (emp.name || "User").trim().split(/\s+/).filter(Boolean);
                    return parts.length >= 2
                      ? (parts[0][0] + parts[1][0]).toUpperCase()
                      : emp.name.slice(0, 2).toUpperCase();
                  })()
            }
          </div>

          <!-- Live Status Indicator Bead -->
          <div class="beacon-status-bead" style="
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: ${isOnline ? "#10B981" : isDisconnected ? "#F59E0B" : "#64748B"};
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            z-index: 20;
          "></div>
        `;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedEmployeeId(id);
          map.flyTo({
            center: targetLngLat,
            zoom: Math.max(map.getZoom(), 15),
            duration: 1000,
          });
        });

        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(targetLngLat)
          .addTo(map);

        markersRef.current.set(id, marker);
        markerPositionsRef.current.set(id, { lng: loc.longitude, lat: loc.latitude });
      } else {
        // Smooth Coordinate Interpolation Gliding
        const prevPos = markerPositionsRef.current.get(id) || { lng: loc.longitude, lat: loc.latitude };
        markerPositionsRef.current.set(id, { lng: loc.longitude, lat: loc.latitude });

        // Update marker position
        marker.setLngLat(targetLngLat);

        const el = marker.getElement();
        el.className = `employee-live-beacon ${isOnline ? "online" : isDisconnected ? "disconnected" : "offline"} ${
          isSelected ? "selected" : ""
        }`;
        el.style.zIndex = isSelected ? "40" : isOnline ? "30" : "15";

        if (isSelected) {
          el.style.transform = "scale(1.2)";
        } else {
          el.style.transform = "scale(1.0)";
        }

        // Update radar waves visibility
        const waves = el.querySelectorAll(".radar-wave");
        waves.forEach((w) => {
          (w as HTMLElement).style.display = showRadarPulses && isOnline ? "block" : "none";
        });

        // Update nametag contents
        const nametag = el.querySelector(".beacon-nametag") as HTMLElement;
        if (nametag) {
          const speedText = loc.speed ? `${Math.round(loc.speed * 3.6)} km/h` : "Stationary";
          nametag.innerHTML = `
            <span style="
              width: 7px;
              height: 7px;
              border-radius: 50%;
              background: ${isOnline ? "#10B981" : isDisconnected ? "#F59E0B" : "#94A3B8"};
              box-shadow: 0 0 6px ${isOnline ? "#10B981" : "transparent"};
            "></span>
            <span>${emp.name}</span>
            <span style="opacity: 0.75; font-size: 10px; font-weight: 500;">• ${speedText}</span>
          `;
          nametag.style.borderColor = isSelected ? "#10B981" : "rgba(255,255,255,0.25)";
        }

        // Update avatar border and shadow
        const avatarCore = el.querySelector(".beacon-avatar-core") as HTMLElement;
        if (avatarCore) {
          avatarCore.style.borderColor = isSelected ? "#FFFFFF" : isOnline ? "#10B981" : isDisconnected ? "#F59E0B" : "#64748B";
          avatarCore.style.boxShadow = isSelected
            ? "0 0 20px rgba(16, 185, 129, 0.9)"
            : isOnline
            ? "0 0 14px rgba(16, 185, 129, 0.4)"
            : "rgba(0,0,0,0.25)";
        }

        // Update arrow angle
        const arrow = el.querySelector(".beacon-arrow") as HTMLElement;
        if (arrow) {
          arrow.style.transform = `rotate(${loc.heading || 0}deg)`;
          arrow.style.display = loc.speed && loc.speed > 0.5 ? "block" : "none";
        }
      }
    });

    // Cleanup markers for removed employees
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        markerPositionsRef.current.delete(id);
      }
    });
  }, [employees, selectedEmployeeId, showRadarPulses]);

  // 8. Fit bounds to all employees
  const handleFitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const coordinates: [number, number][] = employees
      .filter((e) => e.currentLocation && typeof e.currentLocation.latitude === "number" && typeof e.currentLocation.longitude === "number")
      .map((e) => [e.currentLocation!.longitude, e.currentLocation!.latitude]);

    if (coordinates.length === 0) return;

    if (coordinates.length === 1) {
      map.flyTo({ center: coordinates[0], zoom: 14, duration: 1000 });
      return;
    }

    const bounds = coordinates.reduce((acc, coord) => {
      return acc.extend(coord);
    }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

    map.fitBounds(bounds, { padding: 90, maxZoom: 16, duration: 1000 });
  }, [employees]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        searchQuery === "" ||
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ONLINE" && emp.trackingStatus === "ONLINE") ||
        (statusFilter === "DISCONNECTED" && emp.trackingStatus === "DISCONNECTED") ||
        (statusFilter === "OFFLINE" && emp.trackingStatus === "OFFLINE");

      const matchesDept = departmentFilter === "ALL" || emp.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [employees, searchQuery, statusFilter, departmentFilter]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId || e._id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

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
      {/* Top Controls Header */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: TOKENS.radius.md,
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            <Radio size={20} className="pulse-icon" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: TOKENS.colors.textPrimary }}>
                Live GPS Radar & Animated Routes
              </h2>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #10B981 0%, #047857 100%)",
                  color: "#FFFFFF",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                Live Radar
              </span>
            </div>
            <p style={{ fontSize: "12px", color: TOKENS.colors.textMuted, margin: 0 }}>
              Real-time movement trails, glowing animated laser lines, and high-contrast staff radar
            </p>
          </div>
        </div>

        {/* Action Controls & Map Style Toggles */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Status Counts */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              borderRadius: "20px",
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#059669",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10B981",
                display: "inline-block",
                boxShadow: "0 0 8px #10B981",
              }}
            />
            {stats.onlineCount} Active
          </div>

          {stats.disconnectedCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                borderRadius: "20px",
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#D97706",
              }}
            >
              <WifiOff size={12} />
              {stats.disconnectedCount} Disconnected
            </div>
          )}

          {/* Animated Trails Toggle */}
          <button
            type="button"
            onClick={() => setShowAnimatedTrails(!showAnimatedTrails)}
            title="Toggle animated route lines and movement trails"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: TOKENS.radius.md,
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              border: `1.5px solid ${showAnimatedTrails ? "#10B981" : TOKENS.colors.borderLight}`,
              background: showAnimatedTrails ? "rgba(16, 185, 129, 0.15)" : TOKENS.colors.surfaceSubtle,
              color: showAnimatedTrails ? "#059669" : TOKENS.colors.textSecondary,
              transition: "all 0.2s ease",
            }}
          >
            <Route size={14} color={showAnimatedTrails ? "#10B981" : undefined} />
            Animated Trails {showAnimatedTrails ? "ON" : "OFF"}
          </button>

          {/* Radar Waves Toggle */}
          <button
            type="button"
            onClick={() => setShowRadarPulses(!showRadarPulses)}
            title="Toggle glowing radar ripple rings"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: TOKENS.radius.md,
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              border: `1.5px solid ${showRadarPulses ? "#10B981" : TOKENS.colors.borderLight}`,
              background: showRadarPulses ? "rgba(16, 185, 129, 0.15)" : TOKENS.colors.surfaceSubtle,
              color: showRadarPulses ? "#059669" : TOKENS.colors.textSecondary,
              transition: "all 0.2s ease",
            }}
          >
            <Radio size={14} color={showRadarPulses ? "#10B981" : undefined} />
            Radar Waves
          </button>

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
                  padding: "5px 10px",
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
            onClick={loadEmployees}
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

          <button
            type="button"
            onClick={handleFitBounds}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "linear-gradient(135deg, #087A5B 0%, #066047 100%)",
              color: "#FFFFFF",
              border: 0,
              padding: "6px 14px",
              borderRadius: TOKENS.radius.md,
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(8, 122, 91, 0.3)",
            }}
          >
            <Maximize2 size={13} />
            Fit Map
          </button>
        </div>
      </div>

      {/* Main Grid: Left Directory & Right Live Map Canvas */}
      <div
        className="tracking-grid-container"
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: "16px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left Sidebar */}
        <div
          className={mobileView === "map" ? "chat-sidebar-mobile-hidden" : undefined}
          style={{
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            borderRadius: TOKENS.radius.lg,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: TOKENS.shadows.sm,
            minHeight: "400px",
          }}
        >
          {/* Search Header */}
          <div style={{ padding: "14px", borderBottom: `1px solid ${TOKENS.colors.borderLight}` }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: TOKENS.colors.surfaceSubtle,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                borderRadius: TOKENS.radius.md,
                padding: "8px 12px",
                marginBottom: "10px",
              }}
            >
              <Search size={14} color={TOKENS.colors.textMuted} />
              <input
                type="text"
                placeholder="Search staff by name or dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 0,
                  outline: "none",
                  background: "transparent",
                  fontSize: "12px",
                  width: "100%",
                  color: TOKENS.colors.textPrimary,
                }}
              />
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
              {(["ALL", "ONLINE", "DISCONNECTED", "OFFLINE"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: TOKENS.radius.sm,
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: 0,
                    transition: "all 0.15s ease",
                    background: statusFilter === tab ? TOKENS.colors.brandPrimary : TOKENS.colors.surfaceSubtle,
                    color: statusFilter === tab ? "#FFFFFF" : TOKENS.colors.textSecondary,
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Employee Directory List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {filteredEmployees.length === 0 ? (
              <div style={{ padding: "30px 16px", textAlign: "center", color: TOKENS.colors.textMuted }}>
                <Users size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <div style={{ fontSize: "13px", fontWeight: 600 }}>No staff members found</div>
                <div style={{ fontSize: "11px" }}>Try adjusting your search filter.</div>
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const id = emp.id || emp._id;
                const isSelected = selectedEmployeeId === id;
                const isOnline = emp.trackingStatus === "ONLINE";
                const isDisconnected = emp.trackingStatus === "DISCONNECTED";
                const hasLoc = emp.currentLocation && typeof emp.currentLocation.latitude === "number";

                return (
                  <div
                    key={id}
                    onClick={() => {
                      setSelectedEmployeeId(id);
                      setMobileView("map");
                      if (hasLoc && mapRef.current) {
                        mapRef.current.flyTo({
                          center: [emp.currentLocation!.longitude, emp.currentLocation!.latitude],
                          zoom: 15,
                          duration: 900,
                        });
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: TOKENS.radius.md,
                      cursor: "pointer",
                      marginBottom: "4px",
                      transition: "all 0.15s ease",
                      background: isSelected ? "rgba(16, 185, 129, 0.12)" : "transparent",
                      border: `1.5px solid ${isSelected ? "#10B981" : "transparent"}`,
                    }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <Avatar name={emp.name} avatar={emp.avatar} size={36} />
                      <span
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: "11px",
                          height: "11px",
                          borderRadius: "50%",
                          backgroundColor: isOnline
                            ? "#10B981"
                            : isDisconnected
                            ? "#F59E0B"
                            : TOKENS.colors.borderStrong,
                          border: "2px solid #FFFFFF",
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <strong
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: isSelected ? "#059669" : TOKENS.colors.textPrimary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {emp.name}
                        </strong>
                        <span style={{ fontSize: "10px", color: TOKENS.colors.textMuted }}>
                          {timeAgo(emp.lastLocationAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: TOKENS.colors.textSecondary, display: "flex", gap: "6px" }}>
                        <span>{emp.employeeCode}</span>
                        <span>•</span>
                        <span>{emp.department}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Map Canvas with Floating HUD & Info Cards */}
        <div
          className={`tracking-map-canvas-mobile ${mobileView === "list" ? "chat-main-mobile-hidden" : ""}`}
          style={{
            position: "relative",
            borderRadius: TOKENS.radius.lg,
            overflow: "hidden",
            border: `1px solid ${TOKENS.colors.borderLight}`,
            boxShadow: TOKENS.shadows.sm,
            background: "#0F172A",
            minHeight: "420px",
          }}
        >
          <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

          {/* Floating Trail HUD Indicator */}
          {selectedEmployee && showAnimatedTrails && selectedEmployeeRoutePoints.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                background: "rgba(15, 23, 42, 0.88)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: TOKENS.radius.md,
                padding: "8px 14px",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                zIndex: 25,
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#10B981",
                  boxShadow: "0 0 8px #10B981",
                  animation: "pulseLaser 1.5s infinite",
                }}
              />
              <span>Live Animated Trail: {selectedEmployee.name}</span>
              <span style={{ color: "#34D399", fontSize: "11px", fontWeight: 600 }}>
                ({selectedEmployeeRoutePoints.length} GPS checkpoints)
              </span>
            </div>
          )}

          {/* Selected Employee Floating Detail Drawer */}
          {selectedEmployee && (
            <div
              className="tracking-floating-card-mobile"
              style={{
                position: "absolute",
                bottom: "20px",
                left: "20px",
                right: "20px",
                maxWidth: "480px",
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: TOKENS.radius.lg,
                padding: "16px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
                zIndex: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Avatar name={selectedEmployee.name} avatar={selectedEmployee.avatar} size={44} />
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: TOKENS.colors.textPrimary }}>
                      {selectedEmployee.name}
                    </h3>
                    <div style={{ fontSize: "11px", color: TOKENS.colors.textSecondary }}>
                      {selectedEmployee.employeeCode} • {selectedEmployee.designation} • {selectedEmployee.department}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: "12px",
                    background:
                      selectedEmployee.trackingStatus === "ONLINE"
                        ? "rgba(16, 185, 129, 0.15)"
                        : selectedEmployee.trackingStatus === "DISCONNECTED"
                        ? "rgba(245, 158, 11, 0.15)"
                        : TOKENS.colors.surfaceMuted,
                    color:
                      selectedEmployee.trackingStatus === "ONLINE"
                        ? "#059669"
                        : selectedEmployee.trackingStatus === "DISCONNECTED"
                        ? "#D97706"
                        : TOKENS.colors.textMuted,
                    border: `1px solid ${
                      selectedEmployee.trackingStatus === "ONLINE"
                        ? "rgba(16, 185, 129, 0.4)"
                        : selectedEmployee.trackingStatus === "DISCONNECTED"
                        ? "rgba(245, 158, 11, 0.4)"
                        : TOKENS.colors.borderLight
                    }`,
                  }}
                >
                  {selectedEmployee.trackingStatus}
                </div>
              </div>

              {/* Grid Metrics */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "8px",
                  marginBottom: "12px",
                  background: TOKENS.colors.surfaceSubtle,
                  borderRadius: TOKENS.radius.md,
                  padding: "8px 10px",
                  border: `1px solid ${TOKENS.colors.borderLight}`,
                }}
              >
                <div>
                  <div style={{ fontSize: "10px", color: TOKENS.colors.textMuted, textTransform: "uppercase" }}>Started</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: TOKENS.colors.textPrimary }}>
                    {selectedEmployee.trackingStartedAt
                      ? new Date(selectedEmployee.trackingStartedAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10px", color: TOKENS.colors.textMuted, textTransform: "uppercase" }}>Updated</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: TOKENS.colors.textPrimary }}>
                    {timeAgo(selectedEmployee.lastLocationAt)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10px", color: TOKENS.colors.textMuted, textTransform: "uppercase" }}>Speed</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#059669" }}>
                    {selectedEmployee.currentLocation?.speed
                      ? `${Math.round(selectedEmployee.currentLocation.speed * 3.6)} km/h`
                      : "Stationary"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10px", color: TOKENS.colors.textMuted, textTransform: "uppercase" }}>Distance</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: TOKENS.colors.brandPrimary }}>
                    {selectedEmployee.activeSession?.totalDistance
                      ? `${selectedEmployee.activeSession.totalDistance} km`
                      : "0 km"}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{ display: "flex", gap: "8px" }}>
                {onViewRoute && (
                  <button
                    type="button"
                    onClick={() => onViewRoute(selectedEmployee.id || selectedEmployee._id)}
                    style={{
                      flex: 1,
                      background: "linear-gradient(135deg, #087A5B 0%, #066047 100%)",
                      color: "#FFFFFF",
                      border: 0,
                      padding: "8px 12px",
                      borderRadius: TOKENS.radius.md,
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(8, 122, 91, 0.3)",
                    }}
                  >
                    <Navigation size={13} />
                    View Today&apos;s Route
                  </button>
                )}

                {onViewHistory && (
                  <button
                    type="button"
                    onClick={() => onViewHistory(selectedEmployee.id || selectedEmployee._id)}
                    style={{
                      background: TOKENS.colors.surfaceSubtle,
                      color: TOKENS.colors.textPrimary,
                      border: `1px solid ${TOKENS.colors.borderLight}`,
                      padding: "8px 12px",
                      borderRadius: TOKENS.radius.md,
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Clock size={13} />
                    History
                  </button>
                )}

                {onViewSummary && (
                  <button
                    type="button"
                    onClick={() => onViewSummary(selectedEmployee.id || selectedEmployee._id)}
                    style={{
                      background: TOKENS.colors.surfaceSubtle,
                      color: TOKENS.colors.textPrimary,
                      border: `1px solid ${TOKENS.colors.borderLight}`,
                      padding: "8px 12px",
                      borderRadius: TOKENS.radius.md,
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <TrendingUp size={13} />
                    Summary
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        /* Multi-Ring Expanding Pulsing Radar Animations */
        .radar-wave {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          border: 2px solid #10B981;
          pointer-events: none;
        }

        .radar-wave.wave-1 {
          animation: radarPulse 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }

        .radar-wave.wave-2 {
          animation: radarPulse 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite 0.8s;
        }

        .radar-wave.wave-3 {
          animation: radarPulse 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite 1.6s;
        }

        @keyframes radarPulse {
          0% {
            transform: scale(0.6);
            opacity: 0.9;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.8);
          }
          50% {
            opacity: 0.4;
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
            box-shadow: 0 0 24px rgba(16, 185, 129, 0);
          }
        }

        @keyframes pulseLaser {
          0% {
            transform: scale(0.9);
            box-shadow: 0 0 4px #10B981;
          }
          50% {
            transform: scale(1.3);
            box-shadow: 0 0 12px #10B981;
          }
          100% {
            transform: scale(0.9);
            box-shadow: 0 0 4px #10B981;
          }
        }

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
