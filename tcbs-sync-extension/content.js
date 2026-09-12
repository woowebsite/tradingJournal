// content.js - Runs inside TCBS web page
(function () {
  let lastSyncedToken = '';

  function trySyncToken() {
    let raw = localStorage.getItem('userInfo') || localStorage.getItem('user');
    if (!raw) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k);
        if (v && v.includes('authToken')) {
          raw = v;
          break;
        }
      }
    }

    if (!raw) return;

    let authToken = '';
    try {
      const parsed = JSON.parse(raw);
      authToken = parsed.authToken || parsed.token || parsed.accessToken || parsed.jwt;
    } catch {
      authToken = raw;
    }

    // Only send if token is valid and changed
    if (authToken && authToken !== lastSyncedToken) {
      chrome.runtime.sendMessage({
        type: 'TCBS_TOKEN_SYNC',
        payload: raw,
      }, (response) => {
        if (response && response.success) {
          lastSyncedToken = authToken;
          console.log(
            '%c[TradingJournal Sync] ✅ Đã đồng bộ Token TCBS sang Localhost thành công!',
            'color: #10b981; font-weight: bold; font-size: 13px;'
          );
        }
      });
    }
  }

  // Check on load
  setTimeout(trySyncToken, 2000);
  setTimeout(trySyncToken, 5000);

  // Periodic check every 30s
  setInterval(trySyncToken, 30000);
})();
