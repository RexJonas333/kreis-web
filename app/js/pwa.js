// Web-App: Offline-Start über einen Service Worker (nicht in der Windows- oder Android-App nötig)
(function () {
  const native = window.kreisDesktop || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!native && 'serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
