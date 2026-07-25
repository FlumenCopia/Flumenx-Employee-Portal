"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, CheckCheck, ChevronDown, FileCheck2, LogOut, Megaphone, Menu, RotateCw, UserRound, X } from "lucide-react";
import { FlumenxMark, Avatar } from "./icons";
import { api, logout } from "@/lib/api";
import { clearCachedAuthUser, getCachedAuthUser, loadAuthUser } from "@/lib/auth-cache";
import type { AuthUser, Paginated, PortalNotification, WorkspaceRole } from "@/lib/types";
import { expectedPortalRole, portalRoleRoutes, workspaceFallbackNames, workspaceLabels, workspaceNavigation } from "./layout/navigation";

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
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    abortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const [list, unread] = await Promise.all([
        api<Paginated<PortalNotification>>("/notifications/", { signal: controller.signal }),
        api<{ count: number }>("/notifications/unread-count/", { signal: controller.signal }),
      ]);
      if (requestRef.current !== requestId || controller.signal.aborted) return;
      setItems(list.results);
      setCount(unread.count);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      if (requestRef.current === requestId && !controller.signal.aborted) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);
    return () => {
      window.clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [loadNotifications, user]);

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

  return (
    <div className="notification-wrap" ref={panelRef}>
      <button className="icon-button notification-trigger" type="button" aria-label="Open notifications" aria-expanded={open} onClick={() => setOpen(value => !value)}>
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
              <span><b>{item.title}</b><small>{item.message}</small><em>{item.category.replaceAll("_", " ")} · {readableTime(item.created_at)}</em></span>
            </button>;
          })}
        </div>
      </div>}
    </div>
  );
}

export function Shell({ children, role = "admin" }: { children: ReactNode; role?: WorkspaceRole }) {
  const workspaceRole = role;
  const cachedUser = getCachedAuthUser();
  const cachedUserMatchesRole = cachedUser?.portal_role === expectedPortalRole[workspaceRole];
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(Boolean(cachedUserMatchesRole));
  const [user, setUser] = useState<AuthUser | null>(cachedUserMatchesRole ? cachedUser : null);
  useEffect(() => {
    let active = true;
    loadAuthUser(() => api<AuthUser>("/auth/me/"))
      .then(current => {
        if (!active) return;
        const destination = portalRoleRoutes[current.portal_role];
        if (current.portal_role !== expectedPortalRole[workspaceRole]) {
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
  const nav = workspaceNavigation[workspaceRole];
  const name = user?.first_name || workspaceFallbackNames[workspaceRole];
  const roleLabel = workspaceLabels[workspaceRole];
  if (!ready) return <div className="route-loader"><span>H</span><p>Opening your workspace</p></div>;
  return (
    <ShellUserContext.Provider value={user}>
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="side-brand"><FlumenxMark /><button className="mobile-close" onClick={() => setOpen(false)}><X /></button></div>
        <div className="workspace"><div className="workspace-icon">FX</div><div><b>FLUMENX HQ</b><span>Core workspace</span></div><ChevronDown size={14} /></div>
        <nav>{nav.map(([label, href, Icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={path === href || (href !== `/${workspaceRole}/dashboard` && path.startsWith(href)) ? "active" : ""}><Icon size={18} /><span>{label}</span>{label === "Leave requests" && workspaceRole === "admin" && <em>2</em>}</Link>)}</nav>
        <div className="sidebar-foot">
          <div className="mini-profile"><Avatar name={name} /><div><b>{name}</b><span>{roleLabel}</span></div></div>
          <button onClick={async () => { clearCachedAuthUser(); setUser(null); setReady(false); await logout(); router.replace("/login"); }}><LogOut size={17} /> Sign out</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)}><Menu /></button>
          <div className="topbar-word">FLUMENX / <span>{roleLabel.toUpperCase()}</span></div>
          <div className="top-actions"><NotificationBell user={user} /><div className="top-profile"><Avatar name={name} size={34} /><div><b>{name}</b><span>{roleLabel}</span></div></div></div>
        </header>
        <div className="page">{children}</div>
      </main>
    </div>
    </ShellUserContext.Provider>
  );
}

