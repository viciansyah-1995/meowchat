(function () {
  'use strict';

  var reloadKey = 'database-startup-reload';
  var reloading = false;
  var registration;
  var checking = false;

  function recoverAssetFailure(message) {
    if (!navigator.onLine || reloading || !/ChunkLoadError|Loading chunk [\w-]+ failed|Failed to load chunk|Importing a module script failed|Failed to fetch dynamically imported module/i.test(message)) return;
    try {
      var previous = Number(sessionStorage.getItem(reloadKey) || 0);
      if (Date.now() - previous < 60000) return;
      sessionStorage.setItem(reloadKey, String(Date.now()));
    } catch {
      // Without a persistent guard, let the error screen offer a manual reload.
      return;
    }
    reloading = true;
    location.reload();
  }

  window.addEventListener('error', function (event) {
    recoverAssetFailure(event.message || '');
  });
  window.addEventListener('unhandledrejection', function (event) {
    recoverAssetFailure(String(event.reason && (event.reason.message || event.reason) || ''));
  });

  async function updateWorker() {
    if (!('serviceWorker' in navigator) || !navigator.onLine || checking) return;
    checking = true;
    try {
      if (!registration) {
        registration = await navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' });
      }
      await registration.update();
    } catch {
      // Opening the app must remain possible when offline or push is unavailable.
    } finally {
      checking = false;
    }
  }

  updateWorker();
  window.addEventListener('online', updateWorker);
  window.addEventListener('pageshow', updateWorker);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') updateWorker();
  });
})();
