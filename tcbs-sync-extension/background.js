// background.js - Service Worker (Bypasses TCBS Content Security Policy)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TCBS_TOKEN_SYNC') {
    const rawData = message.payload;
    const bodyStr = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);

    const endpoints = [
      'http://localhost:1337/api/tcbs-strategies/update-token',
      'http://127.0.0.1:1337/api/tcbs-strategies/update-token',
    ];

    async function trySend() {
      let lastErr = null;
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: bodyStr,
          });

          if (res.ok) {
            const data = await res.json();
            sendResponse({ success: true, data });
            return;
          } else {
            const errText = await res.text();
            lastErr = new Error(`Server returned ${res.status}: ${errText}`);
          }
        } catch (err) {
          lastErr = err;
        }
      }

      console.warn('[TCBS Sync Extension] Failed to send token to Strapi:', lastErr?.message || lastErr);
      sendResponse({ success: false, error: lastErr?.message || String(lastErr) });
    }

    trySend();
    return true; // Keep message channel open for async response
  }
});
