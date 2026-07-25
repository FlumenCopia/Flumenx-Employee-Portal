import type { AuthUser } from "./types";

let cachedAuthUser: AuthUser | null = null;
let authUserRequest: Promise<AuthUser> | null = null;
let authCacheVersion = 0;

export function getCachedAuthUser() {
  return cachedAuthUser;
}

export function setCachedAuthUser(user: AuthUser) {
  authCacheVersion += 1;
  cachedAuthUser = user;
  authUserRequest = null;
}

export function clearCachedAuthUser() {
  authCacheVersion += 1;
  cachedAuthUser = null;
  authUserRequest = null;
}

export function loadAuthUser(fetchUser: () => Promise<AuthUser>) {
  if (cachedAuthUser) return Promise.resolve(cachedAuthUser);
  if (authUserRequest) return authUserRequest;

  const requestVersion = authCacheVersion;
  authUserRequest = fetchUser()
    .then(user => {
      if (requestVersion === authCacheVersion) cachedAuthUser = user;
      return user;
    })
    .catch(error => {
      if (requestVersion === authCacheVersion) cachedAuthUser = null;
      throw error;
    })
    .finally(() => {
      if (requestVersion === authCacheVersion) authUserRequest = null;
    });

  return authUserRequest;
}
