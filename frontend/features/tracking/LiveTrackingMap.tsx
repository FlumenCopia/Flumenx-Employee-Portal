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
} from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/icons";
import { TOKENS } from "@/components/design-system/tokens";
import type { LiveEmployeeTracking } from "@/lib/types";

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
  const socketRef = useRef<Socket | null>(null);

  const [employees, setEmployees] = useState<LiveEmployeeTracking[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ONLINE" | "DISCONNECTED" | "OFFLINE">("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [autoCenter, setAutoCenter] = useState<boolean>(true);
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

  // 2. Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Default center (India / Bangalore default coordinates)
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [77.5946, 12.9716],
      zoom: 11,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 3. Initialize Socket.IO Live Updates
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
    });

    return () => {
      socket.emit("tracking:unsubscribe-live");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Recalculate stats when employees list changes
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

  // 4. Update MapLibre Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentMarkerIds = new Set<string>();

    employees.forEach((emp) => {
      const id = emp.id || emp._id;
      const loc = emp.currentLocation;

      // Only plot if valid location exists
      if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
        return;
      }

      currentMarkerIds.add(id);
      const isOnline = emp.trackingStatus === "ONLINE";
      const isDisconnected = emp.trackingStatus === "DISCONNECTED";
      const isSelected = selectedEmployeeId === id;

      let marker = markersRef.current.get(id);

      if (!marker) {
        // Create custom HTML marker element
        const el = document.createElement("div");
        el.className = `employee-map-marker ${isOnline ? "online" : isDisconnected ? "disconnected" : "offline"}`;
        el.style.cursor = "pointer";
        el.style.position = "relative";
        el.style.width = "40px";
        el.style.height = "40px";
        el.style.borderRadius = "50%";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        el.style.zIndex = isSelected ? "30" : isOnline ? "20" : "10";

        // Internal content
        el.innerHTML = `
          <div class="marker-pulse-ring" style="
            position: absolute;
            inset: -6px;
            border-radius: 50%;
            background: ${isOnline ? "rgba(8, 122, 91, 0.25)" : isDisconnected ? "rgba(217, 119, 6, 0.25)" : "transparent"};
            animation: ${isOnline ? "pulseRadar 2s infinite" : "none"};
            pointer-events: none;
          "></div>
          <div class="marker-avatar" style="
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 2.5px solid ${isOnline ? "#087A5B" : isDisconnected ? "#D97706" : "#94A3B8"};
            background: #087A5B;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.18);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
            color: #FFFFFF;
          ">
            ${emp.avatar ? `<img src="${emp.avatar}" style="width: 100%; height: 100%; object-fit: cover;" />` : (() => {
              const parts = (emp.name || "User").trim().split(/\s+/).filter(Boolean);
              return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : emp.name.slice(0, 2).toUpperCase();
            })()}
          </div>
          <div class="marker-status-dot" style="
            position: absolute;
            bottom: 0;
            right: 0;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${isOnline ? "#16855B" : isDisconnected ? "#D97706" : "#64748B"};
            border: 2px solid #FFFFFF;
          "></div>
        `;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedEmployeeId(id);
          map.flyTo({
            center: [loc.longitude, loc.latitude],
            zoom: Math.max(map.getZoom(), 15),
            duration: 1000,
          });
        });

        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([loc.longitude, loc.latitude])
          .addTo(map);

        markersRef.current.set(id, marker);
      } else {
        // Smoothly animate existing marker to new coordinates
        marker.setLngLat([loc.longitude, loc.latitude]);

        const el = marker.getElement();
        el.className = `employee-map-marker ${isOnline ? "online" : isDisconnected ? "disconnected" : "offline"}`;
        el.style.zIndex = isSelected ? "30" : isOnline ? "20" : "10";
        if (isSelected) {
          el.style.transform = "scale(1.15)";
        } else {
          el.style.transform = "scale(1.0)";
        }

        const ring = el.querySelector(".marker-pulse-ring") as HTMLElement;
        if (ring) {
          ring.style.background = isOnline ? "rgba(8, 122, 91, 0.25)" : isDisconnected ? "rgba(217, 119, 6, 0.25)" : "transparent";
          ring.style.animation = isOnline ? "pulseRadar 2s infinite" : "none";
        }

        const avatarBox = el.querySelector(".marker-avatar") as HTMLElement;
        if (avatarBox) {
          avatarBox.style.borderColor = isOnline ? "#087A5B" : isDisconnected ? "#D97706" : "#94A3B8";
        }

        const dot = el.querySelector(".marker-status-dot") as HTMLElement;
        if (dot) {
          dot.style.background = isOnline ? "#16855B" : isDisconnected ? "#D97706" : "#64748B";
        }
      }
    });

    // Cleanup markers for removed employees
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [employees, selectedEmployeeId]);

  // 5. Fit map bounds to encompass all plotted employees
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

    map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 1000 });
  }, [employees]);

  // Filtered employees list for sidebar
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

  const departmentsList = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach((e) => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts);
  }, [employees]);

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
      {/* Top Banner / Stats Header */}
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
              width: "36px",
              height: "36px",
              borderRadius: TOKENS.radius.md,
              backgroundColor: TOKENS.colors.brandSubtle,
              color: TOKENS.colors.brandPrimary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${TOKENS.colors.brandBorder}`,
            }}
          >
            <MapPin size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: TOKENS.colors.textPrimary }}>
              Live Employee Tracking
            </h2>
            <p style={{ fontSize: "12px", color: TOKENS.colors.textMuted, margin: 0 }}>
              Real-time GPS monitor powered by MapLibre GL & WebSockets
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: TOKENS.colors.successBg,
              border: `1px solid ${TOKENS.colors.successBorder}`,
              borderRadius: "20px",
              padding: "4px 12px",
              fontSize: "12px",
              fontWeight: 700,
              color: TOKENS.colors.success,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: TOKENS.colors.success,
                display: "inline-block",
                boxShadow: "0 0 6px rgba(22, 133, 91, 0.6)",
              }}
            />
            {stats.onlineCount} Online
          </div>

          {stats.disconnectedCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: TOKENS.colors.warningBg,
                border: `1px solid ${TOKENS.colors.warningBorder}`,
                borderRadius: "20px",
                padding: "4px 12px",
                fontSize: "12px",
                fontWeight: 700,
                color: TOKENS.colors.warning,
              }}
            >
              <WifiOff size={12} />
              {stats.disconnectedCount} Disconnected
            </div>
          )}

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
            Refresh
          </button>

          <button
            type="button"
            onClick={handleFitBounds}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: TOKENS.colors.brandPrimary,
              color: "#FFFFFF",
              border: 0,
              padding: "6px 14px",
              borderRadius: TOKENS.radius.md,
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Maximize2 size={13} />
            Fit Map
          </button>
        </div>
      </div>

      {/* Main Container: Split into Left Employee Sidebar & Right Map */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: "16px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left Sidebar: Search & Employees List */}
        <div
          style={{
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            borderRadius: TOKENS.radius.lg,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: TOKENS.shadows.sm,
          }}
        >
          {/* Search and Filters Header */}
          <div style={{ padding: "14px", borderBottom: `1px solid ${TOKENS.colors.borderLight}` }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: TOKENS.colors.surfaceSubtle,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                borderRadius: TOKENS.radius.md,
                padding: "6px 10px",
                marginBottom: "10px",
              }}
            >
              <Search size={14} color={TOKENS.colors.textMuted} />
              <input
                type="text"
                placeholder="Search employee by name, code..."
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

          {/* Employee Cards List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {filteredEmployees.length === 0 ? (
              <div style={{ padding: "30px 16px", textAlign: "center", color: TOKENS.colors.textMuted }}>
                <Users size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <div style={{ fontSize: "13px", fontWeight: 600 }}>No employees found</div>
                <div style={{ fontSize: "11px" }}>Try adjusting your search query or filter.</div>
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
                      if (hasLoc && mapRef.current) {
                        mapRef.current.flyTo({
                          center: [emp.currentLocation!.longitude, emp.currentLocation!.latitude],
                          zoom: 15,
                          duration: 800,
                        });
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px",
                      borderRadius: TOKENS.radius.md,
                      cursor: "pointer",
                      marginBottom: "4px",
                      transition: "all 0.15s ease",
                      background: isSelected ? TOKENS.colors.brandSubtle : "transparent",
                      border: `1px solid ${isSelected ? TOKENS.colors.brandBorder : "transparent"}`,
                    }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <Avatar name={emp.name} avatar={emp.avatar} size={32} />
                      <span
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: isOnline
                            ? TOKENS.colors.success
                            : isDisconnected
                            ? TOKENS.colors.warning
                            : TOKENS.colors.borderStrong,
                          border: "1.5px solid #FFFFFF",
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <strong
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: TOKENS.colors.textPrimary,
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

        {/* Right Map Canvas & Floating Employee Details Card */}
        <div
          style={{
            position: "relative",
            borderRadius: TOKENS.radius.lg,
            overflow: "hidden",
            border: `1px solid ${TOKENS.colors.borderLight}`,
            boxShadow: TOKENS.shadows.sm,
            background: "#E5E7EB",
          }}
        >
          <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

          {/* Selected Employee Floating Detail Drawer */}
          {selectedEmployee && (
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                left: "20px",
                right: "20px",
                maxWidth: "480px",
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
                border: `1px solid ${TOKENS.colors.borderLight}`,
                borderRadius: TOKENS.radius.lg,
                padding: "16px",
                boxShadow: TOKENS.shadows.lg,
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
                        ? TOKENS.colors.successBg
                        : selectedEmployee.trackingStatus === "DISCONNECTED"
                        ? TOKENS.colors.warningBg
                        : TOKENS.colors.surfaceMuted,
                    color:
                      selectedEmployee.trackingStatus === "ONLINE"
                        ? TOKENS.colors.success
                        : selectedEmployee.trackingStatus === "DISCONNECTED"
                        ? TOKENS.colors.warning
                        : TOKENS.colors.textMuted,
                    border: `1px solid ${
                      selectedEmployee.trackingStatus === "ONLINE"
                        ? TOKENS.colors.successBorder
                        : selectedEmployee.trackingStatus === "DISCONNECTED"
                        ? TOKENS.colors.warningBorder
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
                  padding: "8px",
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
                  <div style={{ fontSize: "10px", color: TOKENS.colors.textMuted, textTransform: "uppercase" }}>GPS Accuracy</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: TOKENS.colors.textPrimary }}>
                    {selectedEmployee.currentLocation?.accuracy
                      ? `${Math.round(selectedEmployee.currentLocation.accuracy)}m`
                      : "—"}
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
                      background: TOKENS.colors.brandPrimary,
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
        @keyframes pulseRadar {
          0% {
            transform: scale(0.95);
            opacity: 0.8;
          }
          70% {
            transform: scale(1.6);
            opacity: 0;
          }
          100% {
            transform: scale(0.95);
            opacity: 0;
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
