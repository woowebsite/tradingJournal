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
 * Formats quantity to comply with Binance LOT_SIZE and MIN_NOTIONAL filters
 */
export const formatBinanceQuantity = (qty, price = 0, isFutures = true) => {
    let num = Number(qty);
    if (isNaN(num) || num <= 0) num = 0.001;

    let formatted;
    if (price >= 1000) {
        formatted = Math.floor(num * 1000) / 1000;
    } else if (price >= 100) {
        formatted = Math.floor(num * 100) / 100;
    } else if (price >= 1) {
        formatted = Math.floor(num * 100) / 100;
    } else {
        formatted = Math.floor(num);
    }

    if (formatted <= 0) {
        if (price >= 1000) formatted = 0.001;
        else if (price >= 100) formatted = 0.01;
        else if (price >= 1) formatted = 0.1;
        else formatted = 1;
    }

    // Ensure minimum notional value (5.5 USDT for futures, 10 USDT for spot)
    const minNotional = isFutures ? 5.5 : 10.0;
    const notional = formatted * (price || 1);
    if (price > 0 && notional < minNotional) {
        const needed = (minNotional * 1.05) / price;
        if (price >= 1000) formatted = Math.ceil(needed * 1000) / 1000;
        else if (price >= 100) formatted = Math.ceil(needed * 100) / 100;
        else if (price >= 1) formatted = Math.ceil(needed * 10) / 10;
        else formatted = Math.ceil(needed);
    }

    return formatted;
};

/**
 * Parses Binance API error code and returns user-friendly diagnostic message
 */
function parseBinanceError(data) {
    if (!data) return 'Lỗi không xác định từ Binance API.';
    const code = data.code;
    const msg = data.msg || data.message || JSON.stringify(data);

    switch (code) {
        case -2015:
            return `[Mã -2015]: API Key không hợp lệ, bị giới hạn IP hoặc tài khoản CHƯA BẬT QUYỀN 'Enable Futures' trên Binance API Management.`;
        case -2019:
        case -2010:
            return `[Mã -2019 / -2010]: Số dư khả dụng (USDT) trong ví Futures không đủ để mở vị thế. Vui lòng nạp hoặc chuyển USDT vào ví Futures.`;
        case -1021:
            return `[Mã -1021]: Lệch thời gian đồng hồ máy tính so với máy chủ Binance (Timestamp out of sync).`;
        case -1013:
        case -1111:
            return `[Mã -1013 / -1111]: Khối lượng đặt lệnh vi phạm bộ lọc LOT_SIZE hoặc MIN_NOTIONAL (${msg}).`;
        case -4061:
            return `[Mã -4061]: Chế độ Position Mode (Hedge Mode vs One-way Mode) không khớp với thiết lập tài khoản Binance.`;
        case -4164:
            return `[Mã -4164]: Giá trị lệnh tối thiểu (Notional) phải lớn hơn 5 USDT.`;
        default:
            return `[Lỗi Binance ${code ? `Mã ${code}` : ''}]: ${msg}`;
    }
}

/**
 * Places a Spot or Futures order on Binance via local Vite proxies.
 * Computes HMAC-SHA256 signature locally in browser - NEVER exposes API Secret.
 */
export const executeBinanceOrder = async ({
    symbol,
    side,
    type = 'MARKET',
    quantity,
    price,
    timeInForce = 'GTC',
    isFutures = false,
    positionSide = null,
    reduceOnly = false,
    isClose = false
}) => {
    const apiKey = import.meta.env.VITE_BINANCE_API_KEY;
    const apiSecret = import.meta.env.VITE_BINANCE_API_SECRET;
    const rawTestnet = import.meta.env.VITE_BINANCE_USE_TESTNET;
    const useTestnet = String(rawTestnet || '').split('#')[0].trim().toLowerCase() === 'true';

    if (!apiKey || !apiSecret) {
        throw new Error('Binance API Key hoặc Secret Key chưa được cấu hình. Vui lòng định nghĩa VITE_BINANCE_API_KEY và VITE_BINANCE_API_SECRET trong file frontend/.env');
    }

    const normalizedSymbol = normalizeBinanceSymbol(symbol);
    if (!normalizedSymbol) {
        throw new Error('Invalid trading symbol provided.');
    }

    const numPrice = price ? Number(price) : 0;
    const formattedQty = formatBinanceQuantity(quantity, numPrice, isFutures);

    // Determine correct endpoint base using the proxies configured in vite.config.js
    let proxyBase = '';
    if (isFutures) {
        proxyBase = useTestnet ? '/fapi-binance-testnet/fapi/v1/order' : '/fapi-binance/fapi/v1/order';
    } else {
        proxyBase = useTestnet ? '/api-binance-testnet/api/v3/order' : '/api-binance/api/v3/order';
    }

    const sendOrderAttempt = async (targetPositionSide = positionSide) => {
        const timestamp = Date.now();
        const params = new URLSearchParams();
        params.append('symbol', normalizedSymbol);
        params.append('side', side.toUpperCase()); // BUY or SELL
        params.append('type', type.toUpperCase()); // LIMIT or MARKET
        params.append('quantity', String(formattedQty));

        if (type.toUpperCase() === 'LIMIT' && price) {
            params.append('price', String(price));
            params.append('timeInForce', timeInForce);
        }

        if (targetPositionSide && targetPositionSide !== 'BOTH') {
            params.append('positionSide', targetPositionSide.toUpperCase());
        } else if (targetPositionSide === 'BOTH') {
            params.append('positionSide', 'BOTH');
        }

        if (reduceOnly && isFutures && (!targetPositionSide || targetPositionSide === 'BOTH')) {
            params.append('reduceOnly', 'true');
        }

        params.append('timestamp', String(timestamp));
        params.append('recvWindow', '60000'); // 60s receive window to prevent clock drift

        const queryString = params.toString();
        const signature = await hmacSHA256(apiSecret, queryString);
        const finalUrl = `${proxyBase}?${queryString}&signature=${signature}`;

        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': apiKey
            }
        });

        const data = await response.json();
        return { response, data };
    };

    try {
        let { response, data } = await sendOrderAttempt();

        // If error is -4061 (Position side mismatch on Futures Hedge/One-way Mode), retry with appropriate mode
        if (!response.ok && data?.code === -4061 && isFutures) {
            let retryPosSide = null;
            if (!positionSide || positionSide === 'BOTH') {
                // Was sent for One-Way mode, but account is in Hedge Mode
                if (isClose) {
                    retryPosSide = side.toUpperCase() === 'SELL' ? 'LONG' : 'SHORT';
                } else {
                    retryPosSide = side.toUpperCase() === 'BUY' ? 'LONG' : 'SHORT';
                }
            } else {
                // Was sent with positionSide, but account is in One-Way Mode
                retryPosSide = 'BOTH';
            }
            console.log(`[Binance Execution] Retrying with positionSide: ${retryPosSide}`);
            const retryRes = await sendOrderAttempt(retryPosSide);
            response = retryRes.response;
            data = retryRes.data;
        }

        if (!response.ok) {
            console.error('Binance API returned an error:', data);
            const friendlyErr = parseBinanceError(data);
            throw new Error(friendlyErr);
        }

        console.log('Binance Order Successfully Placed:', data);
        return data;
    } catch (error) {
        console.error('Binance order execution failed:', error);
        throw error;
    }
};
