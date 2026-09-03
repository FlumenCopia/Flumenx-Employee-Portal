import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;
let currentToken: string = "";
const onlineUserIdsSet = new Set<string>();

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
      if (socketInstance.connected) {
        socketInstance.emit("presence:register", { token: tokenToUse });
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
  const origin = window.location.origin;
  socketInstance = io(origin, {
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
  });

  const registerPresence = () => {
    const activeToken = tokenToUse || getStoredToken();
    if (activeToken) {
      socketInstance?.emit("presence:register", { token: activeToken });
    }
    socketInstance?.emit("presence:get-online-users");
  };

  socketInstance.on("connect", registerPresence);

  socketInstance.on("presence:update", (data: { userId?: string; status?: string; onlineUserIds?: string[] }) => {
    if (data?.onlineUserIds && Array.isArray(data.onlineUserIds)) {
      onlineUserIdsSet.clear();
      data.onlineUserIds.forEach((id) => onlineUserIdsSet.add(String(id)));
    } else if (data?.userId) {
      if (data.status === "online") {
        onlineUserIdsSet.add(String(data.userId));
      } else {
        onlineUserIdsSet.delete(String(data.userId));
      }
    }
  });

  socketInstance.on("presence:online-users", (data: { onlineUserIds?: string[] } | string[]) => {
    const ids = Array.isArray(data) ? data : data?.onlineUserIds || [];
    onlineUserIdsSet.clear();
    ids.forEach((id) => onlineUserIdsSet.add(String(id)));
  });

  // Trigger initial registration if already connected
  if (socketInstance.connected) {
    registerPresence();
  }

  return socketInstance;
}

export function disconnectGlobalSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentToken = "";
    onlineUserIdsSet.clear();
  }
}

