/**
 * Helper function to compute HMAC-SHA256 signature using the browser's native Web Crypto API.
 * This does not require any external npm packages or polyfills.
 */
async function hmacSHA256(key, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);
    
    // Import the secret key
    const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    // Sign the message
    const signature = await window.crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageData
    );
    
    // Convert signature ArrayBuffer to Hex string
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Normalizes symbols for Binance API compatibility.
 * Example: 'BINANCE:BTCUSDT.P' -> 'BTCUSDT'
 */
export const normalizeBinanceSymbol = (symbol) => {
    if (!symbol) return '';
    return symbol.toUpperCase().replace(/^.*:/, '').replace('.P', '').replace('PERP', '').trim();
};

/**
 * Places a Spot or Futures order on Binance via local Vite proxies.
 */
export const executeBinanceOrder = async ({ symbol, side, type = 'LIMIT', quantity, price, isFutures = false }) => {
    const apiKey = import.meta.env.VITE_BINANCE_API_KEY;
    const apiSecret = import.meta.env.VITE_BINANCE_API_SECRET;
    const useTestnet = import.meta.env.VITE_BINANCE_USE_TESTNET === 'true';

    if (!apiKey || !apiSecret) {
        throw new Error('Binance API Key or Secret API is missing. Please define VITE_BINANCE_API_KEY and VITE_BINANCE_API_SECRET in your .env file.');
    }

    const normalizedSymbol = normalizeBinanceSymbol(symbol);
    if (!normalizedSymbol) {
        throw new Error('Invalid trading symbol provided.');
    }

    // Determine correct endpoint base using the proxies configured in vite.config.js
    let proxyBase = '';
    if (isFutures) {
        proxyBase = useTestnet ? '/fapi-binance-testnet/fapi/v1/order' : '/fapi-binance/fapi/v1/order';
    } else {
        proxyBase = useTestnet ? '/api-binance-testnet/api/v3/order' : '/api-binance/api/v3/order';
    }

    const timestamp = Date.now();

    // Construct request parameters as standard URL parameters
    const params = new URLSearchParams();
    params.append('symbol', normalizedSymbol);
    params.append('side', side.toUpperCase()); // BUY or SELL
    params.append('type', type.toUpperCase()); // LIMIT or MARKET
    params.append('quantity', String(quantity));
    
    if (type.toUpperCase() === 'LIMIT') {
        params.append('price', String(price));
        params.append('timeInForce', 'GTC'); // Good 'Til Cancelled
    }
    
    params.append('timestamp', String(timestamp));
    params.append('recvWindow', '5000'); // Standard receive window in ms

    const queryString = params.toString();
    
    // Sign the query string
    let signature;
    try {
        signature = await hmacSHA256(apiSecret, queryString);
    } catch (err) {
        console.error('Cryptographic signature failed:', err);
        throw new Error(`Failed to generate Binance signature: ${err.message}`);
    }

    // Append signature to query string
    const finalUrl = `${proxyBase}?${queryString}&signature=${signature}`;

    try {
        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Binance API returned an error:', data);
            // Binance typically returns standard errors like { code: -2010, msg: "Account has insufficient balance..." }
            throw new Error(data.msg || `Binance API error ${response.status}: ${JSON.stringify(data)}`);
        }

        console.log('Binance Order Successfully Placed:', data);
        return data;
    } catch (error) {
        console.error('Binance order execution failed:', error);
        throw error;
    }
};
