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
      const refreshToken = typeof window !== "undefined" ? (localStorage.getItem("flumenx_refresh_token") || localStorage.getItem("refresh_token") || "") : "";
      const refreshed = await fetch(`${API_URL}/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (refreshed.ok) {
        const data = await refreshed.json().catch(() => ({}));
        if (data && data.access && typeof window !== "undefined") {
          localStorage.setItem("flumenx_access_token", data.access);
          localStorage.setItem("access_token", data.access);
        }
        return true;
      }
      return false;
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
      localStorage.removeItem("flumenx_auth_user");
      localStorage.removeItem("flumenx_access_token");
      localStorage.removeItem("flumenx_refresh_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.clear();
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
    const token = typeof window !== "undefined" ? (localStorage.getItem("flumenx_access_token") || localStorage.getItem("access_token") || "") : "";
    const headers: Record<string, string> = {
      ...(!(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };
    if (isUnsafe(options.method)) headers["X-CSRFToken"] = csrfToken();
    return fetch(`${API_URL}${normalizedPath}`, { ...options, credentials: "include", headers });
  };
  let response = await request();
  const isLoginPage = typeof window !== "undefined" && window.location.pathname === "/login";
  const shouldSkipRefresh = isLoginPage && normalizedPath === "/auth/me/";

  if (response.status === 401 && !shouldSkipRefresh && normalizedPath !== "/auth/refresh/" && normalizedPath !== "/auth/login/" && normalizedPath !== "/auth/csrf/") {
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
  const isLoginPage = typeof window !== "undefined" && window.location.pathname === "/login";
  const shouldSkipRefresh = isLoginPage && normalizedPath === "/auth/me/";

  if (response.status === 401 && !shouldSkipRefresh && normalizedPath !== "/auth/refresh/" && normalizedPath !== "/auth/login/" && normalizedPath !== "/auth/csrf/") {
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
