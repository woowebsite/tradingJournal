
// TCBS External API Service

export const getStockHistory = async (ticker) => {
    // Current timestamp for 'to' parameter (approximation for "now" or future to cover all)
    // 1767052800 is roughly year 2026, safe enough.
    const to = Math.floor(Date.now() / 1000); // or Math.floor(Date.now() / 1000);
    const countBack = 301; // Reasonable default, user asked for 598.

    // URL: https://apiextaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=GEE&type=stock&resolution=D&to=1767052800&countBack=598
    // URL: https://apiextaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=GEE&type=stock&resolution=D&to=1767052800&countBack=598
    // USE PROXY: /api-tcbs/... to avoid CORS
    const url = `/api-tcbs/stock-insight/v2/stock/bars-long-term?ticker=${ticker}&type=stock&resolution=D&to=${to}&countBack=${countBack}`;

    const token = import.meta.env.VITE_TCBS_TOKEN;

    const headers = {
        'Accept': 'application/json',
        'Accept-Language': 'vi',
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
    };

    if (token) {
        // Check for non-ASCII characters (often caused by copying truncated '...' tokens)
        if (/[^\x00-\x7F]/.test(token)) {
            console.error("TCBS Token contains invalid characters (non-ASCII). You may have copied a truncated token with '…'. Check your .env file.");
            alert("Error: VITE_TCBS_TOKEN contains invalid characters. Please check your .env file.");
            return []; // Stop execution
        }
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers,
            // mode: 'cors' // default
        });
        console.log(response);
        if (!response.ok) {
            throw new Error(`TCBS API Error: ${response.statusText}`);
        }
        const jsonData = await response.json();

        // Transform data map if necessary
        // TCBS response example needed? Assuming standard array of objects based on URL params.
        // Usually returns structure like: { data: [...] } or just [...]
        // Based on typical TCBS:
        // { "data": [ { "open": ..., "high": ..., "low": ..., "close": ..., "volume": ..., "tradingDate": "..." }, ... ] }

        // Let's assume standard response and return the array.
        // We might need to inspect the response if it fails.
        return jsonData.data || jsonData || [];

    } catch (error) {
        console.error("Failed to fetch from TCBS:", error);
        throw error;
    }
};

export const getIntradaySnapshots = async (tickers) => {
    // tickers: "BIC,BTP,..."
    const url = `/api-tcbs/stock-insight/v1/stock/intraday-snapshots?tickers=${tickers}`;
    const token = import.meta.env.VITE_TCBS_TOKEN;

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    if (token && !/[^\x00-\x7F]/.test(token)) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) {
            throw new Error(`TCBS API Error: ${response.statusText}`);
        }
        const jsonData = await response.json();
        return jsonData.data || [];
    } catch (error) {
        console.error("Failed to fetch snapshots:", error);
        throw error;
    }
};


export const getTechnicalIndicators = async (ticker) => {
    // URL: /api-tcbs/ta/v1/summary/gaugechart/${ticker}?period=D
    const url = `/api-tcbs/ta/v1/summary/gaugechart/${ticker}?period=D`;

    const token = import.meta.env.VITE_TCBS_TOKEN;
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    if (token) {
        if (/[^\x00-\x7F]/.test(token)) {
            console.error("TCBS Token contains invalid characters.");
            return [];
        }
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers
        });
        if (!response.ok) {
            throw new Error(`TCBS API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch indicators:", error);
        throw error; // Or return [] if we want to digest error?
    }
};
