import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;
let currentToken: string = "";
const onlineUserIdsSet = new Set<string>();
type PresenceListener = (onlineIds: string[]) => void;
const presenceListeners = new Set<PresenceListener>();

function notifyPresenceListeners() {
  const ids = Array.from(onlineUserIdsSet);
  presenceListeners.forEach((listener) => {
    try {
      listener(ids);
    } catch (err) {
      console.error("[Socket Presence Listener Error]", err);
    }
  });
}

export function subscribeOnlineUsers(listener: PresenceListener): () => void {
  presenceListeners.add(listener);
  listener(Array.from(onlineUserIdsSet));
  return () => {
    presenceListeners.delete(listener);
  };
}

export function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const flumenxToken = localStorage.getItem("flumenx_access_token");
    if (flumenxToken) return flumenxToken;

    const access = localStorage.getItem("access_token");
    if (access) return access;

    const cachedAuth = localStorage.getItem("flumenx_auth_user") || localStorage.getItem("auth_user");
    if (cachedAuth) {
      const parsed = JSON.parse(cachedAuth);
      if (parsed.token || parsed.access) return parsed.token || parsed.access;
    }

    const rawToken = localStorage.getItem("token") || localStorage.getItem("jwt");
    if (rawToken) return rawToken;
  } catch {
    // fallback
  }
  return "";
}

export function resolveSocketUrl(): string {
  if (typeof window === "undefined") return "";

  // 1. Explicit env var if specified
  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, "");
  }

  // 2. Local development fallback (browser on port 3000 -> Express backend on port 8000)
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `http://${hostname}:8000`;
  }

  // 3. In production, connect to origin (e.g. https://erp.flumenx.in)
  // Nginx reverse proxy forwards /socket.io/ to http://127.0.0.1:8000
  return window.location.origin;
}

export function getGlobalOnlineUserIds(): string[] {
  return Array.from(onlineUserIdsSet);
}

export function isUserOnline(id?: string | number | null): boolean {
  if (!id) return false;
  const strId = String(id);
  return onlineUserIdsSet.has(strId);
}

export function getGlobalSocket(authToken?: string): Socket {
  if (typeof window === "undefined") {
    return null as any;
  }

  const tokenToUse = authToken || getStoredToken();

  if (socketInstance) {
    if (tokenToUse && tokenToUse !== currentToken) {
      currentToken = tokenToUse;
      (socketInstance.auth as any) = { token: tokenToUse };
      if ((socketInstance.io.opts as any)) {
        (socketInstance.io.opts as any).query = { token: tokenToUse };
      }
      try {
        (socketInstance as any).opts = (socketInstance as any).opts || {};
        (socketInstance as any).opts.auth = { token: tokenToUse };
      } catch {}
      if (socketInstance.connected) {
        socketInstance.emit("presence:register", { token: tokenToUse });
        socketInstance.emit("presence:get-online-users");
      } else {
        socketInstance.connect();
      }
    } else if (tokenToUse && socketInstance.connected) {
      // Re-affirm presence registration
      socketInstance.emit("presence:register", { token: tokenToUse });
    } else if (!socketInstance.connected) {
      socketInstance.connect();
    }
    return socketInstance;
  }

  currentToken = tokenToUse;
  const socketUrl = resolveSocketUrl();

  socketInstance = io(socketUrl, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    auth: {
      token: tokenToUse,
    },
    query: tokenToUse ? { token: tokenToUse } : undefined,
  });

  const registerPresence = () => {
    const activeToken = currentToken || getStoredToken();
    if (activeToken) {
      socketInstance?.emit("presence:register", { token: activeToken });
    }
    socketInstance?.emit("presence:get-online-users");
  };

  socketInstance.on("connect", () => {
    registerPresence();
  });

  socketInstance.on("connect_error", (err) => {
    console.warn("[Socket.IO Client] Connection error to", socketUrl, err?.message);
  });

  socketInstance.on("presence:update", (data: { userId?: string; status?: string; onlineUserIds?: string[] }) => {
    if (data?.onlineUserIds && Array.isArray(data.onlineUserIds)) {
      onlineUserIdsSet.clear();
      data.onlineUserIds.forEach((id) => onlineUserIdsSet.add(String(id)));
      notifyPresenceListeners();
    } else if (data?.userId) {
      if (data.status === "online") {
        onlineUserIdsSet.add(String(data.userId));
      } else {
        onlineUserIdsSet.delete(String(data.userId));
      }
      notifyPresenceListeners();
    }
  });

  socketInstance.on("presence:online-users", (data: { onlineUserIds?: string[] } | string[]) => {
    const ids = Array.isArray(data) ? data : data?.onlineUserIds || [];
    onlineUserIdsSet.clear();
    ids.forEach((id) => onlineUserIdsSet.add(String(id)));
    notifyPresenceListeners();
  });

  // Re-affirm presence on window focus/visibility
  if (typeof window !== "undefined") {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && socketInstance) {
        if (!socketInstance.connected) {
          socketInstance.connect();
        } else {
          registerPresence();
        }
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    // Sync auth changes across tabs
    window.addEventListener("storage", (e) => {
      if (e.key === "flumenx_access_token" || e.key === "access_token") {
        const newToken = e.newValue || getStoredToken();
        if (newToken && newToken !== currentToken) {
          reconnectSocketWithToken(newToken);
        }
      }
    });
  }

  // Trigger initial registration if already connected
  if (socketInstance.connected) {
    registerPresence();
  }

  return socketInstance;
}

export function reconnectSocketWithToken(token: string) {
  currentToken = token;
  const socket = getGlobalSocket(token);
  if (socket) {
    (socket.auth as any) = { token };
    if ((socket.io.opts as any)) {
      (socket.io.opts as any).query = { token };
    }
    try {
      (socket as any).opts = (socket as any).opts || {};
      (socket as any).opts.auth = { token };
    } catch {}
    if (socket.connected) {
      socket.emit("presence:register", { token });
      socket.emit("presence:get-online-users");
    } else {
      socket.connect();
    }
  }
}

export function disconnectGlobalSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentToken = "";
    onlineUserIdsSet.clear();
    notifyPresenceListeners();
  }
}
