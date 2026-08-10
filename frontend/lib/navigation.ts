export function triggerNavigationRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("flumenx:navigation_refresh"));
  }
}
