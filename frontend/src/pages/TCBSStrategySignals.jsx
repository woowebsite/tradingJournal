import { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, Loader2 } from 'lucide-react';
import { fetchRecentTcbsStrategySignals, syncTcbsStrategySignals, getTcbsStrategySignals } from '../services/tcbsStrategy';

const DEFAULT_PARAMS = {
    strategyKey: 'price_volume_increase',
    strategyName: 'Bùng nổ khối lượng',
    ticker: 'NNC',
};

const TCBS_STRATEGIES = [
    {
        StrategyName: 'Bùng nổ khối lượng',
        StrategyKey: 'price_volume_increase',
        Decs: 'Chiến lược mua khuyến nghị này phát hiện các mã cổ phiếu có giao dịch bùng nổ trong ngày, được tính toán bằng cách lấy khối lượng lũy kế tới thời điểm hiện tại chia cho khối lượng giao dịch trung bình 20 ngày gần nhất. Tỷ lệ này càng lớn càng thể hiện cổ phiếu đang thu hút được nhiều nhà đầu tư tham gia. Do đó, nhà đầu tư có thể cân nhắc mua khi giá cổ phiếu tăng, kết hợp với khối lượng gia tăng.',
    },
    {
        StrategyName: 'RSI quá bán',
        StrategyKey: 'oversold_rsi',
        Decs: 'Chỉ báo RSI cho biết bên mua hay bên bán đang chiếm ưu thế trên thị trường. Giá trị của RSI dao động từ 0 đến 100. Thông thường, RSI tăng trên 70 cho thấy thị trường đang mua mạnh cổ phiếu này. Tương tự khi RSI giảm xuống dưới 30 cho thấy thị trường đang bán mạnh cổ phiếu này. Tuy nhiên, giá cổ phiếu thường có xu hướng điều chỉnh về mức cân bằng nếu cổ phiếu đang ở trạng thái quá nóng. Do vậy, chiến lược sẽ đưa ra tín hiệu mua khi cổ phiếu nằm dưới ngưỡng quá bán',
    },
    {
        StrategyName: 'Giá giảm 15% trong 20 phiên',
        StrategyKey: 'price_decrease_15_20_session',
        Decs: 'Chiến lược này sẽ đưa ra tín hiệu mua khi giá cổ phiếu giảm ít nhất 15% trong 20 phiên giao dịch gần nhất. Chiến lược này có thể giúp nhà đầu tư "bắt đáy" những cổ phiếu đang giảm nhanh trong thời gian ngắn và đặc biệt phù hợp đối với những cổ phiếu có nền tảng cơ bản hấp dẫn.',
    },
    {
        StrategyName: 'Giá giảm 15% so với MA20',
        StrategyKey: 'price_decrease_15_ma20',
        Decs: 'Chiến lược này sẽ đưa ra tín hiệu mua khi giá cổ phiếu giảm quá 15% so với đường trung bình MA20. Chiến lược này có thể giúp nhà đầu tư "bắt đáy" những cổ phiếu đang giảm nhanh trong thời gian ngắn và đặc biệt phù hợp đối với những cổ phiếu có nền tảng cơ bản hấp dẫn.',
    },
    {
        StrategyName: 'SAR x MACD Histogram',
        StrategyKey: 'sar_x_macd',
        Decs: 'Chiến lược kết hợp chỉ báo SAR (Stop And Reverse) và chỉ báo MACD Histogram. Cụ thể, chỉ báo SAR nằm dưới giá đóng cửa của cổ phiếu cho tín hiệu tăng giá. Ngoài ra, MACD Histogram chuyển từ âm sang dương thể hiện xu hướng tăng đang dần được hình thành. Do đó, tín hiệu mua sẽ xuất hiện khi cổ phiếu thỏa mãn 2 điều kiện này.',
    },
    {
        StrategyName: 'Uptrend',
        StrategyKey: 'uptrend',
        Decs: 'Chiến lược giao dịch này kết hợp 3 đường trung bình di động (MA): MA5, MA10 và MA20. Khi các đường MA ngắn vượt lên trên các đường MA dài hơn, xu hướng tăng đang dần được hình thành, cho phép nhà đầu tư tìm kiếm lợi nhuận giao dịch trong ngắn hạn. Tín hiệu mua xuất hiện tại những điểm thỏa mãn đồng thời 2 điều kiện: (1) Đường MA10 đang nằm trên đường MA20. (2) Đường MA5 vượt lên trên đường MA10.',
    },
    {
        StrategyName: 'Mở Band Bollinger',
        StrategyKey: 'open_bollinger_band',
        Decs: 'Chiến lược sử dụng chỉ báo Bollinger Bands Width (BBW) kết hợp với đường trung bình 20 ngày (MA20) của cổ phiếu. Cụ thể, giá trị BBW càng nhỏ thể hiện biên độ giao dịch càng thu hẹp, giá cổ phiếu đang được tích lũy chặt chẽ. Khi BBW tăng dần kết hợp với việc giá vượt đường MA20, cổ phiếu có thể bước vào một nhịp tăng mới. Do đó, tín hiệu mua sẽ xuất hiện khi cổ phiếu thỏa mãn 2 điều kiện này.',
    },
    {
        StrategyName: 'Lướt sóng với DMI',
        StrategyKey: 'wave_dmi',
        Decs: 'Bộ lọc này sử dụng chỉ báo Chuyển động Định hướng (Directional Movement Index - DMI) bao gồm đường ADX, DI+ và DI -. Trong đó, đường ADX có giá trị càng cao thể hiện xu hướng càng mạnh. Đường DI+ thể hiện xu hướng tăng của cổ phiếu và đường DI- thể hiện xu hướng giảm của cổ phiếu. Đường DI+ cắt từ dưới lên trên đường DI- hàm ý rằng ở thời điểm hiện tại, xu hướng tăng đang áp đảo xu hướng giảm của cổ phiếu. Do đó, tín hiệu mua sẽ xuất hiện khi cổ phiếu thỏa mãn 2 điều kiện: (1) đường ADX lên trên mốc 25 (2) đường DI+ cắt từ dưới lên trên đường DI-',
    },
    {
        StrategyName: 'Giá tăng và MACD Histogram',
        StrategyKey: 'momentum_macd',
        Decs: 'Chiến lược kết hợp chỉ báo MACD Histogram và trạng thái giá hiện tại của cổ phiếu. MACD Histogram chuyển từ âm sang dương thể hiện xu hướng tăng đang dần được hình thành. Tuy nhiên, do MACD Histogram dễ tạo tín hiệu giả hoặc có độ trễ nhất định, cần kết hợp thêm với điều kiện giá tăng để xác nhận xu hướng giá. Do đó, chiến lược sẽ đưa ra tín hiệu mua sẽ xuất hiện khi cổ phiếu thỏa mãn 2 điều kiện này.',
    },
    {
        StrategyName: 'Giá tăng và Stochastic RSI',
        StrategyKey: 'price_increase_x_stochastic_rsi',
        Decs: 'Chiến lược kết hợp chỉ báo Stochastic RSI và trạng thái giá hiện tại của cổ phiếu. Khi đường %K cắt lên trên đường %D của chỉ báo Stochastic RSI ở vùng dưới 20, điều này hàm ý rằng xu hướng giảm đã yếu đi, nhà đầu tư có thể cân nhắc mua vào cổ phiếu. Tuy nhiên, để xác nhận xu hướng giá, cần kết hợp thêm với điều kiện giá tăng. Do đó, chiến lược sẽ đưa ra tín hiệu mua sẽ xuất hiện khi cổ phiếu thỏa mãn 2 điều kiện này.',
    },
];

const sortSignalsByNewestDate = (items) => {
    return [...items].sort((a, b) => new Date(b.TDate || 0) - new Date(a.TDate || 0));
};

const getStrategyName = (signal) => {
    if (signal.strategy?.strategyName) return signal.strategy.strategyName;
    const strategy = TCBS_STRATEGIES.find(item => item.StrategyKey === signal.strategyKey);
    return strategy?.StrategyName || signal.strategyKey || '-';
};

const TCBSStrategySignals = () => {
    const [strategyKey, setStrategyKey] = useState(DEFAULT_PARAMS.strategyKey);
    const [ticker, setTicker] = useState(DEFAULT_PARAMS.ticker);
    const [summary, setSummary] = useState(null);
    const [signals, setSignals] = useState([]);
    const [recentSignals, setRecentSignals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const selectedStrategy = TCBS_STRATEGIES.find(strategy => strategy.StrategyKey === strategyKey) || TCBS_STRATEGIES[0];

    const loadRecentSignals = async (nextTicker = ticker) => {
        const normalizedTicker = nextTicker.trim().toUpperCase();
        if (!normalizedTicker) return;

        const data = await fetchRecentTcbsStrategySignals(normalizedTicker);
        setRecentSignals(sortSignalsByNewestDate(data).slice(0, 10));
    };

    const loadSignals = async () => {
        const nextStrategyKey = strategyKey.trim();
        const nextTicker = ticker.trim().toUpperCase();

        if (!nextStrategyKey || !nextTicker) {
            setError('Strategy Key and Ticker are required.');
            return;
        }

        setLoading(true);
        setError(null);
        setTicker(nextTicker);

        try {
            // Try loading from database first for performance optimization
            const existingSignals = await getTcbsStrategySignals(nextStrategyKey, nextTicker);

            if (existingSignals && existingSignals.length > 0) {
                setSignals(sortSignalsByNewestDate(existingSignals));
                setSummary({
                    totalSigOne: existingSignals.length,
                    created: 0,
                    skipped: 0
                });
                await loadRecentSignals(nextTicker);
            } else {
                // If no signals are in the database, fetch and sync from TCBS
                const data = await syncTcbsStrategySignals({
                    strategyKey: nextStrategyKey,
                    strategyName: selectedStrategy.StrategyName,
                    ticker: nextTicker,
                });
                setSummary(data);
                setSignals(sortSignalsByNewestDate(data.signals || []));
                await loadRecentSignals(nextTicker);
            }
        } catch (err) {
            setError(err.response?.data?.error?.message || err.message || 'Failed to sync TCBS signals');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncAll = async () => {
        const nextTicker = ticker.trim().toUpperCase();

        if (!nextTicker) {
            setError('Ticker is required.');
            return;
        }

        setSyncingAll(true);
        setError(null);
        setSyncProgress({ current: 0, total: TCBS_STRATEGIES.length });

        try {
            let currentSelectedSummary = null;
            let currentSelectedSignals = [];

            for (let i = 0; i < TCBS_STRATEGIES.length; i++) {
                const strategy = TCBS_STRATEGIES[i];
                setSyncProgress({ current: i + 1, total: TCBS_STRATEGIES.length });

                const data = await syncTcbsStrategySignals({
                    strategyKey: strategy.StrategyKey,
                    strategyName: strategy.StrategyName,
                    ticker: nextTicker,
                });

                if (data && strategy.StrategyKey === strategyKey) {
                    currentSelectedSummary = data;
                    currentSelectedSignals = data.signals || [];
                }
            }

            if (currentSelectedSummary) {
                setSummary(currentSelectedSummary);
                setSignals(sortSignalsByNewestDate(currentSelectedSignals));
            } else {
                const currentSelected = TCBS_STRATEGIES.find(s => s.StrategyKey === strategyKey) || TCBS_STRATEGIES[0];
                const data = await syncTcbsStrategySignals({
                    strategyKey: strategyKey,
                    strategyName: currentSelected.StrategyName,
                    ticker: nextTicker,
                });
                setSummary(data);
                setSignals(sortSignalsByNewestDate(data?.signals || []));
            }

            await loadRecentSignals(nextTicker);
        } catch (err) {
            setError(err.response?.data?.error?.message || err.message || 'Failed to sync TCBS signals');
        } finally {
            setSyncingAll(false);
        }
    };

    useEffect(() => {
        if (!syncingAll) {
            loadSignals();
        }
    }, [strategyKey]);

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white">TCBS Strategy Signals</h2>
                    <p className="text-gray-400">
                        {selectedStrategy.StrategyName} · {ticker || DEFAULT_PARAMS.ticker}
                    </p>
                </div>

                <button
                    onClick={handleSyncAll}
                    disabled={loading || syncingAll}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition shadow-lg shadow-blue-600/20 font-semibold"
                >
                    {syncingAll ? (
                        <>
                            <Loader2 size={18} className="animate-spin text-blue-400" />
                            <span className="text-blue-400">{syncProgress.current}/{syncProgress.total}</span>
                        </>
                    ) : (
                        <>
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            <span>Sync</span>
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="mb-4 border border-red-700 bg-red-950/40 text-red-200 rounded-lg px-4 py-3">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <label className="text-sm text-gray-400" htmlFor="tcbs-strategy-key">Strategy Key</label>
                    <select
                        id="tcbs-strategy-key"
                        value={strategyKey}
                        onChange={(event) => setStrategyKey(event.target.value)}
                        className="mt-2 w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={loading || syncingAll}
                    >
                        {TCBS_STRATEGIES.map(strategy => (
                            <option key={strategy.StrategyKey} value={strategy.StrategyKey}>
                                {strategy.StrategyName}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <label className="text-sm text-gray-400" htmlFor="tcbs-ticker">Ticker</label>
                    <input
                        id="tcbs-ticker"
                        value={ticker}
                        onChange={(event) => setTicker(event.target.value.toUpperCase())}
                        onBlur={(event) => loadRecentSignals(event.target.value)}
                        className="mt-2 w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={loading || syncingAll}
                    />
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Sig = 1</p>
                    <p className="text-blue-400 font-semibold mt-1">{summary?.totalSigOne ?? signals.length}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Created</p>
                    <p className="text-green-400 font-semibold mt-1">{summary?.created ?? 0}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Skipped</p>
                    <p className="text-gray-200 font-semibold mt-1">{summary?.skipped ?? 0}</p>
                </div>
            </div>

            <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-white font-semibold">{selectedStrategy.StrategyName}</span>
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">{selectedStrategy.StrategyKey}</span>
                </div>
                <p className="text-sm leading-6 text-gray-400">{selectedStrategy.Decs}</p>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-sm mb-6">
                <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center gap-2">
                    <TrendingUp size={18} className="text-green-400" />
                    <span className="font-semibold text-white">Recently Signals</span>
                    <span className="text-sm text-gray-500">({recentSignals.length})</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Strategy Name</th>
                                <th className="px-6 py-3">Closed Price</th>
                                <th className="px-6 py-3">Volume</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {(loading || syncingAll) && recentSignals.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                                        Loading recent signals...
                                    </td>
                                </tr>
                            ) : recentSignals.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                                        No recent signals found.
                                    </td>
                                </tr>
                            ) : (
                                recentSignals.map((signal) => (
                                    <tr key={`recent-${signal.id || signal.documentId || signal.TDate}`} className="hover:bg-gray-700/30 transition">
                                        <td className="px-6 py-4 text-gray-200 font-medium">{signal.TDate}</td>
                                        <td className="px-6 py-4 text-gray-300">{getStrategyName(signal)}</td>
                                        <td className="px-6 py-4 text-gray-300">{Number(signal.CPrice || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-gray-300">{Number(signal.Volume || 0).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-400" />
                    <span className="font-semibold text-white">Signals</span>
                    <span className="text-sm text-gray-500">({signals.length})</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Close Price</th>
                                <th className="px-6 py-3">Volume</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {(loading || syncingAll) && signals.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                                        Loading TCBS signals...
                                    </td>
                                </tr>
                            ) : signals.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                                        No TCBS signals found.
                                    </td>
                                </tr>
                            ) : (
                                signals.map((signal) => (
                                    <tr key={signal.id || `${signal.TDate}-${signal.syncStatus}`} className="hover:bg-gray-700/30 transition">
                                        <td className="px-6 py-4 text-gray-200 font-medium">{signal.TDate}</td>
                                        <td className="px-6 py-4 text-gray-300">{Number(signal.CPrice || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-gray-300">{Number(signal.Volume || 0).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TCBSStrategySignals;
