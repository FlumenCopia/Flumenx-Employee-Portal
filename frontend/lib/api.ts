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

const API_URL = browserCompatibleApiUrl(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api");
let refreshPromise: Promise<boolean> | null = null;

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

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.split("; ").find(row => row.startsWith("csrftoken="))?.split("=")[1] || "";
}

function isUnsafe(method?: string) {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes((method || "GET").toUpperCase());
}

export async function ensureCsrf() {
  if (!csrfToken()) {
    await fetch(`${API_URL}/auth/csrf/`, { credentials: "include" });
  }
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
  } finally {
    clearCachedAuthUser();
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const request = async () => {
    if (isUnsafe(options.method)) await ensureCsrf();
    const headers: HeadersInit = { ...(!(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers };
    if (isUnsafe(options.method)) (headers as Record<string, string>)["X-CSRFToken"] = csrfToken();
    return fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers });
  };
  let response = await request();
  if (response.status === 401 && path !== "/auth/refresh/" && path !== "/auth/login/") {
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
  const headers: HeadersInit = { ...options.headers };
  let response = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers });
  if (response.status === 401) {
    const refreshed = await refreshAuth();
    if (refreshed) {
      response = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers });
    } else {
      redirectToLoginAfterRefreshFailure();
    }
  }
  if (!response.ok) throw new ApiError("Download failed", response.status);
  return response.blob();
}
