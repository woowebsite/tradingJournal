import { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, Loader2, X } from 'lucide-react';
import { fetchRecentTcbsStrategySignals, syncTcbsStrategySignals, getTcbsStrategySignals, getStrategyDetail, syncStrategyDetail, getAllStrategyDetails } from '../services/tcbsStrategy';

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

const PROBABILITY_PERIOD_KEYS = ['T+3', 'T+5', 'T+10', 'T+20', 'T+60', 'T+180'];

const sortSignalsByNewestDate = (items) => {
    return [...items].sort((a, b) => new Date(b.TDate || 0) - new Date(a.TDate || 0));
};

const getStrategyName = (signal) => {
    if (signal.strategy?.strategyName) return signal.strategy.strategyName;
    const strategy = TCBS_STRATEGIES.find(item => item.StrategyKey === signal.strategyKey);
    return strategy?.StrategyName || signal.strategyKey || '-';
};

const getStrategyDescription = (strategyKey) => {
    const strategy = TCBS_STRATEGIES.find(item => item.StrategyKey === strategyKey);
    return strategy?.Decs || '';
};

const formatPercent = (value) => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '-';
    return `${(Number(value) * 100).toFixed(1)}%`;
};

const getProbabilityTone = (value) => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) {
        return {
            label: 'No data',
            textClass: 'text-gray-500',
            badgeClass: 'bg-gray-700/50 text-gray-400 border-gray-700',
        };
    }

    const numericValue = Number(value);
    if (numericValue >= 0.7) {
        return {
            label: 'Strong',
            textClass: 'text-emerald-300',
            badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
        };
    }

    if (numericValue >= 0.55) {
        return {
            label: 'Good',
            textClass: 'text-green-400',
            badgeClass: 'bg-green-500/10 text-green-300 border-green-500/25',
        };
    }

    if (numericValue >= 0.45) {
        return {
            label: 'Neutral',
            textClass: 'text-amber-300',
            badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
        };
    }

    return {
        label: 'Weak',
        textClass: 'text-red-300',
        badgeClass: 'bg-red-500/10 text-red-300 border-red-500/25',
    };
};

const getStrategyProbabilityTotals = (details) => {
    const totalsByStrategy = new Map();

    details.forEach((detail) => {
        const normalizedTicker = String(detail.ticker || '').trim().toUpperCase();
        const strategyKey = detail.strategyKey || 'unknown';
        const strategyName = detail.strategyName || getStrategyName(detail);
        const totalRow = detail.probPeriodDetail?.find(row => row.Year === 'TBC') || detail.probPeriodDetail?.at(-1);

        if (!totalRow) return;

        const mapKey = `${normalizedTicker || 'UNKNOWN'}-${strategyKey}`;
        const current = totalsByStrategy.get(mapKey) || {
            ticker: normalizedTicker || detail.ticker || '-',
            strategyKey,
            strategyName,
            totals: PROBABILITY_PERIOD_KEYS.reduce((acc, period) => ({ ...acc, [period]: 0 }), {}),
        };

        PROBABILITY_PERIOD_KEYS.forEach((period) => {
            const value = Number(totalRow[period]);
            if (Number.isFinite(value)) {
                current.totals[period] += value;
            }
        });

        totalsByStrategy.set(mapKey, current);
    });

    return Array.from(totalsByStrategy.values()).sort((a, b) => a.strategyName.localeCompare(b.strategyName));
};

const getProbabilityTotalScore = (strategy) => {
    return PROBABILITY_PERIOD_KEYS.reduce((total, period) => {
        const value = Number(strategy.totals?.[period]);
        return Number.isFinite(value) ? total + value : total;
    }, 0);
};

const getProbabilityAverageScore = (strategy) => getProbabilityTotalScore(strategy) / PROBABILITY_PERIOD_KEYS.length;

const getBestProbabilityPeriod = (strategy) => {
    return PROBABILITY_PERIOD_KEYS.reduce((bestPeriod, period) => {
        const value = Number(strategy.totals?.[period]);
        const bestValue = Number(strategy.totals?.[bestPeriod]);

        if (!Number.isFinite(value)) return bestPeriod;
        if (!bestPeriod || !Number.isFinite(bestValue) || value > bestValue) return period;
        return bestPeriod;
    }, '');
};

const getBestStrategiesByTicker = (probabilityTotals) => {
    const bestByTicker = new Map();

    probabilityTotals.forEach((strategy) => {
        const normalizedTicker = String(strategy.ticker || '').trim().toUpperCase();
        if (!normalizedTicker) return;

        const currentBest = bestByTicker.get(normalizedTicker);
        if (!currentBest || getProbabilityTotalScore(strategy) > getProbabilityTotalScore(currentBest)) {
            bestByTicker.set(normalizedTicker, strategy);
        }
    });

    return Array.from(bestByTicker.values()).sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));
};

const TCBSStrategySignals = () => {
    const [strategyKey, setStrategyKey] = useState(DEFAULT_PARAMS.strategyKey);
    const [ticker, setTicker] = useState(DEFAULT_PARAMS.ticker);
    const [summary, setSummary] = useState(null);
    const [signals, setSignals] = useState([]);
    const [recentSignals, setRecentSignals] = useState([]);
    const [bestStrategies, setBestStrategies] = useState([]);
    const [strategyProbabilityTotals, setStrategyProbabilityTotals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingBestStrategies, setLoadingBestStrategies] = useState(false);
    const [error, setError] = useState(null);
    const [syncingDetailAll, setSyncingDetailAll] = useState(false);
    const [syncDetailProgress, setSyncDetailProgress] = useState({ current: 0, total: 0 });
    const [syncingAll, setSyncingAll] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const selectedStrategy = TCBS_STRATEGIES.find(strategy => strategy.StrategyKey === strategyKey) || TCBS_STRATEGIES[0];

    const [detailOpen, setDetailOpen] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailData, setDetailData] = useState(null);

    const handleOpenDetail = async () => {
        const nextStrategyKey = strategyKey.trim();
        const nextTicker = ticker.trim().toUpperCase();

        if (!nextStrategyKey || !nextTicker) {
            setError('Strategy Key and Ticker are required.');
            return;
        }

        setDetailOpen(true);
        setLoadingDetail(true);
        setDetailData(null);
        setError(null);

        try {
            let data = await getStrategyDetail(nextStrategyKey, nextTicker);
            if (!data) {
                data = await syncStrategyDetail(nextStrategyKey, selectedStrategy.StrategyName, nextTicker);
                await loadRecentSignals(nextTicker);
            }
            setDetailData(data);
        } catch (err) {
            console.error('Failed to load strategy details:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to load strategy details');
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleSyncDetailExplicit = async () => {
        const nextStrategyKey = strategyKey.trim();
        const nextTicker = ticker.trim().toUpperCase();

        setLoadingDetail(true);
        setError(null);
        try {
            const data = await syncStrategyDetail(nextStrategyKey, selectedStrategy.StrategyName, nextTicker);
            setDetailData(data);
            await loadBestStrategies(nextTicker);
            await loadRecentSignals(nextTicker);
        } catch (err) {
            console.error('Failed to sync strategy details:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to sync strategy details');
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleSyncAllDetails = async () => {
        const nextTicker = ticker.trim().toUpperCase();

        if (!nextTicker) {
            setError('Ticker is required.');
            return;
        }

        setSyncingDetailAll(true);
        setError(null);
        setSyncDetailProgress({ current: 0, total: TCBS_STRATEGIES.length });

        try {
            const failedStrategies = [];
            const currentSelectedStrategy = TCBS_STRATEGIES.find(strategy => strategy.StrategyKey === strategyKey) || TCBS_STRATEGIES[0];
            let currentSelectedDetail = null;

            for (let i = 0; i < TCBS_STRATEGIES.length; i++) {
                const strategy = TCBS_STRATEGIES[i];
                setSyncDetailProgress({ current: i + 1, total: TCBS_STRATEGIES.length });

                try {
                    const data = await syncStrategyDetail(strategy.StrategyKey, strategy.StrategyName, nextTicker);
                    if (strategy.StrategyKey === currentSelectedStrategy.StrategyKey) {
                        currentSelectedDetail = data;
                    }
                } catch (err) {
                    console.error(`Failed to sync strategy detail for ${strategy.StrategyKey}:`, err);
                    failedStrategies.push(strategy.StrategyKey);
                }
            }

            if (currentSelectedDetail) {
                setDetailData(currentSelectedDetail);
            } else if (detailOpen) {
                await handleOpenDetail();
            }

            await loadBestStrategies(nextTicker);
            await loadRecentSignals(nextTicker);

            if (failedStrategies.length > 0) {
                setError(`Failed to sync detail for: ${failedStrategies.join(', ')}`);
            }
        } catch (err) {
            console.error('Failed to sync all strategy details:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to sync all strategy details');
        } finally {
            setSyncingDetailAll(false);
        }
    };

    const loadRecentSignals = async (nextTicker = ticker) => {
        const normalizedTicker = nextTicker.trim().toUpperCase();
        if (!normalizedTicker) return;

        const data = await fetchRecentTcbsStrategySignals(normalizedTicker);
        setRecentSignals(sortSignalsByNewestDate(data).slice(0, 10));
    };

    const handleTickerBlur = async (nextTicker) => {
        const normalizedTicker = nextTicker.trim().toUpperCase();
        if (!normalizedTicker) return;

        setTicker(normalizedTicker);
        await Promise.all([
            loadRecentSignals(normalizedTicker),
            loadBestStrategies(normalizedTicker),
            loadSignals(strategyKey, normalizedTicker)
        ]);
    };

    const loadBestStrategies = async (nextTicker = ticker) => {
        const normalizedTicker = nextTicker.trim().toUpperCase();
        if (!normalizedTicker) return;

        setLoadingBestStrategies(true);
        try {
            const details = await getAllStrategyDetails(normalizedTicker);
            const probabilityTotals = getStrategyProbabilityTotals(details);
            setStrategyProbabilityTotals(probabilityTotals);
            setBestStrategies(getBestStrategiesByTicker(probabilityTotals));
        } catch (err) {
            console.error('Failed to load best strategy details:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to load best strategy details');
        } finally {
            setLoadingBestStrategies(false);
        }
    };

    const loadSignals = async (nextStrategyKey = strategyKey, nextTicker = ticker) => {
        const normalizedStrategyKey = nextStrategyKey.trim();
        const normalizedTicker = nextTicker.trim().toUpperCase();

        if (!normalizedStrategyKey || !normalizedTicker) {
            setError('Strategy Key and Ticker are required.');
            return;
        }

        setLoading(true);
        setError(null);
        setTicker(normalizedTicker);

        try {
            // Try loading from database first for performance optimization
            const existingSignals = await getTcbsStrategySignals(normalizedStrategyKey, normalizedTicker);

            if (existingSignals && existingSignals.length > 0) {
                setSignals(sortSignalsByNewestDate(existingSignals));
                setSummary({
                    totalSigOne: existingSignals.length,
                    created: 0,
                    skipped: 0
                });
                await loadRecentSignals(normalizedTicker);
            } else {
                // If no signals are in the database, fetch and sync from TCBS
                const data = await syncTcbsStrategySignals({
                    strategyKey: normalizedStrategyKey,
                    strategyName: selectedStrategy.StrategyName,
                    ticker: normalizedTicker,
                });
                setSummary(data);
                setSignals(sortSignalsByNewestDate(data.signals || []));
                await loadRecentSignals(normalizedTicker);
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

    useEffect(() => {
        loadBestStrategies(ticker);
    }, []);

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white">TCBS Strategy Signals</h2>
                    <p className="text-gray-400">
                        {selectedStrategy.StrategyName} · {ticker || DEFAULT_PARAMS.ticker}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenDetail}
                        disabled={loading || syncingAll || syncingDetailAll || loadingDetail}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:cursor-not-allowed text-white rounded-lg transition border border-gray-700 shadow-lg font-semibold"
                    >
                        {loadingDetail ? (
                            <>
                                <Loader2 size={18} className="animate-spin text-blue-400" />
                                <span>Loading Detail...</span>
                            </>
                        ) : (
                            <span>Detail</span>
                        )}
                    </button>

                    <button
                        onClick={handleSyncAllDetails}
                        disabled={loading || syncingAll || syncingDetailAll || loadingDetail}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white rounded-lg transition shadow-lg shadow-emerald-600/20 font-semibold"
                    >
                        {syncingDetailAll ? (
                            <>
                                <Loader2 size={18} className="animate-spin text-emerald-200" />
                                <span className="text-emerald-100">{syncDetailProgress.current}/{syncDetailProgress.total}</span>
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                <span>Sync Detail</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleSyncAll}
                        disabled={loading || syncingAll || syncingDetailAll || loadingDetail}
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
                                <span>Sync signals</span>
                            </>
                        )}
                    </button>
                </div>
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
                        disabled={loading || syncingAll || syncingDetailAll || loadingDetail}
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
                        onBlur={(event) => handleTickerBlur(event.target.value)}
                        className="mt-2 w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={loading || syncingAll || syncingDetailAll || loadingDetail}
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

            <div id="best-strategy-table" className="mb-6 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center gap-2">
                    <TrendingUp size={18} className="text-yellow-400" />
                    <span className="font-semibold text-white">Best Strategy By Ticker</span>
                    <span className="text-sm text-gray-500">({bestStrategies.length})</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-900/50 text-gray-400 text-[11px] uppercase">
                            <tr>
                                <th className="px-4 py-3">Ticker</th>
                                <th className="px-4 py-3">Strategy</th>
                                <th className="px-4 py-3 text-right">Total Score</th>
                                <th className="px-4 py-3 text-right">Average</th>
                                <th className="px-4 py-3 text-right">Best Period</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loadingBestStrategies ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                                        Loading best strategies...
                                    </td>
                                </tr>
                            ) : bestStrategies.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                                        No strategy details found.
                                    </td>
                                </tr>
                            ) : (
                                bestStrategies.map((strategy) => {
                                    const averageScore = getProbabilityAverageScore(strategy);
                                    const averageTone = getProbabilityTone(averageScore);
                                    const bestPeriod = getBestProbabilityPeriod(strategy);

                                    return (
                                        <tr key={`best-${strategy.ticker}-${strategy.strategyKey}`} className="hover:bg-gray-700/30 transition">
                                            <td className="px-4 py-4 text-gray-200 font-bold">{strategy.ticker}</td>
                                            <td className="px-4 py-4 text-gray-300">
                                                <div className="font-medium text-white">{strategy.strategyName || getStrategyName(strategy)}</div>
                                                <div className="text-xs text-gray-500 font-mono">{strategy.strategyKey}</div>
                                                {getStrategyDescription(strategy.strategyKey) && (
                                                    <div className="mt-2 max-w-3xl text-[11px] leading-5 text-gray-400">
                                                        {getStrategyDescription(strategy.strategyKey)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right text-emerald-300 font-mono font-semibold">
                                                {formatPercent(getProbabilityTotalScore(strategy))}
                                            </td>
                                            <td className={`px-4 py-4 text-right font-mono font-semibold ${averageTone.textClass}`}>
                                                <div>{formatPercent(averageScore)}</div>
                                                <div className={`mt-1 inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${averageTone.badgeClass}`}>
                                                    {averageTone.label}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="font-mono font-semibold text-blue-300">{bestPeriod || '-'}</div>
                                                {bestPeriod && (
                                                    <div className="text-[11px] text-gray-400">{formatPercent(strategy.totals[bestPeriod])}</div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            

            <div className="mb-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-sm h-full">
                    <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center gap-2">
                        <TrendingUp size={18} className="text-green-400" />
                        <span className="font-semibold text-white">Recently Signals</span>
                        <span className="text-sm text-gray-500">({recentSignals.length})</span>
                    </div>

                    <div className="max-h-[540px] overflow-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-900/50 text-gray-400 text-[11px] uppercase">
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

                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-sm h-full">
                    <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-400" />
                        <span className="font-semibold text-white">Signals: {selectedStrategy.StrategyName}</span>
                        <span className="text-sm text-gray-500">({signals.length})</span>
                    </div>

                    <div className="max-h-[540px] overflow-auto">
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
                                        <td colSpan="3" className="px-6 py-10 text-center text-gray-400">
                                            Loading TCBS signals...
                                        </td>
                                    </tr>
                                ) : signals.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-10 text-center text-gray-400">
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

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-sm mb-6">
                <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center gap-2">
                    <TrendingUp size={18} className="text-purple-400" />
                    <span className="font-semibold text-white">Probability Period Detail Totals</span>
                    <span className="text-sm text-gray-500">({strategyProbabilityTotals.length})</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-900/50 text-gray-400 text-[11px] uppercase">
                            <tr>
                                <th className="px-6 py-3">Strategy Name</th>
                                {PROBABILITY_PERIOD_KEYS.map((period) => (
                                    <th key={`prob-total-head-${period}`} className="px-6 py-3 text-right">{period.toLowerCase()}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loadingBestStrategies ? (
                                <tr>
                                    <td colSpan={PROBABILITY_PERIOD_KEYS.length + 1} className="px-6 py-8 text-center text-gray-400">
                                        Loading probability totals...
                                    </td>
                                </tr>
                            ) : strategyProbabilityTotals.length === 0 ? (
                                <tr>
                                    <td colSpan={PROBABILITY_PERIOD_KEYS.length + 1} className="px-6 py-8 text-center text-gray-400">
                                        No probability period details found.
                                    </td>
                                </tr>
                            ) : (
                                strategyProbabilityTotals.map((strategy) => (
                                    <tr key={`prob-total-${strategy.strategyKey}`} className="hover:bg-gray-700/30 transition">
                                        <td className="px-6 py-4 text-white font-medium">
                                            <div>{strategy.strategyName}</div>
                                            <div className="text-xs text-gray-500 font-mono">{strategy.strategyKey}</div>
                                        </td>
                                        {PROBABILITY_PERIOD_KEYS.map((period) => {
                                            const tone = getProbabilityTone(strategy.totals[period]);
                                            return (
                                                <td key={`prob-total-${strategy.strategyKey}-${period}`} className="px-6 py-4 text-right">
                                                    <div className={`font-mono font-semibold ${tone.textClass}`}>
                                                        {formatPercent(strategy.totals[period])}
                                                    </div>
                                                    <div className={`mt-1 inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.badgeClass}`}>
                                                        {tone.label}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {detailOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col text-gray-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/40">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span>Strategy Backtest Details</span>
                                    <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded font-mono uppercase">{ticker}</span>
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">{selectedStrategy.StrategyName} · {selectedStrategy.StrategyKey}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSyncDetailExplicit}
                                    disabled={loadingDetail || syncingDetailAll}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs font-semibold text-gray-300 rounded-lg transition border border-gray-700"
                                >
                                    <RefreshCw size={12} className={loadingDetail ? 'animate-spin' : ''} />
                                    <span>Sync from TCBS</span>
                                </button>
                                <button
                                    onClick={() => setDetailOpen(false)}
                                    className="p-1.5 hover:bg-gray-800 rounded-lg transition text-gray-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {loadingDetail ? (
                                <div className="py-20 text-center text-gray-400">
                                    <Loader2 size={40} className="animate-spin mx-auto mb-4 text-blue-500 opacity-50" />
                                    <p className="text-lg font-medium">Fetching strategy statistics...</p>
                                    <p className="text-xs text-gray-500 mt-1">Calling TCBS backtest engine & storing results</p>
                                </div>
                            ) : detailData ? (
                                <>
                                    {/* Stats grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Volatility Stats */}
                                        <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 space-y-3">
                                            <h4 className="font-bold text-sm uppercase tracking-wider text-orange-400">Volatility Stats</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Best Period</span>
                                                    <span className="font-bold text-white">{detailData.volaStatistic?.BestPeriod || '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">High Score</span>
                                                    <span className="font-bold text-green-400">
                                                        {detailData.volaStatistic?.HighPercent !== undefined && detailData.volaStatistic?.HighPercent !== null ? `+${(detailData.volaStatistic.HighPercent * 100).toFixed(1)}%` : '-'}
                                                        <span className="text-xs text-gray-400 ml-1 font-normal">{detailData.volaStatistic?.High || ''}</span>
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Low Score</span>
                                                    <span className="font-bold text-red-400">
                                                        {detailData.volaStatistic?.LowPercent !== undefined && detailData.volaStatistic?.LowPercent !== null ? `${(detailData.volaStatistic.LowPercent * 100).toFixed(1)}%` : '-'}
                                                        <span className="text-xs text-gray-400 ml-1 font-normal">{detailData.volaStatistic?.Low || ''}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Probability Stats */}
                                        <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 space-y-3">
                                            <h4 className="font-bold text-sm uppercase tracking-wider text-green-400">Probability Stats</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Best Period</span>
                                                    <span className="font-bold text-white">{detailData.probStatistic?.BestPeriod || '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">High Success</span>
                                                    <span className="font-bold text-green-400">
                                                        {detailData.probStatistic?.HighPercent !== undefined && detailData.probStatistic?.HighPercent !== null ? `${(detailData.probStatistic.HighPercent * 100).toFixed(1)}%` : '-'}
                                                        <span className="text-xs text-gray-400 ml-1 font-normal">{detailData.probStatistic?.High || ''}</span>
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Low Success</span>
                                                    <span className="font-bold text-red-400">
                                                        {detailData.probStatistic?.LowPercent !== undefined && detailData.probStatistic?.LowPercent !== null ? `${(detailData.probStatistic.LowPercent * 100).toFixed(1)}%` : '-'}
                                                        <span className="text-xs text-gray-400 ml-1 font-normal">{detailData.probStatistic?.Low || ''}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Probability Period */}
                                        <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 space-y-3">
                                            <h4 className="font-bold text-sm uppercase tracking-wider text-blue-400">Best Period Summary ({detailData.probByPeriod?.Period || '-'})</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Total Signals</span>
                                                    <span className="font-bold text-white font-mono">{detailData.probByPeriod?.NoSignal ?? '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Profit Rate</span>
                                                    <span className="font-bold text-green-400">
                                                        {detailData.probByPeriod?.Profit !== undefined && detailData.probByPeriod?.Profit !== null ? `${(detailData.probByPeriod.Profit * 100).toFixed(1)}%` : '-'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Loss / Draw</span>
                                                    <span className="font-bold text-red-400">
                                                        {detailData.probByPeriod?.Loss !== undefined && detailData.probByPeriod?.Loss !== null ? `${(detailData.probByPeriod.Loss * 100).toFixed(1)}%` : '-'}
                                                        <span className="text-xs text-gray-500 font-normal ml-1">/ {detailData.probByPeriod?.Draw !== undefined && detailData.probByPeriod?.Draw !== null ? `${(detailData.probByPeriod.Draw * 100).toFixed(1)}%` : '0%'}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tables Section */}
                                    <div className="space-y-8">
                                        {/* VolaPeriodDetail Table */}
                                        <div className="space-y-3">
                                            <h4 className="text-md font-bold text-white flex items-center gap-2">
                                                <span className="w-1.5 h-4 bg-orange-500 rounded-full" />
                                                <span>Volatility Period Detail (VolaPeriodDetail)</span>
                                            </h4>
                                            <div className="border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
                                                <table className="w-full text-left border-collapse min-w-[700px]">
                                                    <thead className="bg-gray-950/60 text-gray-400 text-xs font-mono uppercase">
                                                        <tr className="border-b border-gray-800">
                                                            <th className="px-4 py-3 font-bold">Year</th>
                                                            <th className="px-4 py-3 text-right">T+3</th>
                                                            <th className="px-4 py-3 text-right">T+5</th>
                                                            <th className="px-4 py-3 text-right">T+10</th>
                                                            <th className="px-4 py-3 text-right">T+20</th>
                                                            <th className="px-4 py-3 text-right">T+60</th>
                                                            <th className="px-4 py-3 text-right">T+180</th>
                                                            <th className="px-4 py-3 text-right font-bold text-gray-300">Average (TBC)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-800 text-sm font-mono">
                                                        {detailData.volaPeriodDetail?.map((row, idx) => {
                                                            const isTbc = row.Year === 'TBC';
                                                            return (
                                                                <tr key={`vola-row-${idx}`} className={`hover:bg-gray-800/30 transition-colors ${isTbc ? 'bg-orange-500/5 font-bold text-orange-300' : ''}`}>
                                                                    <td className="px-4 py-3 text-gray-200">{row.Year}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+3'] > 0 ? 'text-green-400' : row['T+3'] < 0 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+3'] !== null && row['T+3'] !== undefined ? `${(row['T+3'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+5'] > 0 ? 'text-green-400' : row['T+5'] < 0 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+5'] !== null && row['T+5'] !== undefined ? `${(row['T+5'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+10'] > 0 ? 'text-green-400' : row['T+10'] < 0 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+10'] !== null && row['T+10'] !== undefined ? `${(row['T+10'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+20'] > 0 ? 'text-green-400' : row['T+20'] < 0 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+20'] !== null && row['T+20'] !== undefined ? `${(row['T+20'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+60'] > 0 ? 'text-green-400' : row['T+60'] < 0 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+60'] !== null && row['T+60'] !== undefined ? `${(row['T+60'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+180'] > 0 ? 'text-green-400' : row['T+180'] < 0 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+180'] !== null && row['T+180'] !== undefined ? `${(row['T+180'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right font-bold ${row.TBC > 0 ? 'text-green-400' : row.TBC < 0 ? 'text-red-400' : 'text-gray-400'}`}>{row.TBC !== null && row.TBC !== undefined ? `${(row.TBC * 100).toFixed(1)}%` : '-'}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* ProbPeriodDetail Table */}
                                        <div className="space-y-3">
                                            <h4 className="text-md font-bold text-white flex items-center gap-2">
                                                <span className="w-1.5 h-4 bg-green-500 rounded-full" />
                                                <span>Probability Period Detail (ProbPeriodDetail)</span>
                                            </h4>
                                            <div className="border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
                                                <table className="w-full text-left border-collapse min-w-[700px]">
                                                    <thead className="bg-gray-950/60 text-gray-400 text-xs font-mono uppercase">
                                                        <tr className="border-b border-gray-800">
                                                            <th className="px-4 py-3 font-bold">Year</th>
                                                            <th className="px-4 py-3 text-right">T+3</th>
                                                            <th className="px-4 py-3 text-right">T+5</th>
                                                            <th className="px-4 py-3 text-right">T+10</th>
                                                            <th className="px-4 py-3 text-right">T+20</th>
                                                            <th className="px-4 py-3 text-right">T+60</th>
                                                            <th className="px-4 py-3 text-right">T+180</th>
                                                            <th className="px-4 py-3 text-right font-bold text-gray-300">Average (TBC)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-800 text-sm font-mono">
                                                        {detailData.probPeriodDetail?.map((row, idx) => {
                                                            const isTbc = row.Year === 'TBC';
                                                            return (
                                                                <tr key={`prob-row-${idx}`} className={`hover:bg-gray-800/30 transition-colors ${isTbc ? 'bg-green-500/5 font-bold text-green-300' : ''}`}>
                                                                    <td className="px-4 py-3 text-gray-200">{row.Year}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+3'] >= 0.6 ? 'text-green-400' : row['T+3'] < 0.4 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+3'] !== null && row['T+3'] !== undefined ? `${(row['T+3'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+5'] >= 0.6 ? 'text-green-400' : row['T+5'] < 0.4 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+5'] !== null && row['T+5'] !== undefined ? `${(row['T+5'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+10'] >= 0.6 ? 'text-green-400' : row['T+10'] < 0.4 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+10'] !== null && row['T+10'] !== undefined ? `${(row['T+10'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+20'] >= 0.6 ? 'text-green-400' : row['T+20'] < 0.4 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+20'] !== null && row['T+20'] !== undefined ? `${(row['T+20'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+60'] >= 0.6 ? 'text-green-400' : row['T+60'] < 0.4 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+60'] !== null && row['T+60'] !== undefined ? `${(row['T+60'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right ${row['T+180'] >= 0.6 ? 'text-green-400' : row['T+180'] < 0.4 ? 'text-red-400' : 'text-gray-400'}`}>{row['T+180'] !== null && row['T+180'] !== undefined ? `${(row['T+180'] * 100).toFixed(1)}%` : '-'}</td>
                                                                    <td className={`px-4 py-3 text-right font-bold ${row.TBC >= 0.6 ? 'text-green-400' : row.TBC < 0.4 ? 'text-red-400' : 'text-gray-400'}`}>{row.TBC !== null && row.TBC !== undefined ? `${(row.TBC * 100).toFixed(1)}%` : '-'}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-20 text-center text-gray-500">
                                    No detailed strategy metrics available. Click "Sync from TCBS" to import backtest data.
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end bg-gray-950/20 rounded-b-2xl">
                            <button
                                onClick={() => setDetailOpen(false)}
                                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-semibold rounded-xl transition border border-gray-700 text-white"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TCBSStrategySignals;
