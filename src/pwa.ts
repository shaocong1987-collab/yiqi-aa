export function registerServiceWorker(onReady?: (message: string) => void) {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL || "./";
    const swUrl = new URL("sw.js", new URL(baseUrl, window.location.href)).toString();
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        onReady?.(registration.active ? "离线访问已准备好。" : "正在准备离线访问。");
      })
      .catch((error) => {
        console.warn("Service worker registration failed", error);
      });
  });
}
