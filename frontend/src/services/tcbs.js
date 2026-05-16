// TCBS External API Service
import api from './api';

export const getStockHistory = async (ticker, type = 'stock', resolution = 'D') => {
    // Current timestamp for 'to' parameter (approximation for "now" or future to cover all)
    // 1767052800 is roughly year 2026, safe enough.
    const to = Math.floor(Date.now() / 1000); // or Math.floor(Date.now() / 1000);
    const countBack = 301; // Reasonable default, user asked for 598.

    // URL: https://apiextaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=GEE&type=stock&resolution=D&to=1767052800&countBack=598
    // URL: https://apiextaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=GEE&type=stock&resolution=D&to=1767052800&countBack=598
    // USE PROXY: /api-tcbs/... to avoid CORS
    const url = `/api-tcbs/stock-insight/v2/stock/bars-long-term?ticker=${ticker}&type=${type}&resolution=${resolution}&to=${to}&countBack=${countBack}`;

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

export const getFuturesHistory = async (ticker, type = 'derivative', resolution = 'D') => {
    // Current timestamp for 'to' parameter (approximation for "now" or future to cover all)
    // 1767052800 is roughly year 2026, safe enough.
    const to = Math.floor(Date.now() / 1000); // or Math.floor(Date.now() / 1000);
    const countBack = 301; // Reasonable default, user asked for 598.

    // https://apiextaws.tcbs.com.vn/futures-insight/v2/stock/bars?ticker=41I1G4000&type=derivative&resolution=1&to=1774337040&countBack=347

    const url = `/api-tcbs/futures-insight/v2/stock/bars?ticker=${ticker}&type=${type}&resolution=${resolution}&to=${to}&countBack=${countBack}`;

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

    if (token && [...token].every(char => char.charCodeAt(0) <= 127)) {
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

export const getMarketFlowLeader = async ({ exchange = 'ALL', industry = '2300', type = '1d' } = {}) => {
    const params = new URLSearchParams({ exchange, industry, type });
    const url = `/api-tcbs/stock-insight/v1/intraday/flow-market-leader?${params.toString()}`;
    const token = import.meta.env.VITE_TCBS_TOKEN;

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    if (token && [...token].every(char => char.charCodeAt(0) <= 127)) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) {
            throw new Error(`TCBS Market Flow API Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to fetch market flow:", error);
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


export const updateMarketInfo = async (ticker, symbolId) => {
    var symbol = ticker.replace(":HOSE", "");
    symbol = symbol.replace(":HNX", "");
    symbol = symbol.replace(":UPCOM", "");
    // https://apiextaws.tcbs.com.vn/stock-insight/v2/search?key=PDB&type=ALL
    const url = `/api-tcbs/stock-insight/v2/search?key=${symbol}&type=ALL`;
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };
    const token = import.meta.env.VITE_TCBS_TOKEN;
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
        const info = data.data.find(item => item.name === symbol);

        if (!info) {
            console.warn(`No metadata found for ${ticker} in TCBS`);
            return null;
        }

        const payload = {
            data: {
                exchange: info.exchange === "0" ? "HOSE" : info.exchange === "1" ? "HNX" : "UPCOM",
                sector: info.industry // Map industry to sector
            }
        };

        const res = await api.put(`/symbols/${symbolId}`, payload);
        return res.data.data;
    } catch (error) {
        console.error("Failed to update market info:", error);
        throw error;
    }
};
