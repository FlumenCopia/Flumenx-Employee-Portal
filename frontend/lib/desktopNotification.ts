import { soundService } from "./soundService";

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

export async function showDesktopNotification(
  title: string,
  options: {
    body: string;
    icon?: string;
    tag?: string;
    url?: string;
    soundType?: "notification" | "message" | "none";
  }
): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Play sound chime if sound enabled
  if (options.soundType === "message") {
    soundService.playMessageChime();
  } else if (options.soundType !== "none") {
    soundService.playNotificationChime();
  }

  // 2. Check Notification support & permission
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const icon = options.icon || "/flumenx-mark-only.png";
  const url = options.url || "/";
  const tag = options.tag || `flumenx-${Date.now()}`;

  // 3. Try displaying via Service Worker for persistent OS/Action Center notifications
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options.body,
          icon,
          badge: icon,
          tag,
          renotify: true,
          data: { url },
        } as any);
        return;
      }
    }
  } catch (err) {
    console.warn("[DesktopNotification] Service worker notification fallback:", err);
  }

  // 4. Fallback to standard window Notification
  try {
    const notif = new Notification(title, {
      body: options.body,
      icon,
      tag,
      data: { url },
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
      if (url && typeof window !== "undefined") {
        window.location.href = url;
      }
    };
  } catch (err) {
    console.warn("[DesktopNotification] Window notification error:", err);
  }
}
