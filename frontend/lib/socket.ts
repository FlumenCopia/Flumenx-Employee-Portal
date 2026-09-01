import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export function getGlobalSocket(authToken?: string): Socket {
  if (typeof window === "undefined") {
    return null as any;
  }

  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  if (!socketInstance) {
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
        token: authToken || "",
      },
    });

    socketInstance.on("connect", () => {
      // Register presence with token
      if (authToken) {
        socketInstance?.emit("presence:register", { token: authToken });
      }
      socketInstance?.emit("presence:get-online-users");
    });

    socketInstance.on("disconnect", () => {
      // Auto-reconnect will handle reconnection
    });
  }

  return socketInstance;
}

export function disconnectGlobalSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
