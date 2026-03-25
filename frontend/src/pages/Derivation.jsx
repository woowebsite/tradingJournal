import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchStrategies } from '../features/strategySlice';
import { getTCBSToken, getTCBSDerivatives, placeTCBSConditionOrder } from '../services/tcbsJournal';
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
            if (Array.isArray(data) && data.length > 0) {
                // Just use the first one's matchPrice for now, or find the active one
                const activeDeriv = data[0];
                priceToSet = activeDeriv.matchPrice || activeDeriv.price || activeDeriv.lastPrice || '';
            } else if (data && typeof data === 'object') {
                priceToSet = data.matchPrice || data.price || data.lastPrice || '';
            }

            if (priceToSet) setEntryPrice(priceToSet);
            else setEntryPrice(JSON.stringify(data)); // fallback so user sees what it is

            setSuccessMessage("Fetched latest derivative price.");
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

    const handlePlaceOrder = async (side) => {
        if (!jwtToken) {
            setShowOtpModal(true);
            return;
        }
        if (!selectedAccount) {
            setError("Please select an active account from sidebar.");
            return;
        }

        setSubmitting(true);
        setError('');
        setSuccessMessage('');

        try {

            // The payload structure is a guess based on general forms, the user can inspect/tweak this later.
            // We pass the strategy, stoploss, takeProfit, volume, and side.
            const payload = {
                accountNo: selectedAccount.account_number || selectedAccount.name, // using account identifier
                side: side, // 'Long' / 'Short' or 'B' / 'S'
                volume: Number(volume),
                price: Number(entryPrice),
                stopPrice: Number(stoploss),
                takeProfit: Number(takeProfit),
                strategyId: strategy,
                orderType: 'CONDITION', // or similar
                // We might need instrument string if it's required (e.g. VN30F2405)
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
        <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="text-blue-500" />
                    Derivation Order
                </h1>
                <button
                    onClick={() => setShowOtpModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition"
                    title="Re-authenticate TCBS"
                >
                    <Key size={18} />
                    Auth
                </button>
            </div>
            <div className="flex flex-1 gap-4 min-h-0">
                {/* Left Panel: Symbol Info */}
                <div className="flex flex-col flex-1 gap-4 min-h-0 bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl overflow-y-auto">
                    <h2 className="text-xl font-semibold text-white mb-4">Symbol Info</h2>

                    {!derivativeData ? (
                        <div className="text-gray-500 text-sm italic">Fetch data to view symbol info</div>
                    ) : (
                        <div className="space-y-4">
                            {(() => {
                                const info = Array.isArray(derivativeData) && derivativeData.length > 0
                                    ? derivativeData[0]
                                    : typeof derivativeData === 'object' ? derivativeData : null;

                                if (!info) return <div className="text-gray-500 text-sm">No formatted data available</div>;

                                return (
                                    <>
                                        <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                                            <span className="text-gray-400">Symbol</span>
                                            <span className="font-bold text-lg text-white">{info.symbol || info.sec || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                                            <span className="text-gray-400">Price / Change</span>
                                            <div className="text-right">
                                                <div className="font-bold text-white">{info.matchPrice || info.price || info.lastPrice || '0'}</div>
                                                <div className={`text-sm ${Number(info.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {Number(info.change) > 0 ? '+' : ''}{Number(info.change || 0).toFixed(1)} ({Number(info.changePercent || 0).toFixed(2)}%)
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                                            <span className="text-gray-400">Expired</span>
                                            <span className="text-lg text-white text-sm">{formatDate(info.expiryDate) || 'N/A'}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                                                <div className="text-xs text-green-400 mb-1">Best Bid</div>
                                                <div className="font-semibold text-white">{info.bidPrice01 || info.bestBidPrice || info.bidPrice1 || '0'}</div>
                                                <div className="text-xs text-gray-500 mt-1">Vol: {info.bidQtty01 || info.bestBidQtty || info.bidVol1 || '0'}</div>
                                            </div>
                                            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                                                <div className="text-xs text-red-400 mb-1">Best Offer</div>
                                                <div className="font-semibold text-white">{info.offerPrice01 || info.bestOfferPrice || info.askPrice1 || '0'}</div>
                                                <div className="text-xs text-gray-500 mt-1">Vol: {info.offerQtty01 || info.bestOfferQtty || info.askVol1 || '0'}</div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* Display raw derivative data for debugging if needed */}
                    {derivativeData && (
                        <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg p-4">
                            <h3 className="text-gray-400 text-sm font-semibold mb-2">Raw Derivative API Data (Tartarus)</h3>
                            <pre className="text-xs text-gray-500 overflow-x-auto">
                                {JSON.stringify(derivativeData, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Right Panel: Order Form */}
                <div className="w-50 shrink-0 flex flex-col gap-4 h-full bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl overflow-y-auto">
                    <h2 className="text-xl font-semibold text-white mb-4">Derivation Order</h2>

                    {error && (
                        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg flex items-start gap-3 text-red-200">
                            <AlertCircle className="shrink-0 mt-0.5" size={18} />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    {successMessage && (
                        <div className="mb-4 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-200 text-sm">
                            {successMessage}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Entry Price</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="API Price..."
                                        value={entryPrice}
                                        onChange={(e) => setEntryPrice(e.target.value)}
                                    />
                                    <button
                                        onClick={handleFetchPrice}
                                        disabled={loadingPrice}
                                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition"
                                    >
                                        <RefreshCw size={18} className={loadingPrice ? "animate-spin" : ""} />
                                        Fetch
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Volume</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="1"
                                    value={volume}
                                    onChange={(e) => setVolume(e.target.value)}
                                    min="1"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Strategy</label>
                            <select
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Stoploss Price</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="E.g. 1200.5"
                                    value={stoploss}
                                    onChange={(e) => setStoploss(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Take Profit Price</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="E.g. 1250.0"
                                    value={takeProfit}
                                    onChange={(e) => setTakeProfit(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4 mt-4 border-t border-gray-700">
                            <button
                                onClick={() => handlePlaceOrder('Long')}
                                disabled={submitting}
                                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
                            >
                                <TrendingUp size={20} />
                                {submitting ? 'Placing...' : 'LONG'}
                            </button>
                            <button
                                onClick={() => handlePlaceOrder('Short')}
                                disabled={submitting}
                                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
                            >
                                <TrendingDown size={20} />
                                {submitting ? 'Placing...' : 'SHORT'}
                            </button>
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
        </div>
    );
};

export default Derivation;
