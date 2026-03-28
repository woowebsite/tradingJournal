export const getTCBSToken = async (otp) => {
    const url = `/openapi-tcbs/gaia/v1/oauth2/openapi/token`;
    const tcbsApi = import.meta.env.VITE_TCBS_API;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                otp: otp,
                apiKey: tcbsApi
            })
        });

        if (!response.ok) {
            throw new Error(`TCBS Token API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // Assuming the response contains { access_token: '...' } or { data: { access_token: '...' } }
        // Let's handle common structures
        if (data.access_token) return data.access_token;
        if (data.data && data.data.access_token) return data.data.access_token;

        // Return raw data if we aren't sure, usually it's just { access_token: "jwt" }
        return data;
    } catch (error) {
        console.error("Failed to fetch TCBS Token:", error);
        throw error;
    }
};

export const getTCBSOrders = async (accountNo, jwtToken) => {
    const url = `/openapi-tcbs/aion/v1/accounts/${accountNo}/orders`;

    // We expect the user to have acquired a JWT token via getTCBSToken
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
    };

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            throw new Error(`TCBS API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.data) return data.data;
        if (data && data.orders) return data.orders;

        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Failed to fetch TCBS Orders:", error);
        throw error;
    }
};

export const getTCBSProfile = async (custodyCode, jwtToken) => {
    const url = `/openapi-tcbs/eros/v2/get-profile/by-username/${custodyCode}`;

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
    };

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            throw new Error(`TCBS Profile API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.data) return data.data;
        return data;
    } catch (error) {
        console.error("Failed to fetch TCBS Profile:", error);
        throw error;
    }
};

export const getTCBSDerivatives = async (jwtToken) => {
    const url = `/openapi-tcbs/tartarus/v1/derivatives`;
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
    };

    try {
        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) {
            throw new Error(`TCBS Derivatives API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data && data.data) return data.data;
        return data; // Return raw if structure is different
    } catch (error) {
        console.error("Failed to fetch TCBS Derivatives:", error);
        throw error;
    }
};

export const getTCBSIntradayHistory = async (symbol, jwtToken) => {
    const url = `/openapi-tcbs/nyx/v1/intraday/${symbol}/his/paging`;
    // const url = `/openapi-tcbs/nyx/v1/intraday/${symbol}/his/paging`;
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
    };

    try {
        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) throw new Error(`TCBS Intraday History API Error`);
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch TCBS Intraday History:", error);
        throw error;
    }
};

export const getTCBSIntradayHistory2 = async (symbol, jwtToken) => {
    // /api-tcbs proxies to https://apiextaws.tcbs.com.vn
    const url = `/api-tcbs/futures-insight/v1/intraday/${symbol}/his/paging`;
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
    };

    try {
        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) throw new Error(`TCBS Intraday History 2 API Error`);
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch TCBS Intraday History 2:", error);
        throw error;
    }
};

export const getTCBSTickerCommons = async (symbol, jwtToken) => {
    const url = `/openapi-tcbs/tartarus/v1/tickerCommons?tickers=${symbol}`;
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
    };

    try {
        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) throw new Error(`TCBS Ticker Commons API Error`);
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch TCBS Ticker Commons:", error);
        throw error;
    }
};

export const placeTCBSConditionOrder = async (jwtToken, payload) => {
    const url = `/openapi-tcbs/khronos/v1/order/condition/place`;
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            // Try to parse error message if possible
            let errorMsg = `${response.status} ${response.statusText}`;
            try {
                const errData = await response.json();
                if (errData && errData.message) errorMsg = errData.message;
            } catch (e) { }
            throw new Error(`TCBS Order API Error: ${errorMsg}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to place TCBS Condition Order:", error);
        throw error;
    }
};
