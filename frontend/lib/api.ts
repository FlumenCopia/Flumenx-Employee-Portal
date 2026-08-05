import { clearCachedAuthUser } from "./auth-cache";

function browserCompatibleApiUrl(url: string) {
  if (typeof window === "undefined") return url;
  const apiUrl = new URL(url);
  if (window.location.hostname === "localhost" && apiUrl.hostname === "127.0.0.1") {
    apiUrl.hostname = "localhost";
  }
  if (window.location.hostname === "127.0.0.1" && apiUrl.hostname === "localhost") {
    apiUrl.hostname = "127.0.0.1";
  }
  return apiUrl.toString().replace(/\/$/, "");
}

function resolveApiUrl() {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && (envUrl.includes("127.0.0.1") || envUrl.includes("localhost"))) {
      return browserCompatibleApiUrl(envUrl);
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return browserCompatibleApiUrl(envUrl || "http://127.0.0.1:8000/api");
    }
    return "/api";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
}

const API_URL = resolveApiUrl();
let refreshPromise: Promise<boolean> | null = null;
let cachedCsrfToken = "";

export class ApiError extends Error {
  fields: Record<string, string>;
  status: number;

  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

function getCookieCsrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.split("; ").find(row => row.startsWith("csrftoken="))?.split("=")[1] || "";
}

export function csrfToken() {
  return cachedCsrfToken || getCookieCsrfToken();
}

function isUnsafe(method?: string) {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes((method || "GET").toUpperCase());
}

export async function ensureCsrf(forceRefresh = false) {
  if (!forceRefresh && csrfToken()) {
    return csrfToken();
  }
  try {
    const response = await fetch(`${API_URL}/auth/csrf/`, { credentials: "include" });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data && typeof data.csrfToken === "string" && data.csrfToken) {
        cachedCsrfToken = data.csrfToken;
      }
    }
  } catch {
    // Fallback to cookie if fetch fails
  }
  if (!cachedCsrfToken) {
    cachedCsrfToken = getCookieCsrfToken();
  }
  return cachedCsrfToken;
}

function redirectToLoginAfterRefreshFailure() {
  if (typeof window === "undefined") return;
  clearCachedAuthUser();
  if (window.location.pathname === "/login") return;
  window.location.assign("/login");
}

async function refreshAuth() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      await ensureCsrf();
      const refreshed = await fetch(`${API_URL}/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
      });
      return refreshed.ok;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function logout() {
  try {
    await api("/auth/logout/", { method: "POST" });
  } catch {
    // Continue cleanup even if server is unreachable
  } finally {
    clearCachedAuthUser();
    if (typeof window !== "undefined") {
      sessionStorage.clear();
      localStorage.removeItem("flumenx_auth_user");
    }
  }
}




export function normalizeApiPath(path: string): string {
  if (!path) return "/";
  const queryIndex = path.indexOf("?");
  const hashIndex = path.indexOf("#");

  let splitIndex = path.length;
  if (queryIndex !== -1 && hashIndex !== -1) {
    splitIndex = Math.min(queryIndex, hashIndex);
  } else if (queryIndex !== -1) {
    splitIndex = queryIndex;
  } else if (hashIndex !== -1) {
    splitIndex = hashIndex;
  }

  let pathname = path.slice(0, splitIndex);
  const suffix = path.slice(splitIndex);

  if (!pathname.startsWith("/")) {
    pathname = "/" + pathname;
  }

  pathname = pathname.replace(/\/+/g, "/");

  if (!pathname.endsWith("/")) {
    pathname = pathname + "/";
  }

  return `${pathname}${suffix}`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const normalizedPath = normalizeApiPath(path);
  const request = async () => {
    if (isUnsafe(options.method)) await ensureCsrf();
    const headers: HeadersInit = { ...(!(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers };
    if (isUnsafe(options.method)) (headers as Record<string, string>)["X-CSRFToken"] = csrfToken();
    return fetch(`${API_URL}${normalizedPath}`, { ...options, credentials: "include", headers });
  };
  let response = await request();
  if (response.status === 401 && normalizedPath !== "/auth/refresh/" && normalizedPath !== "/auth/login/" && normalizedPath !== "/auth/csrf/") {
    const refreshed = await refreshAuth();
    if (refreshed) {
      response = await request();
    } else {
      redirectToLoginAfterRefreshFailure();
    }
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const fields: Record<string, string> = {};
    if (payload && typeof payload === "object") {
      for (const [key, value] of Object.entries(payload)) {
        fields[key] = Array.isArray(value) ? String(value[0]) : typeof value === "object" && value ? String(Object.values(value)[0]) : String(value);
      }
    }
    throw new ApiError(fields.detail || fields.non_field_errors || Object.values(fields)[0] || "Something went wrong", response.status, fields);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function apiBlob(path: string, options: RequestInit = {}) {
  const normalizedPath = normalizeApiPath(path);
  const headers: HeadersInit = { ...options.headers };
  let response = await fetch(`${API_URL}${normalizedPath}`, { ...options, credentials: "include", headers });
  if (response.status === 401 && normalizedPath !== "/auth/refresh/" && normalizedPath !== "/auth/login/" && normalizedPath !== "/auth/csrf/") {
    const refreshed = await refreshAuth();
    if (refreshed) {
      response = await fetch(`${API_URL}${normalizedPath}`, { ...options, credentials: "include", headers });
    } else {
      redirectToLoginAfterRefreshFailure();
    }
  }
  if (!response.ok) throw new ApiError("Download failed", response.status);
  return response.blob();
}
