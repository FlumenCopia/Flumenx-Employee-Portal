import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;
let currentToken: string = "";

function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const cached = localStorage.getItem("auth_user");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.token) return parsed.token;
    }
    const rawToken = localStorage.getItem("token");
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

