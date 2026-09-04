// background.js - Service Worker (Bypasses TCBS Content Security Policy)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TCBS_TOKEN_SYNC') {
    const rawData = message.payload;

    fetch('http://localhost:1337/api/tcbs-strategies/update-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          sendResponse({ success: true, data });
        } else {
          const err = await res.text();
          sendResponse({ success: false, error: err });
        }
      })
      .catch((err) => {
        console.warn('[TCBS Sync Extension] Failed to send token to localhost:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep channel open for async response
  }
});
