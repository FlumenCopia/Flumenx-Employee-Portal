"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarCheck, CalendarDays, CheckCheck, ChevronDown, FileCheck2, KeyRound, Landmark, Lock, LogOut, Megaphone, Menu, RotateCw, UserRound, X } from "lucide-react";
import { FlumenxMark, Avatar } from "./icons";
import { api, logout } from "@/lib/api";
import { clearCachedAuthUser, getCachedAuthUser, loadAuthUser } from "@/lib/auth-cache";
import type { AuthUser, Paginated, PortalNotification, WorkspaceRole } from "@/lib/types";
import { expectedPortalRoles, getFilteredNavigation, getLucideIcon, getWorkspaceDestination, getWorkspaceRole, isRoleAllowedInWorkspace, normalizeWorkspaceRoute, portalRoleRoutes, workspaceFallbackNames, workspaceLabels, workspaceNavigation, groupNavigationByCategory } from "./layout/navigation";
import { PwaInstallButton } from "./PwaInstallButton";
import { MobileBottomNav } from "./MobileBottomNav";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { getGlobalSocket } from "@/lib/socket";
import { toast } from "@/components/ToastContext";
import { hasPermission } from "@/lib/permissions";
import { showDesktopNotification, requestNotificationPermission } from "@/lib/desktopNotification";

const dynamicNavCache: Record<string, readonly (readonly [string, string, any])[]> = {};


const ShellUserContext = createContext<AuthUser | null>(null);

export function useShellUser() {
  return useContext(ShellUserContext);
}

function notificationIcon(category: string) {
  if (category.startsWith("meeting_")) return CalendarDays;
  if (category.startsWith("leave_")) return FileCheck2;
  if (category.startsWith("employee_")) return UserRound;
  if (category.toLowerCase().includes("announcement")) return Megaphone;
  return Bell;
}

function readableTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function NotificationBell({
  user,
  onNavigate,
}: {
  user: AuthUser | null;
  onNavigate?: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [readingId, setReadingId] = useState<string | number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRequestRef = useRef(0);
  const countRequestRef = useRef(0);
  const listAbortRef = useRef<AbortController | null>(null);
  const countAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const hasLoadedListRef = useRef(false);

  const loadUnreadCount = useCallback(async () => {
    if (!user) return;
    countAbortRef.current?.abort();
    const controller = new AbortController();
    const requestId = countRequestRef.current + 1;
    countRequestRef.current = requestId;
    countAbortRef.current = controller;
    try {
      const unread = await api<{ count: number }>("/notifications/unread-count/", { signal: controller.signal });
      if (countRequestRef.current !== requestId || controller.signal.aborted) return;
      if (!mountedRef.current) return;
      setCount(unread.count);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Could not load notifications.");
    }
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    listAbortRef.current?.abort();
    const controller = new AbortController();
    const requestId = listRequestRef.current + 1;
    listRequestRef.current = requestId;
    listAbortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const list = await api<Paginated<PortalNotification>>("/notifications/", { signal: controller.signal });
      if (listRequestRef.current !== requestId || controller.signal.aborted) return;
      if (!mountedRef.current) return;
      setItems(list.results);
      hasLoadedListRef.current = true;
      loadUnreadCount();
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      if (listRequestRef.current === requestId && !controller.signal.aborted) setLoading(false);
    }
  }, [loadUnreadCount, user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setItems([]);
    setCount(0);
    hasLoadedListRef.current = false;
    if (!user) return;
    loadUnreadCount();
    const timer = window.setInterval(loadUnreadCount, 60000);
    return () => {
      window.clearInterval(timer);
      listAbortRef.current?.abort();
      countAbortRef.current?.abort();
    };
  }, [loadUnreadCount, user]);

  useEffect(() => {
    if (open && user && !hasLoadedListRef.current) loadNotifications();
  }, [loadNotifications, open, user]);

  useEffect(() => {
    if (!user) return;
    const socket = getGlobalSocket();
    if (!socket) return;

    const handleNewNotification = (data: { notification?: PortalNotification }) => {
      const notif = data?.notification;
      if (!notif) return;
      setCount((prev) => prev + 1);
      setItems((prev) => [notif, ...prev.filter((i) => i.id !== notif.id)]);
      toast.info(`🔔 ${notif.title}: ${notif.message}`);

      showDesktopNotification(notif.title, {
        body: notif.message,
        url: notif.link || "/dashboard",
        tag: `notif-${notif.id}`,
        soundType: "notification",
      });
    };

    socket.on("notification:new", handleNewNotification);
    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleNotificationClick(item: PortalNotification) {
    if (readingId !== null) return;
    setOpen(false);
    if (!item.is_read) {
      markRead(item);
    }

    let targetUrl = item.link;
    if (!targetUrl) {
      const cat = (item.category || "").toLowerCase();
      if (cat.includes("meet")) targetUrl = "/meetings";
      else if (cat.includes("chat") || cat.includes("message")) targetUrl = "/chat";
      else if (cat.includes("leave")) targetUrl = "/leaves";
      else if (cat.includes("announce")) targetUrl = "/announcements";
      else if (cat.includes("attendance")) targetUrl = "/attendance";
      else if (cat.includes("payroll") || cat.includes("salary")) targetUrl = "/salary-slips";
      else if (cat.includes("task") || cat.includes("work")) targetUrl = "/work";
      else targetUrl = "/dashboard";
    }

    if (targetUrl) {
      if (onNavigate) {
        onNavigate(targetUrl);
      } else if (typeof window !== "undefined") {
        window.location.href = targetUrl;
      }
    }
  }

  async function markRead(notification: PortalNotification) {
    if (notification.is_read || readingId !== null) return;
    setReadingId(notification.id);
    try {
      await api<PortalNotification>(`/notifications/${notification.id}/read/`, { method: "POST" });
      if (!mountedRef.current) return;
      setItems(current => current.map(item => item.id === notification.id ? { ...item, is_read: true } : item));
      setCount(current => Math.max(0, current - 1));
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Could not update notification.");
    } finally {
      if (mountedRef.current) setReadingId(null);
    }
  }

  async function markAllRead() {
    if (markingAll || count === 0) return;
    setMarkingAll(true);
    try {
      await api<{ updated: number }>("/notifications/mark-all-read/", { method: "POST" });
      if (!mountedRef.current) return;
      setItems(current => current.map(item => ({ ...item, is_read: true })));
      setCount(0);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Could not update notifications.");
    } finally {
      if (mountedRef.current) setMarkingAll(false);
    }
  }

  function toggleNotifications() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && count > 0) {
      markAllRead();
    }
  }

  return (
    <div className="notification-wrap" ref={panelRef}>
      <button className="icon-button notification-trigger" type="button" aria-label="Open notifications" aria-expanded={open} onClick={toggleNotifications}>
        <Bell size={19} />
        {count > 0 && <span className="notification-badge">{count > 99 ? "99+" : count}</span>}
      </button>
      {open && <div className="notification-panel" role="dialog" aria-label="Notifications">
        <div className="notification-head">
          <div><b>Notifications</b><span>{count > 0 ? `${count} unread` : "All caught up"}</span></div>
          <div>
            <button type="button" onClick={loadNotifications} disabled={loading} aria-label="Retry notifications"><RotateCw size={14} /></button>
            <button type="button" onClick={markAllRead} disabled={markingAll || count === 0}><CheckCheck size={14} /> Mark all</button>
          </div>
        </div>
        <div className="notification-list">
          {loading && !items.length && <div className="notification-state">Loading notifications</div>}
          {error && <div className="notification-state error"><span>{error}</span><button type="button" onClick={loadNotifications}>Retry</button></div>}
          {!loading && !error && !items.length && <div className="notification-state">No notifications yet.</div>}
          {items.map(item => {
            const Icon = notificationIcon(item.category);
            return <button key={item.id} type="button" className={`notification-item ${item.is_read ? "read" : "unread"}`} disabled={readingId === item.id} onClick={() => handleNotificationClick(item)}>
              <span className="notification-icon"><Icon size={15} /></span>
              <span><b>{item.title}</b><small>{item.message}</small><em>{item.category.replaceAll("_", " ")} / {readableTime(item.created_at)}</em></span>
            </button>;
          })}
        </div>
      </div>}
    </div>
  );
}

function LogoutModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="logout-backdrop"
      onClick={() => {
        if (!loading) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="logout-dialog"
      >
        <div className="logout-dialog-head">
          <div className="logout-dialog-title">
            <div className="logout-dialog-icon">
              <LogOut size={20} />
            </div>
            <h3 id="logout-dialog-title">
              Confirm Sign Out
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="logout-dialog-close"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <p className="logout-dialog-copy">
          Are you sure you want to sign out of FLUMENX BOS? You will need to log back in to access your workspace.
        </p>

        <div className="logout-dialog-actions">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="logout-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="logout-confirm"
          >
            {loading ? (
              <>
                <RotateCw size={14} className="logout-spin" />
                Signing out...
              </>
            ) : (
              "Sign Out"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
export function Shell({ children, role }: { children: ReactNode; role?: WorkspaceRole }) {
  const [mounted, setMounted] = useState(false);
  const cachedUser = getCachedAuthUser();
  const workspaceRole = role || getWorkspaceRole(cachedUser?.portal_role);
  const cachedUserMatchesRole = Boolean(cachedUser && isRoleAllowedInWorkspace(cachedUser.portal_role, workspaceRole, cachedUser));
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(Boolean(cachedUserMatchesRole));
  const [user, setUser] = useState<AuthUser | null>(cachedUserMatchesRole ? cachedUser : null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [revalidatingBfCache, setRevalidatingBfCache] = useState(false);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [dynamicNav, setDynamicNav] = useState<readonly (readonly [string, string, any])[] | null>(() => {
    const key = cachedUser?.id ? `${cachedUser.id}_${workspaceRole}` : workspaceRole;
    return dynamicNavCache[key] || null;
  });
  const [navLoading, setNavLoading] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    requestNotificationPermission().catch(() => {});
    const handleOpenPw = () => setShowPasswordModal(true);
    window.addEventListener("flumenx:open_change_password_modal", handleOpenPw);
    return () => {
      window.removeEventListener("flumenx:open_change_password_modal", handleOpenPw);
    };
  }, []);

  const fetchDynamicNavigation = useCallback(async () => {
    if (!user) return;
    const userCacheKey = `${user.id}_${workspaceRole}`;
    try {
      const items = await api<import("./layout/navigation").DynamicApiNavItem[]>("/portal/navigation/me/");
      if (Array.isArray(items)) {
        const sorted = [...items].sort((a, b) => a.sidebar_order - b.sidebar_order);
        const filtered = sorted.filter(
          (item) =>
            item.title !== "Command Center" &&
            item.title !== "Command Center Dashboard" &&
            item.title !== "Timeline & Phases" &&
            !item.route_path.includes("view=command-center") &&
            !item.route_path.includes("view=timeline")
        );
        const mapped = filtered.map((item) => [
          item.title,
          normalizeWorkspaceRoute(item.route_path, workspaceRole),
          getLucideIcon(item.icon),
        ] as const);
        dynamicNavCache[userCacheKey] = mapped;
        setDynamicNav(mapped);
      } else {
        const fallback = getFilteredNavigation(workspaceRole);
        dynamicNavCache[userCacheKey] = fallback;
        setDynamicNav(fallback);
      }
    } catch {
      const fallback = getFilteredNavigation(workspaceRole);
      dynamicNavCache[userCacheKey] = fallback;
      setDynamicNav(fallback);
    }
  }, [user, workspaceRole]);

  useEffect(() => {
    if (user) {
      fetchDynamicNavigation();
    }
  }, [user, fetchDynamicNavigation]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchDynamicNavigation();
    };
    const handleAuthUserUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<AuthUser>;
      if (customEvent.detail) {
        setUser(customEvent.detail);
      }
    };
    window.addEventListener("flumenx:navigation_refresh", handleRefresh);
    window.addEventListener("flumenx:auth_user_updated", handleAuthUserUpdated);
    return () => {
      window.removeEventListener("flumenx:navigation_refresh", handleRefresh);
      window.removeEventListener("flumenx:auth_user_updated", handleAuthUserUpdated);
    };
  }, [fetchDynamicNavigation]);

  useEffect(() => {
    let active = true;
    loadAuthUser(() => api<AuthUser>("/auth/me/"), false)
      .then(current => {
        if (!active) return;
        const destination = getWorkspaceDestination(current.portal_role);
        if (!isRoleAllowedInWorkspace(current.portal_role, workspaceRole, current)) {
          router.replace(destination);
          return;
        }
        setUser(current);
        setReady(true);
      })
      .catch(() => {
        clearCachedAuthUser();
        if (active) {
          if (typeof window !== "undefined") {
            window.location.replace("/login");
          } else {
            router.replace("/login");
          }
        }
      });
    return () => { active = false; };
  }, [workspaceRole, router]);

  useEffect(() => {
    if (!user) return;
    const token = typeof window !== "undefined"
      ? (localStorage.getItem("flumenx_access_token") || localStorage.getItem("access_token") || "")
      : "";
    const socket = getGlobalSocket(token);
    if (!socket) return;

    if (token) {
      socket.emit("presence:register", { token });
    }
    socket.emit("presence:get-online-users");

    // Periodic heartbeat to stay marked online on server across all portal tabs
    const heartbeat = setInterval(() => {
      if (socket.connected) {
        socket.emit("presence:ping");
      }
    }, 25000);

    const handleNewMessage = (data: { conversationId: string; message: any }) => {
      const msg = data?.message;
      if (!msg) return;
      const currentUserId = user.id || (user as any)._id;
      const senderId = msg.sender?._id || msg.sender?.id || msg.sender;
      if (senderId && String(senderId) !== String(currentUserId)) {
        const isOnChat = typeof window !== "undefined" && window.location.pathname.includes("/chat");
        if (!isOnChat) {
          setUnreadChatCount((prev) => prev + 1);
          const senderName = msg.sender?.name || (msg.sender?.firstName ? `${msg.sender.firstName} ${msg.sender.lastName || ''}`.trim() : "Colleague");
          toast.info(`${senderName}: ${msg.content || (msg.attachments?.length ? 'Sent an attachment' : 'New message')}`);

          showDesktopNotification(`New message from ${senderName}`, {
            body: msg.content || (msg.attachments?.length ? "Sent an attachment" : "New message"),
            url: "/chat",
            tag: `msg-${data.conversationId}`,
            soundType: "message",
          });
        }
      }
    };

    const handleMeetingScheduled = (data: { meeting: any }) => {
      const m = data?.meeting;
      if (!m) return;
      toast.info(`📅 New Meeting: ${m.title || "Meeting"} (${m.date || ""} ${m.time || ""})`);
      showDesktopNotification(`📅 New Meeting: ${m.title || "Meeting"}`, {
        body: `Scheduled for ${m.date || ""} at ${m.time || ""} (${m.department || "Company"}). Click to open.`,
        url: m.meeting_code ? `/meet/${m.meeting_code}` : "/meetings",
        tag: `meeting-${m.id || m.meeting_code}`,
        soundType: "notification",
      });
    };

    socket.on("chat:new-message", handleNewMessage);
    socket.on("meeting:scheduled", handleMeetingScheduled);
    return () => {
      clearInterval(heartbeat);
      socket.off("chat:new-message", handleNewMessage);
      socket.off("meeting:scheduled", handleMeetingScheduled);
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    let checkingBfCache = false;

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !checkingBfCache) {
        checkingBfCache = true;
        setRevalidatingBfCache(true);
        api<AuthUser>("/auth/me/")
          .then(current => {
            if (!active) return;
            if (!isRoleAllowedInWorkspace(current.portal_role, workspaceRole, current)) {
              clearCachedAuthUser();
              window.location.replace("/login");
              return;
            }
            setUser(current);
            setRevalidatingBfCache(false);
          })
          .catch(() => {
            clearCachedAuthUser();
            if (active) window.location.replace("/login");
          })
          .finally(() => {
            checkingBfCache = false;
          });
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      active = false;
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [workspaceRole]);

  useEffect(() => {
    const canReviewLeaves = user?.portal_role === "ADMIN" || user?.portal_role === "HR";
    if (!canReviewLeaves) {
      setPendingLeaveCount(0);
      return;
    }

    const controller = new AbortController();
    const loadPendingLeaveCount = () => {
      api<{ count: number }>("/leaves/pending-count/", { signal: controller.signal })
        .then(data => setPendingLeaveCount(data.count))
        .catch(err => {
          if (!controller.signal.aborted) {
            console.warn("Could not load pending leave count", err);
            setPendingLeaveCount(0);
          }
        });
    };

    loadPendingLeaveCount();
    const timer = window.setInterval(loadPendingLeaveCount, 60000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadChatCount(0);
      return;
    }
    const controller = new AbortController();
    api<{ count: number }>("/chat/unread-count/", { signal: controller.signal })
      .then((res) => setUnreadChatCount(res.count || 0))
      .catch(() => {});
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (path.includes("/chat")) {
      setUnreadChatCount(0);
    }
  }, [path]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const openLogoutModal = () => {
    setOpen(false);
    setLoggingOut(false);
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.clear();
        localStorage.removeItem("flumenx_auth_user");
        localStorage.removeItem("flumenx_access_token");
        localStorage.removeItem("flumenx_refresh_token");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
      await logout();
    } catch {
      // Proceed to redirect even if network call fails
    } finally {
      clearCachedAuthUser();
      setUser(null);
      setLoggingOut(false);
      setShowLogoutModal(false);
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.replace("/login");
      } else {
        router.replace("/login");
      }
    }
  };

  const isSuperadmin = (user?.portal_role || user?.role || "").toUpperCase() === "SUPER_ADMIN" || Boolean((user as any)?.is_superuser || (user as any)?.isSuperuser || (user as any)?.isSuperadminWildcard);

  const baseNav: readonly (readonly [string, string, any])[] = dynamicNav !== null ? dynamicNav : getFilteredNavigation(workspaceRole);
  const filteredNav = baseNav.filter(([label, rawHref]) => {
    const href = typeof rawHref === "string" ? rawHref : "";
    if (isSuperadmin) return true;
    if (href === "/pages" && !hasPermission(user, "PAGE_MANAGEMENT", "can_view") && !(user as any)?.permissions?.PAGE_MANAGEMENT?.canView) {
      return false;
    }
    if ((href.startsWith("/admin/roles") || href === "/roles") && !hasPermission(user, "ROLES", "can_view") && !(user as any)?.permissions?.ROLES?.canView) {
      return false;
    }
    if ((href.startsWith("/admin/users") || href === "/users") && !hasPermission(user, "SUPER_ADMIN_USERS", "can_view") && !(user as any)?.permissions?.SUPER_ADMIN_USERS?.canView && !(user as any)?.permissions?.USERS?.canView) {
      return false;
    }
    if ((href.startsWith("/admin/audit-logs") || href === "/audit-logs") && !hasPermission(user, "AUDIT_LOGS", "can_view") && !(user as any)?.permissions?.AUDIT_LOGS?.canView) {
      return false;
    }
    if ((href === "/settings" || href.startsWith("/admin/settings")) && !hasPermission(user, "SETTINGS_ACCESS", "can_view") && !(user as any)?.permissions?.SETTINGS_ACCESS?.canView) {
      return false;
    }
    return true;
  });

  const hasAttendance = filteredNav.some(([label, href]) => label.toLowerCase().includes("attendance") || (typeof href === "string" && href.includes("/attendance")));
  const hasLeaves = filteredNav.some(([label, href]) => label.toLowerCase().includes("leave") || (typeof href === "string" && href.includes("/leaves")));

  const fixedItems: (readonly [string, string, any])[] = [];
  if (!hasAttendance) {
    fixedItems.push(["Attendance", "/attendance", CalendarCheck]);
  }
  if (!hasLeaves) {
    fixedItems.push(["Leave Requests", "/leaves", CalendarDays]);
  }
  const hasAccountingPerm = Boolean(isSuperadmin || hasPermission(user, "ACCOUNTING", "can_view") || (user as any)?.permissions?.ACCOUNTING?.canView || (user as any)?.permissions?.["*"]?.canView);
  if (hasAccountingPerm) {
    const hasAccounting = filteredNav.some(
      ([label, href]) =>
        label.toLowerCase().includes("accounting") ||
        (typeof href === "string" && href.startsWith("/accounting"))
    );
    if (!hasAccounting) {
      fixedItems.push(["Accounting & Finance", "/accounting", Landmark]);
    }
  }

  const nav = [...filteredNav, ...fixedItems];

  const categorizedNav = useMemo(() => {
    return groupNavigationByCategory(nav);
  }, [nav]);

  const name = user?.first_name || workspaceFallbackNames[workspaceRole];
  const dynamicRoleName =
    (user as any)?.dynamic_role?.name ||
    (user as any)?.dynamicRole?.name ||
    (user?.portal_role ? user.portal_role.replace(/_/g, " ") : "") ||
    workspaceLabels[workspaceRole];
  const roleLabel = dynamicRoleName || workspaceLabels[workspaceRole] || "PORTAL";
  if (!mounted || (!ready && !user)) return <div className="route-loader"><span>F</span><p>Verifying workspace session</p></div>;

  const canCreateTask = (() => {
    if (!user) return false;
    if (isSuperadmin) return true;
    return hasPermission(user, "WORK", "create_task") || Boolean((user as any)?.permissions?.WORK_BOARD?.can_create || (user as any)?.permissions?.TASKS?.can_create);
  })();

  const handleNewTaskClick = () => {
    if (typeof window !== "undefined") {
      if (path.includes("/work")) {
        window.dispatchEvent(new CustomEvent("flumenx:open_new_task_modal"));
      } else {
        router.push("/work?createTask=true");
      }
    }
  };

  return (
    <ShellUserContext.Provider value={user}>
      <div className="app-shell">
        <aside className={`sidebar ${open ? "open" : ""}`}>
            <div className="side-brand" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", paddingBottom: "14px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <FlumenxMark />
                <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation sidebar"><X /></button>
              </div>
              <div className="sub-brand" style={{ paddingLeft: "2px", marginTop: "4px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", color: "#52635B" }}>
                BUSINESS OPERATING SYSTEM
              </div>
            </div>
        <nav className="sidebar-nav-container">
          {categorizedNav.map((group) => {
            const hasActiveItem = group.items.some(
              ([, href]) =>
                path === href ||
                (href !== "/dashboard" && path.startsWith(href))
            );
            const isCollapsed =
              Boolean(collapsedCategories[group.category.id]) && !hasActiveItem;

            return (
              <div key={group.category.id} className="sidebar-category-group">
                <button
                  type="button"
                  className="sidebar-category-header"
                  onClick={() => toggleCategory(group.category.id)}
                  aria-expanded={!isCollapsed}
                  title={`Click to ${isCollapsed ? "expand" : "collapse"} ${group.category.label}`}
                >
                  <span className="sidebar-category-title">{group.category.label}</span>
                  <ChevronDown
                    size={13}
                    className={`sidebar-category-chevron ${isCollapsed ? "collapsed" : ""}`}
                  />
                </button>
                {!isCollapsed && (
                  <div className="sidebar-category-items">
                    {group.items.map(([label, rawHref, Icon]) => {
                      const href = normalizeWorkspaceRoute(rawHref, workspaceRole);
                      const isActive =
                        path === href ||
                        (href !== "/dashboard" && path.startsWith(href));
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setOpen(false)}
                          className={isActive ? "active" : ""}
                        >
                          <Icon size={16} />
                          <span>{label}</span>
                          {label.toLowerCase().includes("leave") && pendingLeaveCount > 0 && (
                            <em>{pendingLeaveCount > 99 ? "99+" : pendingLeaveCount}</em>
                          )}
                          {(label.toLowerCase().includes("chat") || label.toLowerCase() === "messages") && unreadChatCount > 0 && (
                            <em>{unreadChatCount > 99 ? "99+" : unreadChatCount}</em>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <PwaInstallButton variant="sidebar" />
          <div
            className="mini-profile cursor-pointer transition-colors p-2 mb-2"
            onClick={() => {
              setOpen(false);
              router.push("/profile");
            }}
            title="View Profile & Settings"
          >
            <Avatar name={name} avatar={user?.avatar || (user as any)?.employee?.avatar} />
            <div>
              <b>{name}</b>
              <span>{roleLabel}</span>
            </div>
          </div>
          <button type="button" onClick={openLogoutModal} disabled={loggingOut}><LogOut size={16} /> {loggingOut ? "Signing out..." : "Logout"}</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)} aria-label="Open navigation menu"><Menu /></button>
          <div className="topbar-word">FLUMENX BOS / <span>{roleLabel.toUpperCase()}</span></div>
          <div className="top-actions">
            <NotificationBell user={user} onNavigate={(url) => router.push(url)} />
            <Link
              href="/profile"
              className="topbar-user-pill"
              title="View Profile & Settings"
            >
              <Avatar name={user?.employee?.name || user?.first_name || user?.username || name} avatar={user?.avatar || (user as any)?.employee?.avatar} size={20} />
              <span className="topbar-user-name">{user?.employee?.name || user?.first_name || user?.username || name}</span>
            </Link>
            <button
              type="button"
              className="secondary-button topbar-logout-btn"
              onClick={openLogoutModal}
              disabled={loggingOut}
              aria-label="Sign out"
            >
              <LogOut size={14} />
              <span className="logout-text">Logout</span>
            </button>
          </div>
        </header>
        <div className="page">{children}</div>
      </main>

      <MobileBottomNav
        workspaceRole={workspaceRole}
        user={user}
        onOpenSidebar={() => setOpen(true)}
        onOpenLogout={openLogoutModal}
        onNewTaskClick={handleNewTaskClick}
      />

      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />

      <LogoutModal
        open={showLogoutModal}
        onClose={() => {
          if (!loggingOut) setShowLogoutModal(false);
        }}
        onConfirm={handleConfirmLogout}
        loading={loggingOut}
      />
    </div>
    </ShellUserContext.Provider>
  );
}
