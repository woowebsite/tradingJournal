
/**
 * Calculates the Net PnL (Cashflow) for a single trade based on its details.
 * Cashflow = Sum(Sell Value) - Sum(Buy Value)
 * @param {Object} trade - The trade object with trade_details
 * @returns {number} Net PnL
 */
export const calculateTradePnL = (trade, currentPrice = null) => {
    const { cashflow, netVolume } = (trade.trade_details || []).reduce((acc, d) => {
        const price = parseFloat(d.price) || 0;
        const volume = parseFloat(d.volume) || 0;
        const val = price * volume;

        if (d.type === 'Sell') {
            acc.cashflow += val;
            acc.netVolume -= volume; // Selling reduces inventory
        } else {
            acc.cashflow -= val;
            acc.netVolume += volume; // Buying adds inventory
        }
        return acc;
    }, { cashflow: 0, netVolume: 0 });

    if (currentPrice !== null && currentPrice !== undefined && currentPrice !== '') {
        const cp = parseFloat(currentPrice);
        // Only calculate Unrealized if price is valid number
        if (!isNaN(cp)) {
            // PnL = Realized Cashflow + Market Value of Remaining Inventory
            return cashflow + (netVolume * cp);
        }
    }

    return cashflow;
};

/**
 * Calculates the Total Open Volume for a symbol across multiple trades.
 * Logic:
 * - Long Trade: Sum of Buy volumes
 * - Short Trade: Sum of Sell volumes
 * @param {Array} trades - List of all trades
 * @param {Object} symbol - The symbol object (id, documentId)
 * @returns {number} Total Volume
 */
export const calculateSymbolOpenVolume = (trades, symbol) => {
    if (!trades || !symbol) return 0;

    const symTrades = trades.filter(t =>
        (t.symbol?.id === symbol.id || t.symbol?.documentId === symbol.documentId) &&
        t.trade_status === 'Open'
    );

    return symTrades.reduce((acc, trade) => {
        const tVol = (trade.trade_details || []).reduce((a, d) => {
            const dVol = parseFloat(d.volume) || 0;
            if (trade.type === 'Long') {
                return d.type === 'Buy' ? a + dVol : a;
            } else { // Short
                return d.type === 'Sell' ? a + dVol : a;
            }
        }, 0);
        return acc + tVol;
    }, 0);
};

/**
 * Calculates the Total PnL for a symbol across all Open trades.
 * @param {Array} trades - List of all trades
 * @param {Object} symbol - The symbol object
 * @returns {number} Total PnL
 */
export const calculateSymbolOpenPnL = (trades, symbol) => {
    if (!trades || !symbol) return 0;

    const symTrades = trades.filter(t =>
        (t.symbol?.id === symbol.id || t.symbol?.documentId === symbol.documentId) &&
        t.trade_status === 'Open'
    );

    return symTrades.reduce((acc, trade) => acc + calculateTradePnL(trade), 0);
};
