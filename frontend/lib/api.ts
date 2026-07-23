const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api";

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

export const tokenStore = {
  get: () => typeof window === "undefined" ? null : localStorage.getItem("flumenx_access"),
  refresh: () => typeof window === "undefined" ? null : localStorage.getItem("flumenx_refresh"),
  set: (access: string, refresh: string, user: unknown) => {
    localStorage.setItem("flumenx_access", access);
    localStorage.setItem("flumenx_refresh", refresh);
    localStorage.setItem("flumenx_user", JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem("flumenx_access"); localStorage.removeItem("flumenx_refresh"); localStorage.removeItem("flumenx_user");
  },
  user: () => {
    if (typeof window === "undefined") return null;
    try {
      const value = localStorage.getItem("flumenx_user");
      return value ? JSON.parse(value) : null;
    } catch { return null; }
  },
};

export async function logout() {
  const refresh = tokenStore.refresh();
  try {
    if (refresh) await api("/auth/logout/", { method: "POST", body: JSON.stringify({ refresh }) });
  } finally {
    tokenStore.clear();
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const request = async (token: string | null) => {
    const headers: HeadersInit = { ...(!(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers };
    if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, { ...options, headers });
  };
  let response = await request(tokenStore.get());
  if (response.status === 401 && tokenStore.refresh() && path !== "/auth/refresh/") {
    const refreshed = await fetch(`${API_URL}/auth/refresh/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokenStore.refresh() }),
    });
    if (refreshed.ok) {
      const tokens = await refreshed.json();
      localStorage.setItem("flumenx_access", tokens.access);
      if (tokens.refresh) localStorage.setItem("flumenx_refresh", tokens.refresh);
      response = await request(tokens.access);
    } else {
      tokenStore.clear();
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
  const token = tokenStore.get();
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) throw new ApiError("Download failed", response.status);
  return response.blob();
}


