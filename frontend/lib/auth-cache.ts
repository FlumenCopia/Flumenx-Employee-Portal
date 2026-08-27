import type { AuthUser } from "./types";

let cachedAuthUser: AuthUser | null = null;
let authUserRequest: Promise<AuthUser> | null = null;
let authCacheVersion = 0;

export function getCachedAuthUser(): AuthUser | null {
  if (cachedAuthUser) return cachedAuthUser;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("flumenx_auth_user");
      if (stored) {
        cachedAuthUser = JSON.parse(stored);
        return cachedAuthUser;
      }
    } catch {
      // Ignore parse errors
    }
  }
  return null;
}

export function setCachedAuthUser(user: AuthUser) {
  authCacheVersion += 1;
  cachedAuthUser = user;
  authUserRequest = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("flumenx_auth_user", JSON.stringify(user));
    } catch {
      // Ignore storage errors
    }
  }
}

export function clearCachedAuthUser() {
  authCacheVersion += 1;
  cachedAuthUser = null;
  authUserRequest = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("flumenx_auth_user");
      localStorage.removeItem("flumenx_access_token");
      localStorage.removeItem("flumenx_refresh_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.removeItem("flumenx_auth_user");
      sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
  }
}

export function loadAuthUser(fetchUser: () => Promise<AuthUser>, forceRefresh = false) {
  if (!forceRefresh && cachedAuthUser) return Promise.resolve(cachedAuthUser);
  if (authUserRequest && !forceRefresh) return authUserRequest;

  const requestVersion = authCacheVersion;
  authUserRequest = fetchUser()
    .then(user => {
      if (requestVersion === authCacheVersion) setCachedAuthUser(user);
      return user;
    })
    .catch(error => {
      if (requestVersion === authCacheVersion) clearCachedAuthUser();
      throw error;
    })
    .finally(() => {
      if (requestVersion === authCacheVersion) authUserRequest = null;
    });

  return authUserRequest;
}
