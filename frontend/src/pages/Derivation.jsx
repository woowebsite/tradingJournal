import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchStrategies } from '../features/strategySlice';
import { fetchRules } from '../features/ruleSlice';
import { getTCBSToken, getTCBSDerivatives, placeTCBSConditionOrder } from '../services/tcbsJournal';
import RealtimeChart from '../components/RealtimeChart';
import { RefreshCw, TrendingDown, TrendingUp, AlertCircle, Key } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import OtpModal from '../components/otpModal';
import IntradayBSAPanel from '../components/IntradayBSAPanel';
import IntradayBidAskPanel from '../components/IntradayBidAskPanel';
import MarketPressureGauge from '../components/MarketPressureGauge';
import IntradayAIDecisionBox from '../components/IntradayAIDecisionBox';
import IntradayCumDeltaMiniChart from '../components/IntradayCumDeltaMiniChart';
import IntradayBidAskRatioMiniChart from '../components/IntradayBidAskRatioMiniChart';

const Derivation = () => {
    const dispatch = useDispatch();
    const { items: strategies } = useSelector(state => state.strategies);
    const { items: rules } = useSelector(state => state.rules);
    const { selectedAccount } = useAccount();

    const [entryPrice, setEntryPrice] = useState('');
    const [strategy, setStrategy] = useState('');
    const [stoploss, setStoploss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');
    const [volume, setVolume] = useState(1);

    // Live Intraday tables data for AI decision making
    const [bsaData, setBsaData] = useState([]);
    const [bidAskData, setBidAskData] = useState([]);

    // UI states
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [derivativeData, setDerivativeData] = useState(null);
    const [jwtToken, setJwtToken] = useState(() => sessionStorage.getItem('tcbsJwtToken') || null);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [wsStatus, setWsStatus] = useState('Connecting...');
    const [wsTick, setWsTick] = useState(null);

    // Order Confirmation Modal states
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmData, setConfirmData] = useState(null);

    const cusCode = import.meta.env.VITE_TCBS_CUSTODYCODE;


    const activeSymbol = (() => {
        if (!derivativeData) return null;
        const info = Array.isArray(derivativeData) && derivativeData.length > 0
            ? derivativeData[0]
            : typeof derivativeData === 'object' ? derivativeData : null;
        return info ? (info.symbol || info.sec) : null;
    })();

    // Helper to ensure consistent date matching
    const formatDate = (dateInput) => {
        if (!dateInput) return '';
        const str = String(dateInput);
        if (str.length === 8) {
            return `${str.slice(0, 4)}/${str.slice(4, 6)}/${str.slice(6, 8)}`;
        }
        return str; // fallback
    };

    useEffect(() => {
        dispatch(fetchStrategies());
        dispatch(fetchRules());
    }, [dispatch]);

    // Derive full rule objects directly from the selected strategy for Derivatives
    const strategyRules = React.useMemo(() => {
        if (!strategy || !strategies || strategies.length === 0) return [];
        const selectedStrat = strategies.find(s => (s.id || s.documentId)?.toString() === strategy.toString());
        if (!selectedStrat) return [];

        // Build lookup map from Redux rules items to ensure full rule details exist
        const ruleMap = new Map();
        (rules || []).forEach(r => {
            if (r.id) ruleMap.set(r.id.toString(), r);
            if (r.documentId) ruleMap.set(r.documentId.toString(), r);
        });

        const ruleCategories = [
            { field: 'entryRules', defaultType: 'entry' },
            { field: 'takeProfitRules', defaultType: 'takeprofit' },
            { field: 'stoplossRules', defaultType: 'stoploss' },
            { field: 'exitRules', defaultType: 'exit' },
            { field: 'rules', defaultType: 'entry' }
        ];

        const extracted = [];
        const seenIds = new Set();

        ruleCategories.forEach(({ field, defaultType }) => {
            const list = selectedStrat[field];
            if (!Array.isArray(list)) return;

            list.forEach(item => {
                const id = (item?.documentId || item?.id || item)?.toString();
                if (!id || seenIds.has(id)) return;
                seenIds.add(id);

                const baseRule = ruleMap.get(id) || (typeof item === 'object' ? item : null);
                if (!baseRule) return;

                let parsedRule = baseRule.Rule || baseRule.rule;
                if (typeof parsedRule === 'string') {
                    try {
                        parsedRule = JSON.parse(parsedRule);
                    } catch (e) {
                        console.warn('Failed to parse rule JSON:', e);
                    }
                }

                if (parsedRule) {
                    extracted.push({
                        ...baseRule,
                        Rule: parsedRule,
                        Type: (baseRule.Type || baseRule.type || defaultType).toLowerCase(),
                        Name: baseRule.Name || baseRule.name || 'Signal'
                    });
                }
            });
        });

        return extracted;
    }, [strategy, strategies, rules]);

    useEffect(() => {
        if (jwtToken && !derivativeData) {
            handleFetchPrice();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jwtToken]);

    const handleFetchPrice = async () => {
        if (!jwtToken) {
            setShowOtpModal(true);
            return;
        }

        setLoadingPrice(true);
        setError('');
        try {
            const data = await getTCBSDerivatives(jwtToken);
            setDerivativeData(data);

            // Assume the API returns an array of derivatives or a single object.
            // If it's an array, we find VN30F1M or similar. For now, we just try to get the 'price' or 'matchPrice'.
            // Often derivatives list has fields like 'matchPrice' or 'lastPrice'
            let priceToSet = '';
            const activeDeriv = (Array.isArray(data) && data.length > 0) ? data[0] : (data && typeof data === 'object') ? data : null;

            if (activeDeriv) {
                priceToSet = activeDeriv.matchPrice || activeDeriv.price || activeDeriv.lastPrice ||
                    activeDeriv.bidPrice01 || activeDeriv.bestBidPrice || activeDeriv.bidPrice1 ||
                    activeDeriv.offerPrice01 || activeDeriv.bestOfferPrice || activeDeriv.askPrice1 || '';
            }

            if (priceToSet) setEntryPrice(priceToSet.toString());
            else if (data) setEntryPrice(JSON.stringify(data)); // fallback so user sees what it is

        } catch (err) {
            setError(err.message || "Failed to fetch derivatives price");
            if (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('403')) {
                setJwtToken(null);
                sessionStorage.removeItem('tcbsJwtToken');
                setShowOtpModal(true);
            }
        } finally {
            setLoadingPrice(false);
        }
    };

    // WebSocket Logic moved from RealtimeChart
    useEffect(() => {
        if (!activeSymbol || !jwtToken) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/openapi-tcbs/ws/thesis/v1/stream/derivative`;
        let ws;

        const connectWebSocket = () => {
            console.log('Derivation WS Attempting connection to:', wsUrl);
            setWsStatus('Connecting...');
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setWsStatus('Authenticating...');
                const base64Jwt = btoa(jwtToken);
                const authMsg = `d|a|||${base64Jwt}`;
                ws.send(authMsg);
            };

            ws.onmessage = (event) => {
                if (typeof event.data === 'string' && event.data.startsWith('d|0|')) {
                    try {
                        const payload = JSON.parse(event.data.substring(4));
                        if (payload.success) {
                            setWsStatus('Connected');
                            ws.send(`d|s|tk|bp+bi+tm+mp+op+fe |${activeSymbol}`);
                        } else {
                            setWsStatus('Auth Failed');
                            if (payload.error?.message?.includes('Invalid')) setShowOtpModal(true);
                        }
                    } catch (e) { console.error('WS Auth Error:', e); }
                    return;
                }

                try {
                    let data;
                    if (typeof event.data === 'string') {
                        const firstBrace = event.data.indexOf('{');
                        const firstBracket = event.data.indexOf('[');
                        let startIdx = -1;
                        if (firstBrace !== -1 && firstBracket !== -1) startIdx = Math.min(firstBrace, firstBracket);
                        else if (firstBrace !== -1) startIdx = firstBrace;
                        else if (firstBracket !== -1) startIdx = firstBracket;

                        if (startIdx !== -1) data = JSON.parse(event.data.substring(startIdx));
                        else return;
                    } else return;

                    const items = Array.isArray(data) ? data : [data];
                    items.forEach(item => {
                        // Update UI Header (Bid/Offer/MatchPrice)
                        setDerivativeData(prev => {
                            if (!prev) return prev;
                            const current = Array.isArray(prev) ? prev[0] : prev;
                            // Only update if it refers to the same symbol
                            if ((current.symbol || current.sec) !== (item.symbol || item.sec || activeSymbol)) return prev;

                            const updated = {
                                ...current,
                                matchPrice: item.mp || item.matchPrice || current.matchPrice,
                                bidPrice01: item.bp1 || item.bidPrice01 || current.bidPrice01,
                                bidQtty01: item.bi1 || item.bidQtty01 || current.bidQtty01,
                                offerPrice01: item.op1 || item.offerPrice01 || current.offerPrice01,
                                offerQtty01: item.fe1 || item.offerQtty01 || current.offerQtty01
                            };
                            return Array.isArray(prev) ? [updated] : updated;
                        });

                        // Pass tick to RealtimeChart
                        const tickPrice = item.mp || item.matchPrice || item.price ||
                            item.bp1 || item.bidPrice01 ||
                            item.op1 || item.offerPrice01 || '';

                        if (tickPrice) {
                            setWsTick(item);
                            setEntryPrice(tickPrice.toString());
                        }
                    });
                } catch (e) { console.error('Derivation WS Data Error:', e); }
            };

            ws.onclose = () => {
                setWsStatus('Disconnected. Reconnecting...');
                setTimeout(connectWebSocket, 5000);
            };

            ws.onerror = () => setWsStatus('Error connecting WS');
        };

        connectWebSocket();

        return () => { if (ws) ws.close(); };
    }, [activeSymbol, jwtToken]);

    const handlePlaceOrder = (side) => {
        const price = Number(entryPrice);
        const slOffset = Number(stoploss) || 0;
        const tpOffset = Number(takeProfit) || 0;

        const calculatedSL = side === 'Long' ? (price - slOffset) : (price + slOffset);
        const calculatedTP = side === 'Long' ? (price + tpOffset) : (price - tpOffset);

        setConfirmData({
            side,
            entryPrice: price,
            volume,
            stoploss: calculatedSL,
            takeprofit: calculatedTP,
            symbol: activeSymbol
        });
        setShowConfirmModal(true);
    };

    const handleConfirmOrder = async () => {
        if (!jwtToken || !confirmData) return;

        setSubmitting(true);
        setError('');
        setSuccessMessage('');
        setShowConfirmModal(false);

        try {
            // Mapping to the specific TCBS JSON schema provided by user
            //            {
            //     "subAccountId": "105C078644A",
            //     "accountId": "105C078644",
            //     "side": "B",
            //     "symbol": "41I1G4000",
            //     "refId": "H.0786441774511576086",
            //     "price": 1793,
            //     "volume": 1,
            //     "type": "string",
            //     "pin": "H",
            //     "cmd": "Web.newOrder",
            //     "condition": {
            //         "orderType": "SLP",
            //         "stopLossUnit": "3",
            //         "takeProfitUnit": "3"
            //     }
            // }
            const payload = {
                accountId: cusCode,
                subAccountId: cusCode + "A",
                side: confirmData.side === 'Long' ? 'B' : 'S',
                symbol: confirmData.symbol,
                refId: "H.0786441774498096311",
                price: parseFloat(confirmData.entryPrice),
                volume: parseInt(confirmData.volume),
                pin: "H",
                type: "string",
                cmd: "Web.newOrder",
                condition: {
                    orderType: "SLP",
                    stopLossUnit: stoploss,
                    takeProfitUnit: takeProfit
                }
            };

            const result = await placeTCBSConditionOrder(jwtToken, payload);
            setSuccessMessage(`Order placed successfully: ${JSON.stringify(result)}`);
        } catch (err) {
            setError(err.message || "Failed to place order");
            if (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('403')) {
                setJwtToken(null);
                sessionStorage.removeItem('tcbsJwtToken');
                setShowOtpModal(true);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col min-h-[calc(100vh-6rem)] gap-4 pb-12 w-full">
            {/* Top Row: Candle Chart (2/3) & Place Order + Market Pressure Gauge (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full items-stretch">
                {/* 2/3: Candle Chart Container */}
                <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col min-h-[720px] w-full">
                    <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/50 flex flex-wrap justify-between items-center shrink-0 gap-4">
                        <div className="flex items-center gap-3 shrink-0">
                            <h2 className="text-xl font-bold text-white">
                                {activeSymbol || 'Select a Symbol'}
                            </h2>
                            <span className="text-sm text-gray-400 border-l border-gray-700 pl-3">Derivative Intraday</span>
                            <button
                                onClick={handleFetchPrice}
                                disabled={loadingPrice}
                                className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-blue-400 disabled:opacity-50 transition shadow-sm ml-2 border border-gray-700"
                                title="Refresh Price"
                            >
                                <RefreshCw size={14} className={loadingPrice ? "animate-spin" : ""} />
                            </button>
                        </div>

                        {/* Realtime API Data Header */}
                        {derivativeData && (() => {
                            const info = Array.isArray(derivativeData) && derivativeData.length > 0
                                ? derivativeData[0]
                                : typeof derivativeData === 'object' ? derivativeData : null;

                            if (!info) return null;

                            return (
                                <div className="flex items-center gap-5 sm:gap-8 flex-wrap">
                                    {/* Price / Change */}
                                    <div className="flex flex-col text-right">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-0.5">Price</span>
                                        <div className="flex items-baseline gap-2 justify-end">
                                            <span className="font-bold text-white text-base">{info.matchPrice || info.price || info.lastPrice || '0'}</span>
                                            <span className={`text-xs font-medium ${Number(info.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {Number(info.change) > 0 ? '+' : ''}{Number(info.change || 0).toFixed(1)} ({Number(info.changePercent || 0).toFixed(2)}%)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="h-8 w-px bg-gray-700 hidden sm:block"></div>

                                    {/* Bid / Offer */}
                                    <div className="flex gap-4 sm:gap-6">
                                        <div className="flex flex-col w-20 sm:w-24">
                                            <span className="text-[10px] text-green-400 uppercase tracking-wider font-semibold mb-0.5">Best Bid</span>
                                            <div className="flex items-baseline gap-1.5 justify-start tabular-nums">
                                                <span className="font-bold text-white text-sm">{info.bidPrice01 || info.bestBidPrice || info.bidPrice1 || '0'}</span>
                                                <span className="text-[10px] text-gray-500">x{info.bidQtty01 || info.bestBidQtty || info.bidVol1 || '0'}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col w-20 sm:w-24">
                                            <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-0.5">Best Offer</span>
                                            <div className="flex items-baseline gap-1.5 justify-start tabular-nums">
                                                <span className="font-bold text-white text-sm">{info.offerPrice01 || info.bestOfferPrice || info.askPrice1 || '0'}</span>
                                                <span className="text-[10px] text-gray-500">x{info.offerQtty01 || info.bestOfferQtty || info.askVol1 || '0'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                    <div id="chartContainer" className="flex-1 min-h-0 flex flex-col relative w-full">
                        {/* Main Candlestick / Indicators Chart */}
                        <div className="flex-1 min-h-[350px] relative w-full">
                            {activeSymbol ? (
                                <RealtimeChart
                                    symbol={activeSymbol}
                                    jwtToken={jwtToken}
                                    setShowOtpModal={setShowOtpModal}
                                    strategyRules={strategyRules}
                                    wsTick={wsTick}
                                    wsStatus={wsStatus}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500 italic text-sm absolute inset-0">
                                    Chart will appear when symbol is loaded
                                </div>
                            )}
                        </div>

                        {/* 2 Sub-charts in 1 Row inside #chartContainer */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-900/90 border-t border-gray-700/80 shrink-0">
                            <IntradayCumDeltaMiniChart symbol={activeSymbol || '41I1G9000'} data={bsaData} />
                            <IntradayBidAskRatioMiniChart symbol={activeSymbol || '41I1G9000'} data={bidAskData} />
                        </div>
                    </div>
                </div>

                {/* 1/3: Place Order & Market Pressure Gauge Container */}
                <div className="lg:col-span-1 flex flex-col gap-4 min-h-[720px] w-full">
                    {/* Box ⚡ Đặt Lệnh Phái Sinh (Place Order) */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 shadow-lg flex flex-col gap-3 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                    ⚡ Đặt Lệnh Phái Sinh
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono font-bold">
                                    {activeSymbol || 'VN30F1M'}
                                </span>
                            </div>
                        </div>

                        {/* Inline alerts */}
                        {error && (
                            <div className="text-xs text-rose-400 flex items-center gap-1.5 font-medium bg-rose-950/40 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        {successMessage && (
                            <div className="text-xs text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">
                                {successMessage}
                            </div>
                        )}

                        {/* Form Controls */}
                        <div className="flex flex-col gap-2.5">
                            {/* Strategy Selector */}
                            <div>
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 block">
                                    Chiến Lược
                                </label>
                                <select
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={strategy}
                                    onChange={(e) => setStrategy(e.target.value)}
                                >
                                    <option value="">Chọn Chiến Lược (Strategy)...</option>
                                    {strategies.map((strat) => (
                                        <option key={strat.id || strat.documentId} value={strat.id || strat.documentId} className="bg-gray-900 text-white">
                                            {strat.name || strat.Name || 'Unnamed Strategy'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Entry Price & Volume */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 block">
                                        Giá Mở (Entry)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                                        placeholder="Giá Entry..."
                                        value={entryPrice}
                                        onChange={(e) => setEntryPrice(e.target.value)}
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 block">
                                        Khối Lượng
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                                        placeholder="KL (1)"
                                        value={volume}
                                        onChange={(e) => setVolume(e.target.value)}
                                        min="1"
                                    />
                                </div>
                            </div>

                            {/* Stoploss & Take Profit */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 mb-1 block">
                                        Cắt Lỗ (SL)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-rose-300 placeholder-gray-500 focus:ring-1 focus:ring-rose-500 outline-none font-mono"
                                        placeholder="Giá SL..."
                                        value={stoploss}
                                        onChange={(e) => setStoploss(e.target.value)}
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-1 block">
                                        Chốt Lời (TP)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-emerald-300 placeholder-gray-500 focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                                        placeholder="Giá TP..."
                                        value={takeProfit}
                                        onChange={(e) => setTakeProfit(e.target.value)}
                                        step="0.1"
                                    />
                                </div>
                            </div>

                            {/* Action Buttons: LONG / SHORT */}
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <button
                                    type="button"
                                    onClick={() => handlePlaceOrder('Long')}
                                    disabled={submitting || !strategy || !entryPrice}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-sm"
                                >
                                    <TrendingUp size={14} />
                                    <span>{submitting ? 'Đang gửi...' : 'LONG'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePlaceOrder('Short')}
                                    disabled={submitting || !strategy || !entryPrice}
                                    className="w-full py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-sm"
                                >
                                    <TrendingDown size={14} />
                                    <span>{submitting ? 'Đang gửi...' : 'SHORT'}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Lực Cung Cầu Phái Sinh (Market Pressure Gauge) */}
                    <div className="flex-1 min-h-[360px] w-full">
                        <MarketPressureGauge defaultTicker="41I1G9000" className="h-full w-full" />
                    </div>
                </div>
            </div>

            {/* Intraday BSA Panel & Intraday Bid-Ask Panel (Same Row) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 w-full">
                <IntradayBSAPanel
                    defaultTicker="41I1G9000"
                    className="min-h-[650px] w-full"
                    onDataChange={setBsaData}
                />
                <IntradayBidAskPanel
                    defaultTicker="41I1G9000"
                    className="min-h-[650px] w-full"
                    onDataChange={setBidAskData}
                />
            </div>

            {/* AI Assistant Decision Box (Reads data from both BSA & Bid/Ask tables) */}
            <IntradayAIDecisionBox
                bsaData={bsaData}
                bidAskData={bidAskData}
                ticker={activeSymbol || '41I1G9000'}
                className="w-full"
            />

            <OtpModal
                isOpen={showOtpModal}
                allowClose={!!jwtToken}
                onClose={() => setShowOtpModal(false)}
                onSuccess={(tokenStr) => {
                    setJwtToken(tokenStr);
                    sessionStorage.setItem('tcbsJwtToken', tokenStr);
                    setShowOtpModal(false);
                }}
            />

            {/* Order Confirmation Modal */}
            {showConfirmModal && confirmData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                Confirm {confirmData.side} Order
                            </h3>
                            <p className="text-gray-400 text-sm mb-6">Please review the details below before submitting to TCBS.</p>

                            <div className="space-y-4 bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
                                <div className="flex justify-between items-center py-1 border-b border-gray-800">
                                    <span className="text-gray-400 text-sm">Symbol</span>
                                    <span className="text-white font-mono font-bold">{confirmData.symbol}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-gray-800">
                                    <span className="text-gray-400 text-sm">Entry Price</span>
                                    <span className="text-white font-mono font-bold tabular-nums">{confirmData.entryPrice}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-gray-800">
                                    <span className="text-gray-400 text-sm">Volume</span>
                                    <span className="text-white font-mono font-bold tabular-nums">{confirmData.volume}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-gray-800">
                                    <span className="text-gray-400 text-sm">Stoploss Price</span>
                                    <span className="text-red-400 font-mono font-bold tabular-nums">{confirmData.stoploss.toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-gray-400 text-sm">Takeprofit Price</span>
                                    <span className="text-green-400 font-mono font-bold tabular-nums">{confirmData.takeprofit.toFixed(1)}</span>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all duration-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmOrder}
                                    className={`flex-1 py-3 px-4 ${confirmData.side === 'Long' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'} text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200`}
                                >
                                    Confirm Order
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Derivation;
