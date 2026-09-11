export async function prepareOfflineFiles(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || !("caches" in window)) {
    throw new Error("Offline preparation requires a supported browser and production build.");
  }
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      if (error) reject(error); else resolve();
    };
    const timer = window.setTimeout(() => finish(new Error("Offline preparation timed out.")), 60000);
    channel.port1.onmessage = event => finish(event.data?.ok ? undefined : new Error("Caching failed."));
    navigator.serviceWorker.ready.then(registration => {
      if (!registration.active) throw new Error("Service worker is unavailable.");
      registration.active.postMessage({ type: "CACHE_NOW" }, [channel.port2]);
    }).catch(finish);
  });
}
