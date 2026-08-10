"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, CheckCheck, ChevronDown, FileCheck2, LogOut, Megaphone, Menu, RotateCw, UserRound, X } from "lucide-react";
import { FlumenxMark, Avatar } from "./icons";
import { api, logout } from "@/lib/api";
import { clearCachedAuthUser, getCachedAuthUser, loadAuthUser } from "@/lib/auth-cache";
import type { AuthUser, Paginated, PortalNotification, WorkspaceRole } from "@/lib/types";
import { expectedPortalRoles, getFilteredNavigation, getLucideIcon, portalRoleRoutes, workspaceFallbackNames, workspaceLabels, workspaceNavigation } from "./layout/navigation";


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

function NotificationBell({ user }: { user: AuthUser | null }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [readingId, setReadingId] = useState<number | null>(null);
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
            return <button key={item.id} type="button" className={`notification-item ${item.is_read ? "read" : "unread"}`} disabled={readingId === item.id} onClick={() => markRead(item)}>
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
          Are you sure you want to sign out of the Flumenx Employee Portal? You will need to log back in to access your workspace.
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
export function Shell({ children, role = "admin" }: { children: ReactNode; role?: WorkspaceRole }) {
  const workspaceRole = role;
  const cachedUser = getCachedAuthUser();
  const cachedUserMatchesRole = Boolean(cachedUser && expectedPortalRoles[workspaceRole].includes(cachedUser.portal_role));
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(Boolean(cachedUserMatchesRole));
  const [user, setUser] = useState<AuthUser | null>(cachedUserMatchesRole ? cachedUser : null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [revalidatingBfCache, setRevalidatingBfCache] = useState(false);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [dynamicNav, setDynamicNav] = useState<readonly (readonly [string, string, any])[] | null>(null);
  const [navLoading, setNavLoading] = useState(true);

  const fetchDynamicNavigation = useCallback(async () => {
    if (!user) return;
    try {
      const items = await api<import("./layout/navigation").DynamicApiNavItem[]>("/portal/navigation/me/");
      if (Array.isArray(items)) {
        const sorted = [...items].sort((a, b) => a.sidebar_order - b.sidebar_order);
        const filtered = sorted.filter(
          (item) =>
            item.title !== "Command Center" &&
            item.title !== "Command Center Dashboard" &&
            item.title !== "Timeline & Phases" &&
            item.title !== "Employees" &&
            !item.route_path.includes("view=command-center") &&
            !item.route_path.includes("view=timeline") &&
            !item.route_path.includes("/employees")
        );
        const mapped = filtered.map((item) => [
          item.title,
          item.route_path,
          getLucideIcon(item.icon),
        ] as const);
        setDynamicNav(mapped);
      } else {
        setDynamicNav(getFilteredNavigation(workspaceRole));
      }
    } catch {
      setDynamicNav(getFilteredNavigation(workspaceRole));
    } finally {
      setNavLoading(false);
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
    window.addEventListener("flumenx:navigation_refresh", handleRefresh);
    return () => {
      window.removeEventListener("flumenx:navigation_refresh", handleRefresh);
    };
  }, [fetchDynamicNavigation]);

  useEffect(() => {
    let active = true;
    loadAuthUser(() => api<AuthUser>("/auth/me/"), true)
      .then(current => {
        if (!active) return;
        const destination = portalRoleRoutes[current.portal_role];
        if (!expectedPortalRoles[workspaceRole].includes(current.portal_role)) {
          router.replace(destination ? `/${destination}/dashboard` : "/login");
          return;
        }
        setUser(current); setReady(true);
      })
      .catch(() => {
        clearCachedAuthUser();
        if (active) router.replace("/login");
      });
    return () => { active = false; };
  }, [workspaceRole, router]);

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
            if (!expectedPortalRoles[workspaceRole].includes(current.portal_role)) {
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
        window.location.replace("/login");
      } else {
        router.replace("/login");
      }
    }
  };

  const nav = dynamicNav !== null ? dynamicNav : getFilteredNavigation(workspaceRole);

  const name = user?.first_name || workspaceFallbackNames[workspaceRole];
  const roleLabel = workspaceLabels[workspaceRole];
  if (!ready || revalidatingBfCache || (navLoading && dynamicNav === null)) return <div className="route-loader"><span>F</span><p>Verifying workspace session</p></div>;

  const canCreateTask = (() => {
    if (!user) return false;
    const role = (user.portal_role || "").toUpperCase();
    const creatorRoles = ["SUPER_ADMIN", "ADMIN", "HR", "TEAM_LEAD", "OPERATIONS_HEAD", "OPERATIONS"];
    if (!creatorRoles.includes(role)) return false;
    if (workspaceRole === "employee" || workspaceRole === "accountant") return false;
    return true;
  })();

  const handleNewTaskClick = () => {
    if (typeof window !== "undefined") {
      if (path.includes("/work")) {
        window.dispatchEvent(new CustomEvent("flumenx:open_new_task_modal"));
      } else {
        router.push(`/${workspaceRole}/work?createTask=true`);
      }
    }
  };

  return (
    <ShellUserContext.Provider value={user}>
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="side-brand"><FlumenxMark /><button className="mobile-close" onClick={() => setOpen(false)}><X /></button></div>
        <div className="workspace"><div className="workspace-icon">FX</div><div><b>FLUMENX HQ</b><span>Core workspace</span></div><ChevronDown size={14} /></div>
        <nav>{nav.map(([label, href, Icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={path === href || (href !== `/${workspaceRole}/dashboard` && path.startsWith(href)) ? "active" : ""}><Icon size={18} /><span>{label}</span>{label === "Leave requests" && pendingLeaveCount > 0 && <em>{pendingLeaveCount > 99 ? "99+" : pendingLeaveCount}</em>}</Link>)}</nav>
        <div className="sidebar-foot">
          <div className="mini-profile cursor-pointer hover:bg-[rgba(77,255,160,0.08)] transition-colors rounded-xl p-2 mb-2" onClick={openLogoutModal} title="Click to sign out"><Avatar name={name} /><div><b>{name}</b><span>{roleLabel}</span></div></div>
          <button type="button" onClick={openLogoutModal} disabled={loggingOut}><LogOut size={17} /> {loggingOut ? "Signing out..." : "Sign out"}</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)}><Menu /></button>
          <div className="topbar-word">FLUMENX / <span>{roleLabel.toUpperCase()}</span></div>
          <div className="top-actions" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#F2F6F3" }}>
              {user?.employee?.name || user?.first_name || user?.username || name}
            </span>
            {canCreateTask && (
              <button
                type="button"
                className="primary-button"
                onClick={handleNewTaskClick}
                style={{ height: "34px", padding: "0 14px", fontSize: "12px", borderRadius: "6px", fontWeight: 700 }}
              >
                + New Task
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={openLogoutModal}
              disabled={loggingOut}
              style={{ height: "34px", padding: "0 12px", fontSize: "12px", borderRadius: "6px", gap: "6px" }}
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </header>
        <div className="page">{children}</div>
      </main>


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
