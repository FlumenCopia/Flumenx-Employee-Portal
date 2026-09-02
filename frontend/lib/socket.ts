import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;
let currentToken: string = "";

function getStoredToken(): string {
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

  socketInstance.on("connect", () => {
    const activeToken = tokenToUse || getStoredToken();
    if (activeToken) {
      socketInstance?.emit("presence:register", { token: activeToken });
    }
    socketInstance?.emit("presence:get-online-users");
  });

  return socketInstance;
}

export function disconnectGlobalSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentToken = "";
  }
}

