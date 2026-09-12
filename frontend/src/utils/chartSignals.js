import { formatNumber } from './formatNumber';

/**
 * Format numeric prices for display in tooltips and tables.
 * Displays up to 6 decimals for values < 1, and 2 decimals for values >= 1.
 */
export const formatPriceDisplay = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    if (Math.abs(num) < 1 && num !== 0) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

/**
 * Determine standard marker style (colors, shapes, positions, short labels)
 * @param {Object} params
 * @param {string} params.type - 'entry' | 'takeprofit' | 'stoploss' | 'exit' | 'entry_long' | 'entry_short' | etc.
 * @param {string} params.posType - 'Long' | 'Short'
 * @param {string} params.action - 'Buy' | 'Sell' | 'Close' | 'Entry' | 'Exit'
 * @returns {Object} { markerType, shortLabel, color, shape, position }
 */
export const getSignalMarkerConfig = ({ type = '', posType = '', action = '' } = {}) => {
    const rawType = String(type || '').toLowerCase();
    const rawPos = String(posType || '').toLowerCase();
    const rawAction = String(action || '').toLowerCase();

    const isEntry = rawAction === 'entry' || rawAction.includes('buy') || rawAction.includes('sell') || rawType.startsWith('entry') || rawType === 'buy' || rawType === 'sell';
    const isTP = rawType === 'takeprofit' || rawType.includes('take') || rawType.includes('tp') || rawAction.includes('tp') || rawAction.includes('takeprofit');
    const isSL = rawType === 'stoploss' || rawType.includes('stoploss') || rawType === 'sl' || rawAction === 'sl' || rawAction === 'stoploss';
    const isExit = !isEntry && (rawType.includes('exit') || rawType.includes('close') || rawAction.includes('exit') || rawAction.includes('close'));

    const isShort = rawPos.includes('short') || rawType.includes('short') || rawAction.includes('sell');

    if (isTP) {
        return {
            markerType: 'takeprofit',
            shortLabel: 'TP',
            color: '#3b82f6', // Blue
            shape: isShort ? 'arrowUp' : 'arrowDown',
            position: isShort ? 'belowBar' : 'aboveBar'
        };
    }

    if (isSL) {
        return {
            markerType: 'stoploss',
            shortLabel: 'SL',
            color: '#ef4444', // Red
            shape: 'circle',
            position: isShort ? 'aboveBar' : 'belowBar'
        };
    }

    if (isExit) {
        return {
            markerType: 'exit',
            shortLabel: 'Exit',
            color: '#fb923c', // Orange
            shape: isShort ? 'arrowUp' : 'arrowDown',
            position: isShort ? 'belowBar' : 'aboveBar'
        };
    }

    if (isShort) {
        return {
            markerType: 'entry',
            shortLabel: 'Short',
            color: '#ef4444', // Red
            shape: 'arrowDown',
            position: 'aboveBar'
        };
    }

    return {
        markerType: 'entry',
        shortLabel: 'Long',
        color: '#10b981', // Green
        shape: 'arrowUp',
        position: 'belowBar'
    };
};

/**
 * Standardize Python Strategy scan signals for TradingViewChart
 * @param {Array} rawSignals - Signals array from python strategy scan
 * @returns {Array} Standardized chart signal objects
 */
export const buildPythonChartSignals = (rawSignals = []) => {
    if (!Array.isArray(rawSignals) || rawSignals.length === 0) return [];

    return rawSignals.map(sig => {
        const isShort = sig.type === 'Short' || sig.pos_type === 'Short' || sig.type === 'entry_short';
        const posType = sig.pos_type || (isShort ? 'Short' : 'Long');

        const cfg = getSignalMarkerConfig({
            type: sig.type || sig.rule?.Type,
            posType,
            action: sig.action
        });

        const isEntry = cfg.markerType === 'entry';
        const execPrice = sig.price ?? sig.entry ?? sig.exit_price;
        const entryPrice = sig.entry !== undefined ? sig.entry : (isEntry ? sig.price : null);
        const exitPrice = !isEntry ? (sig.price || sig.exit_price) : null;
        const slPrice = sig.stop_loss !== undefined ? sig.stop_loss : sig.sl;
        const tpPrice = sig.take_profit !== undefined ? sig.take_profit : sig.tp;
        const pnl = sig.pnl_percent;
        const pnlAmt = sig.pnl_amount;

        const defaultName = isEntry
            ? `${posType === 'Long' ? 'Long Entry' : 'Short Entry'} @ ${formatNumber(execPrice)}`
            : cfg.markerType === 'takeprofit'
                ? `Take Profit @ ${formatNumber(execPrice)}`
                : cfg.markerType === 'stoploss'
                    ? `Stop Loss @ ${formatNumber(execPrice)}`
                    : `Exit @ ${formatNumber(execPrice)}`;

        const signalName = sig.rule?.Name || defaultName;

        return {
            date: sig.date,
            time: sig.time,
            type: cfg.markerType,
            posType,
            action: sig.action,
            price: execPrice,
            entry: entryPrice,
            exitPrice,
            stopLoss: slPrice,
            takeProfit: tpPrice,
            pnlPercent: pnl,
            pnlAmount: pnlAmt,
            color: sig.color || cfg.color,
            shape: sig.shape || cfg.shape,
            position: sig.position || cfg.position,
            text: cfg.shortLabel, // On chart: ONLY "Long", "Short", "TP", "SL", "Exit"
            name: signalName,
            rule: {
                Name: signalName,
                Type: cfg.markerType,
                signalText: cfg.shortLabel,
                price: execPrice,
                entry: entryPrice,
                exitPrice,
                stopLoss: slPrice,
                takeProfit: tpPrice,
                pnlPercent: pnl,
                pnlAmount: pnlAmt,
                posType
            },
            rules: [
                {
                    Name: signalName,
                    Type: cfg.markerType,
                    signalText: cfg.shortLabel,
                    price: execPrice,
                    entry: entryPrice,
                    exitPrice,
                    stopLoss: slPrice,
                    takeProfit: tpPrice,
                    pnlPercent: pnl,
                    pnlAmount: pnlAmt,
                    posType
                }
            ]
        };
    });
};

/**
 * Standardize executed trades and trade details from Strapi for TradeStation.jsx
 * @param {Array} symbolTrades - Trades list for the active symbol
 * @returns {Array} Standardized chart signal objects
 */
export const buildExecutedTradeSignals = (symbolTrades = []) => {
    if (!Array.isArray(symbolTrades) || symbolTrades.length === 0) return [];
    const signalsList = [];

    symbolTrades.forEach(trade => {
        const tradeType = trade.type || 'Long';
        const isLong = String(tradeType).toLowerCase() === 'long';
        const posType = isLong ? 'Long' : 'Short';
        const details = trade.trade_details || [];

        if (details.length > 0) {
            details.forEach(detail => {
                const signalKind = detail.signal || 'Entry';
                const detailType = detail.type || (isLong ? 'Buy' : 'Sell');

                const cfg = getSignalMarkerConfig({
                    type: signalKind,
                    posType,
                    action: detailType
                });

                const execPrice = detail.price || trade.price;
                const entryPrice = trade.price || (cfg.markerType === 'entry' ? detail.price : null);
                const slPrice = trade.stop_loss || trade.stopLoss;
                const tpPrice = trade.take_profit || trade.takeProfit;
                const pnlPct = trade.pnl_percent;
                const pnlAmt = trade.pnl_amount;

                const defaultName = `${cfg.shortLabel} @ ${formatNumber(execPrice || '')}`;
                const signalName = defaultName;

                signalsList.push({
                    id: `detail-${detail.documentId || detail.id || Math.random()}`,
                    date: detail.date || trade.date,
                    time: detail.date || trade.date,
                    type: cfg.markerType,
                    posType,
                    action: detail.signal || (isLong ? 'Long Entry' : 'Short Entry'),
                    color: cfg.color,
                    shape: cfg.shape,
                    position: cfg.position,
                    text: cfg.shortLabel, // On chart: ONLY "Long", "Short", "TP", "SL", "Exit"
                    price: execPrice,
                    entry: entryPrice,
                    exitPrice: cfg.markerType !== 'entry' ? execPrice : null,
                    stopLoss: slPrice,
                    takeProfit: tpPrice,
                    pnlPercent: pnlPct,
                    pnlAmount: pnlAmt,
                    volume: detail.volume,
                    note: detail.note || trade.note,
                    tradeId: trade.documentId || trade.id,
                    status: trade.trade_status,
                    name: signalName,
                    rule: {
                        Name: signalName,
                        Type: cfg.markerType,
                        signalText: cfg.shortLabel,
                        price: execPrice,
                        entry: entryPrice,
                        exitPrice: cfg.markerType !== 'entry' ? execPrice : null,
                        stopLoss: slPrice,
                        takeProfit: tpPrice,
                        pnlPercent: pnlPct,
                        pnlAmount: pnlAmt,
                        posType
                    },
                    rules: [
                        {
                            Name: signalName,
                            Type: cfg.markerType,
                            signalText: cfg.shortLabel,
                            price: execPrice,
                            entry: entryPrice,
                            exitPrice: cfg.markerType !== 'entry' ? execPrice : null,
                            stopLoss: slPrice,
                            takeProfit: tpPrice,
                            pnlPercent: pnlPct,
                            pnlAmount: pnlAmt,
                            posType
                        }
                    ]
                });
            });
        } else if (trade.date) {
            const cfg = getSignalMarkerConfig({
                type: 'entry',
                posType,
                action: isLong ? 'Buy' : 'Sell'
            });

            const execPrice = trade.price;
            const slPrice = trade.stop_loss || trade.stopLoss;
            const tpPrice = trade.take_profit || trade.takeProfit;
            const signalName = `${posType} (${trade.trade_status || 'Open'}) @ ${formatNumber(execPrice || '')}`;

            signalsList.push({
                id: `trade-${trade.documentId || trade.id}`,
                date: trade.date,
                time: trade.date,
                type: cfg.markerType,
                posType,
                action: posType,
                color: cfg.color,
                shape: cfg.shape,
                position: cfg.position,
                text: cfg.shortLabel, // On chart: ONLY "Long", "Short"
                price: execPrice,
                entry: execPrice,
                exitPrice: null,
                stopLoss: slPrice,
                takeProfit: tpPrice,
                pnlPercent: trade.pnl_percent,
                pnlAmount: trade.pnl_amount,
                note: trade.note,
                tradeId: trade.documentId || trade.id,
                status: trade.trade_status,
                name: signalName,
                rule: {
                    Name: signalName,
                    Type: cfg.markerType,
                    signalText: cfg.shortLabel,
                    price: execPrice,
                    entry: execPrice,
                    stopLoss: slPrice,
                    takeProfit: tpPrice,
                    posType
                },
                rules: [
                    {
                        Name: signalName,
                        Type: cfg.markerType,
                        signalText: cfg.shortLabel,
                        price: execPrice,
                        entry: execPrice,
                        stopLoss: slPrice,
                        takeProfit: tpPrice,
                        posType
                    }
                ]
            });
        }
    });

    return signalsList.sort((a, b) => new Date(b.date) - new Date(a.date));
};

/**
 * Standardize single trade details for TradeDetailModal.jsx
 * @param {Object} trade - Trade object with trade_details
 * @param {Object} selectedAccount - Optional account context
 * @returns {Array} Standardized chart signal objects
 */
export const buildTradeDetailChartSignals = (trade, selectedAccount = null) => {
    if (!trade || !Array.isArray(trade.trade_details)) return [];

    const isLong = String(trade.type || 'Long').toLowerCase() === 'long';
    const posType = isLong ? 'Long' : 'Short';

    return trade.trade_details
        .filter(detail => detail.date && detail.signal)
        .map(detail => {
            const cfg = getSignalMarkerConfig({
                type: detail.signal,
                posType,
                action: detail.type || (isLong ? 'Buy' : 'Sell')
            });

            const execPrice = detail.price || trade.price;
            const entryPrice = trade.price || (cfg.markerType === 'entry' ? detail.price : null);
            const slPrice = trade.stop_loss || trade.stopLoss;
            const tpPrice = trade.take_profit || trade.takeProfit;
            const formattedPrice = execPrice ? formatNumber(execPrice, selectedAccount?.moneyFormat || '#,###.##') : '';
            const signalName = `${detail.signal} @ ${formattedPrice}`;

            return {
                date: detail.date,
                time: detail.date,
                type: cfg.markerType,
                posType,
                action: detail.signal,
                price: execPrice,
                entry: entryPrice,
                exitPrice: cfg.markerType !== 'entry' ? execPrice : null,
                stopLoss: slPrice,
                takeProfit: tpPrice,
                pnlPercent: trade.pnl_percent,
                pnlAmount: trade.pnl_amount,
                volume: detail.volume,
                color: cfg.color,
                shape: cfg.shape,
                position: cfg.position,
                text: cfg.shortLabel, // On chart: ONLY "Long", "Short", "TP", "SL", "Exit"
                name: signalName,
                rules: [
                    {
                        documentId: `trade-detail-${detail.documentId || detail.id || detail.date}`,
                        Name: signalName,
                        Type: cfg.markerType,
                        signalText: cfg.shortLabel,
                        price: execPrice,
                        entry: entryPrice,
                        stopLoss: slPrice,
                        takeProfit: tpPrice,
                        posType
                    }
                ]
            };
        });
};
