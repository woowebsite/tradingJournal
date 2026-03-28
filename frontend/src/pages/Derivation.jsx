import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchStrategies } from '../features/strategySlice';
import { getTCBSToken, getTCBSDerivatives, placeTCBSConditionOrder } from '../services/tcbsJournal';
import RealtimeChart from '../components/RealtimeChart';
import { RefreshCw, TrendingDown, TrendingUp, AlertCircle, Key } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import OtpModal from '../components/otpModal';

const Derivation = () => {
    const dispatch = useDispatch();
    const { items: strategies } = useSelector(state => state.strategies);
    const { selectedAccount } = useAccount();

    const [entryPrice, setEntryPrice] = useState('');
    const [strategy, setStrategy] = useState('');
    const [stoploss, setStoploss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');
    const [volume, setVolume] = useState(1);

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
    }, [dispatch]);

    // Derive rules directly from the selected strategy for Derivatives
    const strategyRules = React.useMemo(() => {
        if (!strategy || !strategies) return [];
        const selectedStrat = strategies.find(s => (s.id || s.documentId)?.toString() === strategy.toString());
        if (!selectedStrat || !selectedStrat.rules) return [];

        return selectedStrat.rules.filter(r => {
            const type = r.Type?.toLowerCase();
            return type === 'entry' || type === 'stoploss' || type === 'takeprofit';
        });
    }, [strategy, strategies]);

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
        <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">


            <div className="flex flex-1 gap-4 min-h-0 flex-col lg:flex-row pb-2">
                {/* Left Column: Chart */}
                <div className="flex flex-col flex-1 gap-4 min-h-0">
                    <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col min-h-[400px]">
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
                        <div className="flex-1 min-h-0 relative">
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
                    </div>
                </div>

                {/* Right Column: Symbol Info & Order Form */}
                <div className="lg:w-96 flex flex-col gap-4 h-full shrink-0 overflow-y-auto pr-1">


                    {/* Order Form */}
                    <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg flex flex-col min-h-0 overflow-y-auto">
                        <h2 className="text-lg font-semibold text-white mb-4">Place Order</h2>

                        {error && (
                            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg flex items-start gap-2.5 text-red-200">
                                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                                <p className="text-xs leading-relaxed">{error}</p>
                            </div>
                        )}
                        {successMessage && (
                            <div className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded-lg text-green-200 text-xs leading-relaxed">
                                {successMessage}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Strategy</label>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={strategy}
                                        onChange={(e) => setStrategy(e.target.value)}
                                    >
                                        <option value="">Select a Strategy...</option>
                                        {strategies.map((strat) => (
                                            <option key={strat.id || strat.documentId} value={strat.id || strat.documentId}>
                                                {strat.name || strat.Name || 'Unnamed Strategy'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Entry Price</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="API Price..."
                                        value={entryPrice}
                                        onChange={(e) => setEntryPrice(e.target.value)}
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Volume</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="1"
                                        value={volume}
                                        onChange={(e) => setVolume(e.target.value)}
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Stoploss</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="E.g. 1200.5"
                                        value={stoploss}
                                        onChange={(e) => setStoploss(e.target.value)}
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Take Profit</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="E.g. 1250.0"
                                        value={takeProfit}
                                        onChange={(e) => setTakeProfit(e.target.value)}
                                        step="0.1"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-3 mt-1">
                                <button
                                    onClick={() => handlePlaceOrder('Long')}
                                    disabled={submitting || !strategy || !entryPrice}
                                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
                                >
                                    <TrendingUp size={18} />
                                    {submitting ? 'Placing...' : 'LONG'}
                                </button>
                                <button
                                    onClick={() => handlePlaceOrder('Short')}
                                    disabled={submitting || !strategy || !entryPrice}
                                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
                                >
                                    <TrendingDown size={18} />
                                    {submitting ? 'Placing...' : 'SHORT'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
