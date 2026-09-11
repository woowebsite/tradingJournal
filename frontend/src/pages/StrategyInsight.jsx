import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
    Activity,
    Layers,
    ListFilter,
    Clock,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    BarChart3,
    ExternalLink,
    Zap,
    Sparkles,
    Calendar,
    Sun,
    CalendarDays,
    Percent,
    PieChart,
    BrainCircuit,
    Compass,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    Flame,
    BarChart2
} from 'lucide-react';
import { fetchWatchlists } from '../features/watchlistSlice';
import { fetchSymbols } from '../features/marketSlice';
import { useAccount } from '../context/AccountContext';
import { scanPythonStrategy } from '../services/pythonStrategy';
import TradingViewChart from '../components/TradingViewChart';
import { formatNumber } from '../utils/formatNumber';
import dayjs from 'dayjs';

const TIMEFRAME_OPTIONS = [
    { label: '1m', value: 'M1', desc: '1 Phút' },
    { label: '5m', value: 'M5', desc: '5 Phút' },
    { label: '15m', value: 'M15', desc: '15 Phút' },
    { label: '30m', value: 'M30', desc: '30 Phút' },
    { label: '1h', value: 'H1', desc: '1 Giờ' },
    { label: '4h', value: 'H4', desc: '4 Giờ' },
    { label: '1D', value: 'D1', desc: '1 Ngày' },
    { label: '1W', value: 'W1', desc: '1 Tuần' }
];

const INSIGHT_MODES = [
    {
        id: 'spread',
        label: 'Spread',
        desc: 'Thống kê spread theo các bước giá / percent',
        icon: Percent,
        color: 'text-amber-400',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
        id: 'intraday',
        label: 'Intraday',
        desc: 'Thống kê giờ tăng giảm trong ngày',
        icon: Sun,
        color: 'text-orange-400',
        badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    },
    {
        id: 'week',
        label: 'Week',
        desc: 'Thống kê ngày tăng giảm trong tuần',
        icon: Calendar,
        color: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    {
        id: 'year',
        label: 'Year',
        desc: 'Thống kê tháng tăng giảm trong năm',
        icon: CalendarDays,
        color: 'text-sky-400',
        badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
    }
];

const WEEKDAY_NAMES = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const MONTH_NAMES = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const StrategyInsight = () => {
    const dispatch = useDispatch();
    const { selectedAccount } = useAccount();
    const { items: watchlists = [] } = useSelector(state => state.watchlists);
    const { symbols = [] } = useSelector(state => state.market);
    const chartCardRef = useRef(null);

    // Filter & Selection States
    const [selectedWatchlistId, setSelectedWatchlistId] = useState('');
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [timeframe, setTimeframe] = useState('D1');
    const [insightMode, setInsightMode] = useState('spread'); // 'spread' | 'intraday' | 'week' | 'year'
    const [spreadViewUnit, setSpreadViewUnit] = useState('price'); // 'price' | 'percent'

    // Data States
    const [countback, setCountback] = useState(1000);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    // 1. Initial Load: Watchlists, Symbols
    useEffect(() => {
        dispatch(fetchWatchlists());
        dispatch(fetchSymbols());
    }, [dispatch]);

    // 2. Filter Watchlists by active Account
    const accountWatchlists = useMemo(() => {
        if (!selectedAccount) return watchlists;
        return watchlists.filter(w => {
            const marketMatch = !w.market || w.market.documentId === selectedAccount?.market?.documentId || w.market.id === selectedAccount?.market?.id;
            const accountMatch = !w.account || w.account.documentId === selectedAccount.documentId || w.account.id === selectedAccount.id;
            return marketMatch && accountMatch;
        });
    }, [watchlists, selectedAccount]);

    // Set first watchlist ID if not set
    useEffect(() => {
        if (accountWatchlists.length > 0 && !selectedWatchlistId) {
            setSelectedWatchlistId(accountWatchlists[0].documentId || accountWatchlists[0].id);
        }
    }, [accountWatchlists, selectedWatchlistId]);

    // Normalize symbols in active watchlist
    const watchlistSymbols = useMemo(() => {
        let rawList = [];
        if (selectedWatchlistId) {
            const wl = accountWatchlists.find(w => String(w.documentId || w.id) === String(selectedWatchlistId));
            if (wl?.symbols && wl.symbols.length > 0) {
                rawList = wl.symbols;
            }
        }
        if (!rawList || rawList.length === 0) {
            rawList = symbols && symbols.length > 0 ? symbols : ['VNINDEX', 'VN30F1M', 'BTCUSDT', 'ETHUSDT', 'LINKUSDT.P'];
        }

        const normalized = rawList.map(s => {
            if (typeof s === 'string') return s.trim().toUpperCase();
            return String(s?.Name || s?.name || s?.ticker || '').trim().toUpperCase();
        }).filter(Boolean);

        return [...new Set(normalized)];
    }, [selectedWatchlistId, accountWatchlists, symbols]);

    // Reset selectedSymbol when watchlist changes if current symbol not in new list
    useEffect(() => {
        if (watchlistSymbols.length > 0 && selectedSymbol) {
            const currentSelectedInList = watchlistSymbols.includes(selectedSymbol);
            if (!currentSelectedInList) {
                setSelectedSymbol('');
                setScanResult(null);
            }
        }
    }, [watchlistSymbols, selectedSymbol]);

    // 3. Scan & Load Chart Strategy Data
    const handleLoadInsight = useCallback(async (tickerToScan = null, customCountback = null, customTimeframe = null) => {
        const ticker = String(tickerToScan || selectedSymbol || '').trim().toUpperCase();
        const currentTf = String(customTimeframe || timeframe || 'D1').trim().toUpperCase();
        if (!ticker) {
            setErrorMessage('Vui lòng chọn Symbol từ Watchlist trước khi phân tích.');
            return;
        }

        setScanning(true);
        setErrorMessage('');
        const reqCountback = customCountback || countback || 1000;
        try {
            const payload = {
                strategyFile: 'strategy_supertrend_ma288.py',
                ticker,
                timeframe: currentTf,
                countback: reqCountback,
                rr: 1.5,
                entryType: 'candle_close',
                stPeriod: 10,
                stMultiplier: 3.0,
                maPeriod: 288,
                allowLong: true,
                allowShort: true,
                tpSupertrend: true,
                tpRR: true,
            };

            const result = await scanPythonStrategy(payload);

            if (result?.error) {
                setErrorMessage(result.error);
                setScanResult(null);
            } else {
                setScanResult(result);
                setHasMore(true);
                if (ticker !== selectedSymbol) {
                    setSelectedSymbol(ticker);
                }
            }
        } catch (err) {
            console.error('Insight scan error:', err);
            const errDetail = err?.response?.data?.error?.message || err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi phân tích chiến lược.';
            setErrorMessage(typeof errDetail === 'object' ? JSON.stringify(errDetail) : String(errDetail));
            setScanResult(null);
        } finally {
            setScanning(false);
        }
    }, [selectedSymbol, timeframe, countback]);

    // Infinite scroll: load more historical candles
    const handleLoadMore = useCallback(async () => {
        if (scanning || loadingMore || !hasMore) return;
        const currentLen = scanResult?.candles?.length || 0;
        if (currentLen === 0) return;

        const nextCount = Math.min(Math.max(countback, currentLen) + 500, 5000);
        if (nextCount <= currentLen && currentLen >= 5000) {
            setHasMore(false);
            return;
        }

        setLoadingMore(true);
        try {
            const ticker = String(selectedSymbol || '').trim().toUpperCase();
            if (!ticker) return;

            const payload = {
                strategyFile: 'strategy_supertrend_ma288.py',
                ticker,
                timeframe,
                countback: nextCount,
                rr: 1.5,
                entryType: 'candle_close',
                stPeriod: 10,
                stMultiplier: 3.0,
                maPeriod: 288,
                allowLong: true,
                allowShort: true,
                tpSupertrend: true,
                tpRR: true,
            };

            const result = await scanPythonStrategy(payload);
            if (result && !result.error && result.candles?.length > currentLen) {
                setCountback(nextCount);
                setScanResult(result);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Failed to load more historical candles:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [scanning, loadingMore, hasMore, countback, scanResult, selectedSymbol, timeframe]);

    // Prepare candles for TradingViewChart
    const chartCandles = useMemo(() => {
        if (!scanResult?.candles) return [];
        return scanResult.candles.map(c => ({
            date: c.date,
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume
        }));
    }, [scanResult]);

    // Summary metrics from scan
    const lastCandle = chartCandles.length > 0 ? chartCandles[chartCandles.length - 1] : null;
    const prevCandle = chartCandles.length > 1 ? chartCandles[chartCandles.length - 2] : null;
    const priceChange = lastCandle && prevCandle
        ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100
        : 0;

    // ==========================================
    // 1. STATS: SPREAD (Price & Percent)
    // ==========================================
    const spreadStats = useMemo(() => {
        if (!chartCandles || chartCandles.length === 0) return null;

        const spreads = chartCandles.map(c => {
            const priceSpread = Math.max(0, c.high - c.low);
            const basePrice = c.low > 0 ? c.low : (c.open > 0 ? c.open : 1);
            const percentSpread = (priceSpread / basePrice) * 100;
            const bodyPercent = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0;
            const bodyPrice = Math.abs(c.close - c.open);
            return {
                date: c.date,
                time: c.time,
                priceSpread,
                percentSpread,
                bodyPrice,
                bodyPercent,
                close: c.close,
                high: c.high,
                low: c.low,
                volume: c.volume || 0
            };
        });

        const percentSpreadsSorted = [...spreads].map(s => s.percentSpread).sort((a, b) => a - b);
        const priceSpreadsSorted = [...spreads].map(s => s.priceSpread).sort((a, b) => a - b);
        const len = percentSpreadsSorted.length;

        const avgPercent = percentSpreadsSorted.reduce((acc, v) => acc + v, 0) / len;
        const avgPrice = priceSpreadsSorted.reduce((acc, v) => acc + v, 0) / len;

        const medianPercent = percentSpreadsSorted[Math.floor(len * 0.5)] || 0;
        const medianPrice = priceSpreadsSorted[Math.floor(len * 0.5)] || 0;

        const p25Percent = percentSpreadsSorted[Math.floor(len * 0.25)] || 0;
        const p25Price = priceSpreadsSorted[Math.floor(len * 0.25)] || 0;

        const p75Percent = percentSpreadsSorted[Math.floor(len * 0.75)] || 0;
        const p75Price = priceSpreadsSorted[Math.floor(len * 0.75)] || 0;

        const p90Percent = percentSpreadsSorted[Math.floor(len * 0.90)] || 0;
        const p90Price = priceSpreadsSorted[Math.floor(len * 0.90)] || 0;

        const p99Percent = percentSpreadsSorted[Math.floor(len * 0.99)] || 0;
        const p99Price = priceSpreadsSorted[Math.floor(len * 0.99)] || 0;

        const minPercent = percentSpreadsSorted[0] || 0;
        const minPrice = priceSpreadsSorted[0] || 0;

        const maxPercent = percentSpreadsSorted[len - 1] || 0;
        const maxPrice = priceSpreadsSorted[len - 1] || 0;

        const stdPercent = Math.sqrt(spreads.reduce((acc, s) => acc + Math.pow(s.percentSpread - avgPercent, 2), 0) / len) || 0.001;
        const stdPrice = Math.sqrt(spreads.reduce((acc, s) => acc + Math.pow(s.priceSpread - avgPrice, 2), 0) / len) || 0.001;

        // 1. Percent Buckets (Tỷ lệ %)
        const percentBuckets = [
            { label: '< 0.5%', min: 0, max: 0.5, mid: 0.25, width: 0.5, count: 0 },
            { label: '0.5% - 1.0%', min: 0.5, max: 1.0, mid: 0.75, width: 0.5, count: 0 },
            { label: '1.0% - 2.0%', min: 1.0, max: 2.0, mid: 1.5, width: 1.0, count: 0 },
            { label: '2.0% - 3.5%', min: 2.0, max: 3.5, mid: 2.75, width: 1.5, count: 0 },
            { label: '3.5% - 5.0%', min: 3.5, max: 5.0, mid: 4.25, width: 1.5, count: 0 },
            { label: '> 5.0%', min: 5.0, max: Infinity, mid: 5.75, width: 1.5, count: 0 }
        ];

        spreads.forEach(s => {
            const b = percentBuckets.find(bkt => s.percentSpread >= bkt.min && s.percentSpread < bkt.max);
            if (b) b.count += 1;
        });

        // 2. Dynamic Price Range Buckets (Khoảng giá tuyệt đối)
        const pRefMax = p99Price > 0 ? p99Price : (maxPrice > 0 ? maxPrice : 1);
        const rawStep = Math.max(0.0001, pRefMax / 5);
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const normalized = rawStep / magnitude;
        let cleanMultiplier = 1;
        if (normalized >= 5) cleanMultiplier = 5;
        else if (normalized >= 2) cleanMultiplier = 2;
        else cleanMultiplier = 1;
        const cleanStep = cleanMultiplier * magnitude;

        const pb1 = cleanStep;
        const pb2 = cleanStep * 2;
        const pb3 = cleanStep * 3;
        const pb4 = cleanStep * 5;
        const pb5 = cleanStep * 8;

        const priceBuckets = [
            { label: `< ${formatNumber(pb1)}`, min: 0, max: pb1, mid: pb1 * 0.5, width: pb1, count: 0 },
            { label: `${formatNumber(pb1)} - ${formatNumber(pb2)}`, min: pb1, max: pb2, mid: (pb1 + pb2) / 2, width: pb2 - pb1, count: 0 },
            { label: `${formatNumber(pb2)} - ${formatNumber(pb3)}`, min: pb2, max: pb3, mid: (pb2 + pb3) / 2, width: pb3 - pb2, count: 0 },
            { label: `${formatNumber(pb3)} - ${formatNumber(pb4)}`, min: pb3, max: pb4, mid: (pb4 + pb3) / 2, width: pb4 - pb3, count: 0 },
            { label: `${formatNumber(pb4)} - ${formatNumber(pb5)}`, min: pb4, max: pb5, mid: (pb5 + pb4) / 2, width: pb5 - pb4, count: 0 },
            { label: `> ${formatNumber(pb5)}`, min: pb5, max: Infinity, mid: pb5 + pb1 * 1.5, width: pb1 * 3, count: 0 }
        ];

        spreads.forEach(s => {
            const pb = priceBuckets.find(bkt => s.priceSpread >= bkt.min && s.priceSpread < bkt.max);
            if (pb) pb.count += 1;
        });

        // High vs Low volatility count
        const highVolCount = spreads.filter(s => s.percentSpread >= 2.0).length;
        const lowVolCount = spreads.filter(s => s.percentSpread < 0.5).length;

        return {
            total: len,
            avgPercent,
            avgPrice,
            stdPercent,
            stdPrice,
            medianPercent,
            medianPrice,
            p25Percent,
            p25Price,
            p75Percent,
            p75Price,
            p90Percent,
            p90Price,
            p99Percent,
            p99Price,
            minPercent,
            minPrice,
            maxPercent,
            maxPrice,
            percentBuckets,
            priceBuckets,
            // Aliases
            p25: p25Percent,
            p75: p75Percent,
            p90: p90Percent,
            p99: p99Percent,
            avg: avgPercent,
            median: medianPercent,
            min: minPercent,
            max: maxPercent,
            highVolRatio: ((highVolCount / len) * 100).toFixed(1),
            lowVolRatio: ((lowVolCount / len) * 100).toFixed(1),
            spreadsTimeline: spreads.slice(-100) // last 100 candles for timeline
        };
    }, [chartCandles]);

    // ==========================================
    // 2. STATS: INTRADAY (Hourly Distribution)
    // ==========================================
    const intradayStats = useMemo(() => {
        if (!chartCandles || chartCandles.length === 0) return null;

        // Group by hour (0 to 23)
        const hourlyMap = new Map();
        for (let h = 0; h < 24; h++) {
            hourlyMap.set(h, {
                hour: h,
                total: 0,
                bull: 0,
                bear: 0,
                neutral: 0,
                returns: [],
                volumes: []
            });
        }

        chartCandles.forEach(c => {
            const d = dayjs(c.date || (typeof c.time === 'number' ? c.time * 1000 : c.time));
            const h = d.hour();
            const slot = hourlyMap.get(h);
            if (slot) {
                slot.total += 1;
                const ret = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0;
                slot.returns.push(ret);
                slot.volumes.push(c.volume || 0);
                if (c.close > c.open) slot.bull += 1;
                else if (c.close < c.open) slot.bear += 1;
                else slot.neutral += 1;
            }
        });

        const activeHours = Array.from(hourlyMap.values())
            .filter(slot => slot.total > 0)
            .map(slot => {
                const bullRate = slot.total > 0 ? (slot.bull / slot.total) * 100 : 0;
                const avgRet = slot.returns.length > 0 ? slot.returns.reduce((a, b) => a + b, 0) / slot.returns.length : 0;
                const avgVol = slot.volumes.length > 0 ? slot.volumes.reduce((a, b) => a + b, 0) / slot.volumes.length : 0;
                return {
                    ...slot,
                    label: `${String(slot.hour).padStart(2, '0')}:00`,
                    bullRate: parseFloat(bullRate.toFixed(1)),
                    bearRate: parseFloat((100 - bullRate).toFixed(1)),
                    avgRet: parseFloat(avgRet.toFixed(2)),
                    avgVol: Math.round(avgVol)
                };
            });

        if (activeHours.length === 0) return null;

        // Best Bull Hour & Best Bear Hour
        const bestBullHour = [...activeHours].sort((a, b) => b.bullRate - a.bullRate)[0];
        const bestBearHour = [...activeHours].sort((a, b) => b.bearRate - a.bearRate)[0];
        const highestVolHour = [...activeHours].sort((a, b) => b.avgVol - a.avgVol)[0];
        const highestReturnHour = [...activeHours].sort((a, b) => b.avgRet - a.avgRet)[0];

        return {
            activeHours,
            bestBullHour,
            bestBearHour,
            highestVolHour,
            highestReturnHour,
            totalCandles: chartCandles.length
        };
    }, [chartCandles]);

    // ==========================================
    // 3. STATS: WEEK (Day of Week Distribution)
    // ==========================================
    const weekStats = useMemo(() => {
        if (!chartCandles || chartCandles.length === 0) return null;

        // Group by day of week (0: CN, 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7)
        const weekMap = new Map();
        for (let d = 0; d < 7; d++) {
            weekMap.set(d, {
                dayIdx: d,
                dayName: WEEKDAY_NAMES[d],
                total: 0,
                bull: 0,
                bear: 0,
                returns: [],
                spreads: [],
                volumes: []
            });
        }

        chartCandles.forEach(c => {
            const dt = dayjs(c.date || (typeof c.time === 'number' ? c.time * 1000 : c.time));
            const dayIdx = dt.day();
            const slot = weekMap.get(dayIdx);
            if (slot) {
                slot.total += 1;
                const ret = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0;
                const spread = c.low > 0 ? ((c.high - c.low) / c.low) * 100 : 0;
                slot.returns.push(ret);
                slot.spreads.push(spread);
                slot.volumes.push(c.volume || 0);
                if (c.close >= c.open) slot.bull += 1;
                else slot.bear += 1;
            }
        });

        // Reorder Mon (1) to Sun (0)
        const orderedDays = [1, 2, 3, 4, 5, 6, 0].map(d => weekMap.get(d)).filter(slot => slot.total > 0);

        const days = orderedDays.map(slot => {
            const bullRate = slot.total > 0 ? (slot.bull / slot.total) * 100 : 0;
            const avgRet = slot.returns.length > 0 ? slot.returns.reduce((a, b) => a + b, 0) / slot.returns.length : 0;
            const avgSpread = slot.spreads.length > 0 ? slot.spreads.reduce((a, b) => a + b, 0) / slot.spreads.length : 0;
            const avgVol = slot.volumes.length > 0 ? slot.volumes.reduce((a, b) => a + b, 0) / slot.volumes.length : 0;
            return {
                ...slot,
                bullRate: parseFloat(bullRate.toFixed(1)),
                bearRate: parseFloat((100 - bullRate).toFixed(1)),
                avgRet: parseFloat(avgRet.toFixed(2)),
                avgSpread: parseFloat(avgSpread.toFixed(2)),
                avgVol: Math.round(avgVol)
            };
        });

        if (days.length === 0) return null;

        const bestBullDay = [...days].sort((a, b) => b.bullRate - a.bullRate)[0];
        const bestBearDay = [...days].sort((a, b) => b.bearRate - a.bearRate)[0];
        const highestReturnDay = [...days].sort((a, b) => b.avgRet - a.avgRet)[0];
        const highestVolDay = [...days].sort((a, b) => b.avgVol - a.avgVol)[0];

        return {
            days,
            bestBullDay,
            bestBearDay,
            highestReturnDay,
            highestVolDay,
            totalDays: chartCandles.length
        };
    }, [chartCandles]);

    // ==========================================
    // 4. STATS: YEAR (Month of Year Seasonality)
    // ==========================================
    const yearStats = useMemo(() => {
        if (!chartCandles || chartCandles.length === 0) return null;

        // Group by month (0 to 11)
        const monthMap = new Map();
        for (let m = 0; m < 12; m++) {
            monthMap.set(m, {
                monthIdx: m,
                monthName: MONTH_NAMES[m],
                total: 0,
                bull: 0,
                bear: 0,
                returns: [],
                volumes: []
            });
        }

        chartCandles.forEach(c => {
            const dt = dayjs(c.date || (typeof c.time === 'number' ? c.time * 1000 : c.time));
            const m = dt.month();
            const slot = monthMap.get(m);
            if (slot) {
                slot.total += 1;
                const ret = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0;
                slot.returns.push(ret);
                slot.volumes.push(c.volume || 0);
                if (c.close >= c.open) slot.bull += 1;
                else slot.bear += 1;
            }
        });

        const months = Array.from(monthMap.values()).map(slot => {
            const bullRate = slot.total > 0 ? (slot.bull / slot.total) * 100 : 0;
            const avgRet = slot.returns.length > 0 ? slot.returns.reduce((a, b) => a + b, 0) / slot.returns.length : 0;
            const maxRet = slot.returns.length > 0 ? Math.max(...slot.returns) : 0;
            const minRet = slot.returns.length > 0 ? Math.min(...slot.returns) : 0;
            const avgVol = slot.volumes.length > 0 ? slot.volumes.reduce((a, b) => a + b, 0) / slot.volumes.length : 0;
            return {
                ...slot,
                bullRate: parseFloat(bullRate.toFixed(1)),
                bearRate: parseFloat((100 - bullRate).toFixed(1)),
                avgRet: parseFloat(avgRet.toFixed(2)),
                maxRet: parseFloat(maxRet.toFixed(2)),
                minRet: parseFloat(minRet.toFixed(2)),
                avgVol: Math.round(avgVol)
            };
        });

        const activeMonths = months.filter(m => m.total > 0);
        if (activeMonths.length === 0) return null;

        const bestMonth = [...activeMonths].sort((a, b) => b.avgRet - a.avgRet)[0];
        const worstMonth = [...activeMonths].sort((a, b) => a.avgRet - b.avgRet)[0];
        const highestWinMonth = [...activeMonths].sort((a, b) => b.bullRate - a.bullRate)[0];

        return {
            months,
            activeMonths,
            bestMonth,
            worstMonth,
            highestWinMonth,
            totalPeriods: chartCandles.length
        };
    }, [chartCandles]);

    // ==========================================
    // ECharts Configurations for the 4 Modes
    // ==========================================
    // 1. Spread Histogram Option (Supports Price Range and Percent Range with Gaussian Bell Curve)
    const spreadBucketOption = useMemo(() => {
        if (!spreadStats) return {};
        const isPrice = spreadViewUnit === 'price';
        const buckets = isPrice ? spreadStats.priceBuckets : spreadStats.percentBuckets;
        const categories = (buckets || []).map(b => b.label);
        const data = (buckets || []).map(b => b.count);
        const total = spreadStats.total || 1;

        // Calculate Bell Curve (Gaussian Density Distribution)
        const mean = isPrice ? spreadStats.avgPrice : spreadStats.avgPercent;
        const std = (isPrice ? spreadStats.stdPrice : spreadStats.stdPercent) || 0.001;

        const rawGaussian = (buckets || []).map(b => {
            const z = (b.mid - mean) / std;
            const pdf = (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
            return pdf * (b.width || 1);
        });
        const sumG = rawGaussian.reduce((a, b) => a + b, 0) || 1;
        const bellCurvePercents = rawGaussian.map(g => parseFloat(((g / sumG) * 100).toFixed(1)));

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: '#1f2937',
                borderColor: '#374151',
                textStyle: { color: '#f3f4f6' },
                formatter: (params) => {
                    let res = `<b>${isPrice ? 'Khoảng giá' : 'Biên độ %'}: ${params[0].name}</b><br/>`;
                    params.forEach(p => {
                        const suffix = p.seriesIndex === 1
                            ? `% (Phân phối chuẩn lý thuyết)`
                            : ` nến (${((p.value / total) * 100).toFixed(1)}% thực tế)`;
                        res += `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${p.value}${suffix}</b><br/>`;
                    });
                    return res;
                }
            },
            legend: {
                data: ['Số nến thực tế', 'Đường cong Chuông Chuẩn (Bell Curve)'],
                textStyle: { color: '#9ca3af', fontSize: 12 },
                top: 0
            },
            grid: { left: '3%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { color: '#d1d5db', fontSize: 11, fontWeight: 'bold' },
                axisLine: { lineStyle: { color: '#4b5563' } }
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Số nến (Thực tế)',
                    nameTextStyle: { color: '#9ca3af' },
                    axisLabel: { color: '#9ca3af' },
                    splitLine: { lineStyle: { color: '#1f2937' } }
                },
                {
                    type: 'value',
                    name: 'Tỷ lệ Chuông (%)',
                    nameTextStyle: { color: '#9ca3af' },
                    axisLabel: { color: '#9ca3af', formatter: '{value}%' },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Số nến thực tế',
                    type: 'bar',
                    data: data,
                    barWidth: '38%',
                    label: {
                        show: true,
                        position: 'top',
                        color: isPrice ? '#38bdf8' : '#fbbf24',
                        fontWeight: 'bold',
                        fontSize: 12,
                        formatter: '{c}'
                    },
                    itemStyle: {
                        borderRadius: [6, 6, 0, 0],
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: isPrice
                                ? [
                                    { offset: 0, color: '#38bdf8' },
                                    { offset: 1, color: '#0284c7' }
                                ]
                                : [
                                    { offset: 0, color: '#f59e0b' },
                                    { offset: 1, color: '#b45309' }
                                ]
                        }
                    }
                },
                {
                    name: 'Đường cong Chuông Chuẩn (Bell Curve)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: bellCurvePercents,
                    smooth: 0.5,
                    symbol: 'circle',
                    symbolSize: 6,
                    itemStyle: { color: isPrice ? '#f43f5e' : '#38bdf8' },
                    lineStyle: { width: 3, color: isPrice ? '#f43f5e' : '#38bdf8' },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: isPrice
                                ? [
                                    { offset: 0, color: 'rgba(244, 63, 94, 0.25)' },
                                    { offset: 1, color: 'rgba(244, 63, 94, 0.02)' }
                                ]
                                : [
                                    { offset: 0, color: 'rgba(56, 189, 248, 0.25)' },
                                    { offset: 1, color: 'rgba(56, 189, 248, 0.02)' }
                                ]
                        }
                    }
                }
            ]
        };
    }, [spreadStats, spreadViewUnit]);

    // 1.2 Spread Timeline Option
    const spreadTimelineOption = useMemo(() => {
        if (!spreadStats?.spreadsTimeline) return {};
        const isPrice = spreadViewUnit === 'price';
        const categories = spreadStats.spreadsTimeline.map(s => {
            const dt = dayjs(s.date || (typeof s.time === 'number' ? s.time * 1000 : s.time));
            return dt.isValid() ? dt.format('DD/MM HH:mm') : (s.date || s.time);
        });
        const data = spreadStats.spreadsTimeline.map(s =>
            isPrice ? parseFloat(s.priceSpread.toFixed(2)) : parseFloat(s.percentSpread.toFixed(2))
        );
        const avg = isPrice ? parseFloat(spreadStats.avgPrice.toFixed(2)) : parseFloat(spreadStats.avgPercent.toFixed(2));
        const p90 = isPrice ? parseFloat(spreadStats.p90Price.toFixed(2)) : parseFloat(spreadStats.p90Percent.toFixed(2));

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: '#1f2937',
                borderColor: '#374151',
                textStyle: { color: '#f3f4f6' },
                formatter: (params) => {
                    const p = params[0];
                    const item = spreadStats.spreadsTimeline[p.dataIndex];
                    return `<b>${p.name}</b><br/>` +
                        `<span style="color:#38bdf8">●</span> Khoảng giá (High - Low): <b>${formatNumber(item?.priceSpread || 0)}</b><br/>` +
                        `<span style="color:#f59e0b">●</span> Tỷ lệ Spread (%): <b>${(item?.percentSpread || 0).toFixed(2)}%</b><br/>` +
                        `<span style="color:#9ca3af">●</span> Thân nến (|Close - Open|): <b>${formatNumber(item?.bodyPrice || 0)}</b> (${(item?.bodyPercent || 0).toFixed(2)}%)`;
                }
            },
            grid: { left: '3%', right: '3%', bottom: '12%', top: '15%', containLabel: true },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { color: '#9ca3af', fontSize: 10, interval: Math.floor(categories.length / 10) },
                axisLine: { lineStyle: { color: '#374151' } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: '#9ca3af',
                    formatter: isPrice ? (val) => formatNumber(val) : '{value}%'
                },
                splitLine: { lineStyle: { color: '#1f2937' } }
            },
            series: [
                {
                    name: isPrice ? 'Biên độ Nến (Khoảng giá)' : 'Biên độ Nến (%)',
                    type: 'line',
                    data: data,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 2, color: isPrice ? '#38bdf8' : '#f59e0b' },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: isPrice
                                ? [
                                    { offset: 0, color: 'rgba(56, 189, 248, 0.35)' },
                                    { offset: 1, color: 'rgba(56, 189, 248, 0.02)' }
                                ]
                                : [
                                    { offset: 0, color: 'rgba(245, 158, 11, 0.35)' },
                                    { offset: 1, color: 'rgba(245, 158, 11, 0.02)' }
                                ]
                        }
                    },
                    markLine: {
                        silent: true,
                        data: [
                            {
                                yAxis: avg,
                                lineStyle: { color: '#38bdf8', type: 'dashed' },
                                label: {
                                    formatter: `TB: ${isPrice ? formatNumber(avg) : avg + '%'}`,
                                    color: '#38bdf8',
                                    position: 'end'
                                }
                            },
                            {
                                yAxis: p90,
                                lineStyle: { color: '#f43f5e', type: 'dotted' },
                                label: {
                                    formatter: `P90: ${isPrice ? formatNumber(p90) : p90 + '%'}`,
                                    color: '#f43f5e',
                                    position: 'end'
                                }
                            }
                        ]
                    }
                }
            ]
        };
    }, [spreadStats, spreadViewUnit]);

    // 2. Intraday Hourly Chart Option
    const intradayChartOption = useMemo(() => {
        if (!intradayStats) return {};
        const categories = intradayStats.activeHours.map(h => h.label);
        const bullData = intradayStats.activeHours.map(h => h.bull);
        const bearData = intradayStats.activeHours.map(h => h.bear);
        const winRates = intradayStats.activeHours.map(h => h.bullRate);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: '#1f2937',
                borderColor: '#374151',
                textStyle: { color: '#f3f4f6' }
            },
            legend: {
                data: ['Nến Tăng (Bull)', 'Nến Giảm (Bear)', 'Tỷ lệ Tăng (%)'],
                textStyle: { color: '#9ca3af' },
                top: 0
            },
            grid: { left: '3%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { color: '#9ca3af', fontSize: 11 },
                axisLine: { lineStyle: { color: '#374151' } }
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Số nến',
                    nameTextStyle: { color: '#9ca3af' },
                    axisLabel: { color: '#9ca3af' },
                    splitLine: { lineStyle: { color: '#1f2937' } }
                },
                {
                    type: 'value',
                    name: 'Tỷ lệ Tăng %',
                    nameTextStyle: { color: '#9ca3af' },
                    min: 0,
                    max: 100,
                    axisLabel: { color: '#9ca3af', formatter: '{value}%' },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Nến Tăng (Bull)',
                    type: 'bar',
                    stack: 'candles',
                    data: bullData,
                    itemStyle: { color: '#10b981' }
                },
                {
                    name: 'Nến Giảm (Bear)',
                    type: 'bar',
                    stack: 'candles',
                    data: bearData,
                    itemStyle: { color: '#ef4444' }
                },
                {
                    name: 'Tỷ lệ Tăng (%)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: winRates,
                    smooth: true,
                    itemStyle: { color: '#38bdf8' },
                    lineStyle: { width: 3, color: '#38bdf8' }
                }
            ]
        };
    }, [intradayStats]);

    // 3. Week Day Chart Option
    const weekChartOption = useMemo(() => {
        if (!weekStats) return {};
        const categories = weekStats.days.map(d => d.dayName);
        const retData = weekStats.days.map(d => d.avgRet);
        const winRates = weekStats.days.map(d => d.bullRate);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: '#1f2937',
                borderColor: '#374151',
                textStyle: { color: '#f3f4f6' }
            },
            legend: {
                data: ['Lợi nhuận TB (%)', 'Xác suất Tăng (%)'],
                textStyle: { color: '#9ca3af' },
                top: 0
            },
            grid: { left: '3%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { color: '#9ca3af', fontSize: 12, fontWeight: 'bold' },
                axisLine: { lineStyle: { color: '#374151' } }
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Lợi nhuận TB (%)',
                    nameTextStyle: { color: '#9ca3af' },
                    axisLabel: { color: '#9ca3af', formatter: '{value}%' },
                    splitLine: { lineStyle: { color: '#1f2937' } }
                },
                {
                    type: 'value',
                    name: 'Xác suất Tăng %',
                    nameTextStyle: { color: '#9ca3af' },
                    min: 0,
                    max: 100,
                    axisLabel: { color: '#9ca3af', formatter: '{value}%' },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Lợi nhuận TB (%)',
                    type: 'bar',
                    data: retData.map(val => ({
                        value: val,
                        itemStyle: {
                            color: val >= 0 ? '#10b981' : '#ef4444',
                            borderRadius: val >= 0 ? [6, 6, 0, 0] : [0, 0, 6, 6]
                        }
                    })),
                    barWidth: '35%'
                },
                {
                    name: 'Xác suất Tăng (%)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: winRates,
                    smooth: true,
                    itemStyle: { color: '#f59e0b' },
                    lineStyle: { width: 3, color: '#f59e0b' }
                }
            ]
        };
    }, [weekStats]);

    // 4. Year Seasonality Chart Option
    const yearChartOption = useMemo(() => {
        if (!yearStats) return {};
        const categories = yearStats.months.map(m => m.monthName);
        const retData = yearStats.months.map(m => m.avgRet);
        const winRates = yearStats.months.map(m => m.bullRate);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: '#1f2937',
                borderColor: '#374151',
                textStyle: { color: '#f3f4f6' }
            },
            legend: {
                data: ['Lợi nhuận Mùa vụ TB (%)', 'Xác suất Tháng Dương (%)'],
                textStyle: { color: '#9ca3af' },
                top: 0
            },
            grid: { left: '3%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { color: '#9ca3af', fontSize: 11, interval: 0, rotate: 20 },
                axisLine: { lineStyle: { color: '#374151' } }
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Lợi nhuận (%)',
                    nameTextStyle: { color: '#9ca3af' },
                    axisLabel: { color: '#9ca3af', formatter: '{value}%' },
                    splitLine: { lineStyle: { color: '#1f2937' } }
                },
                {
                    type: 'value',
                    name: 'Xác suất Tăng %',
                    nameTextStyle: { color: '#9ca3af' },
                    min: 0,
                    max: 100,
                    axisLabel: { color: '#9ca3af', formatter: '{value}%' },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Lợi nhuận Mùa vụ TB (%)',
                    type: 'bar',
                    data: retData.map(val => ({
                        value: val,
                        itemStyle: {
                            color: val >= 0 ? '#0ea5e9' : '#f43f5e',
                            borderRadius: val >= 0 ? [6, 6, 0, 0] : [0, 0, 6, 6]
                        }
                    })),
                    barWidth: '40%'
                },
                {
                    name: 'Xác suất Tháng Dương (%)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: winRates,
                    smooth: true,
                    itemStyle: { color: '#10b981' },
                    lineStyle: { width: 3, color: '#10b981' }
                }
            ]
        };
    }, [yearStats]);

    const activeInsightObj = INSIGHT_MODES.find(m => m.id === insightMode) || INSIGHT_MODES[0];
    const ActiveInsightIcon = activeInsightObj.icon;

    return (
        <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-800/90 backdrop-blur-md p-4 rounded-2xl border border-gray-700/80 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 shrink-0">
                        <Compass size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent">
                                Strategy Insight
                            </h1>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                Statistical Distribution
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Phân tích Spread, chu kỳ Intraday trong ngày, ngày trong tuần và mùa vụ năm
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {selectedAccount && (
                        <div className="px-3 py-1.5 rounded-xl bg-gray-900/80 border border-gray-700/80 text-xs flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-gray-400">Account:</span>
                            <span className="font-semibold text-gray-200">{selectedAccount.Name || selectedAccount.name}</span>
                        </div>
                    )}
                    <Link
                        to="/python-strategy"
                        className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                        <BrainCircuit size={14} />
                        <span>Python Backtest</span>
                    </Link>
                </div>
            </div>

            {/* Filter & Control Bar */}
            <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-700/70 p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-gray-700/60 pb-2.5">
                    <div className="flex items-center gap-2">
                        <Layers size={16} className="text-cyan-400" />
                        <h2 className="text-sm font-bold text-gray-200 tracking-wide uppercase">
                            Watchlist & Symbol Selection
                        </h2>
                    </div>
                    {selectedSymbol && (
                        <span className="text-xs text-cyan-400 font-mono font-bold bg-cyan-500/10 px-2.5 py-0.5 rounded-lg border border-cyan-500/20">
                            {selectedSymbol} • {timeframe}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                    {/* 1. Account Watchlist */}
                    <div className="lg:col-span-3 space-y-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                            <Layers size={14} className="text-blue-400" />
                            Account Watchlist
                        </label>
                        <select
                            value={selectedWatchlistId}
                            onChange={(e) => {
                                const newWlId = e.target.value;
                                setSelectedWatchlistId(newWlId);
                                setSelectedSymbol('');
                                setScanResult(null);
                            }}
                            className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition cursor-pointer"
                        >
                            <option value="">-- Tất cả Symbol --</option>
                            {accountWatchlists.map(wl => (
                                <option key={wl.documentId || wl.id} value={wl.documentId || wl.id}>
                                    {wl.name || wl.Name} ({wl.symbols?.length || 0})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Symbol trong Watchlist */}
                    <div className="lg:col-span-3 space-y-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                            <ListFilter size={14} className="text-emerald-400" />
                            Symbol trong Watchlist
                        </label>
                        <select
                            value={selectedSymbol}
                            onChange={(e) => {
                                const newSym = e.target.value;
                                setSelectedSymbol(newSym);
                                setCountback(1000);
                                setHasMore(true);
                                if (newSym) {
                                    handleLoadInsight(newSym, 1000, timeframe);
                                } else {
                                    setScanResult(null);
                                }
                            }}
                            className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition cursor-pointer font-semibold uppercase"
                        >
                            <option value="">-- Chọn Symbol --</option>
                            {watchlistSymbols.map((sym, idx) => (
                                <option key={`${sym}-${idx}`} value={sym}>
                                    {sym}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Timeframe Selector */}
                    <div className="lg:col-span-3 space-y-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                            <Clock size={14} className="text-amber-400" />
                            Timeframe
                        </label>
                        <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-xl p-1">
                            {TIMEFRAME_OPTIONS.map(tf => (
                                <button
                                    key={tf.value}
                                    type="button"
                                    onClick={() => {
                                        setTimeframe(tf.value);
                                        setCountback(1000);
                                        setHasMore(true);
                                        if (selectedSymbol) {
                                            handleLoadInsight(selectedSymbol, 1000, tf.value);
                                        }
                                    }}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${timeframe === tf.value
                                        ? 'bg-amber-500 text-gray-950 shadow-md font-extrabold'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                        }`}
                                    title={tf.desc}
                                >
                                    {tf.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-sm text-red-300 flex items-center gap-2.5">
                    <AlertTriangle size={18} className="text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Quick Metrics Bar (when symbol data exists) */}
            {lastCandle && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">Giá hiện tại</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold text-white font-mono">{formatNumber(lastCandle.close)}</span>
                            <span className={`text-xs font-bold ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {priceChange >= 0 ? `+${priceChange.toFixed(2)}%` : `${priceChange.toFixed(2)}%`}
                            </span>
                        </div>
                    </div>

                    <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">Khối lượng (Volume)</span>
                        <span className="text-lg font-bold text-cyan-300 font-mono">
                            {formatNumber(lastCandle.volume || 0)}
                        </span>
                    </div>

                    <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">Biên độ Nến cuối (Spread)</span>
                        <div className="text-xs font-mono font-bold text-amber-400">
                            {formatNumber(lastCandle.high - lastCandle.low)} ({(((lastCandle.high - lastCandle.low) / (lastCandle.low || 1)) * 100).toFixed(2)}%)
                        </div>
                    </div>

                    <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">Số nến đã nạp</span>
                        <span className="text-lg font-bold text-gray-200">
                            {chartCandles.length} nến
                        </span>
                    </div>

                    <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">Phân tích Insight</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border inline-block ${activeInsightObj.badgeBg}`}>
                            {activeInsightObj.label} Mode
                        </span>
                    </div>

                    <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-xs text-gray-400 block mb-0.5">Mở giao dịch</span>
                            <span className="text-xs text-gray-300 font-semibold">{selectedSymbol}</span>
                        </div>
                        <Link
                            to={`/trade-station?symbol=${encodeURIComponent(selectedSymbol)}&price=${lastCandle.close}`}
                            className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl transition border border-blue-500/30"
                            title="Mở trên Trade Station"
                        >
                            <ExternalLink size={16} />
                        </Link>
                    </div>
                </div>
            )}

            {/* Box 1: Hiển Thị Chart (TradingView Candlestick Chart) */}
            <div ref={chartCardRef} className="bg-gray-800 rounded-2xl border border-gray-700/80 p-4 shadow-xl flex flex-col space-y-3">
                {/* Chart Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-700/60 pb-3 gap-2">
                    <div className="flex items-center gap-2">
                        <Activity size={18} className="text-cyan-400" />
                        <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                            <span>Biểu đồ Nến & Khối lượng</span>
                            {selectedSymbol ? (
                                <span className="text-cyan-400 font-mono">({selectedSymbol} - {timeframe})</span>
                            ) : (
                                <span className="text-gray-500 text-xs font-normal">(Chưa chọn mã)</span>
                            )}
                        </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Nến Tăng (Bull)
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Nến Giảm (Bear)
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span> Khối lượng (Volume)
                        </span>
                    </div>
                </div>

                {/* Chart Canvas */}
                <div className="h-[480px] w-full relative rounded-xl overflow-hidden bg-gray-900 border border-gray-800">
                    {scanning ? (
                        <div className="h-full w-full flex flex-col items-center justify-center space-y-3">
                            <RefreshCw size={36} className="text-cyan-400 animate-spin" />
                            <p className="text-sm text-gray-400">Đang nạp dữ liệu biểu đồ nến...</p>
                        </div>
                    ) : chartCandles.length > 0 ? (
                        <TradingViewChart
                            data={chartCandles}
                            symbol={selectedSymbol}
                            signals={[]}
                            template={null}
                            timeframe={timeframe}
                            onLoadMore={handleLoadMore}
                            isLoadingMore={loadingMore}
                            hasMore={hasMore}
                        />
                    ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-gray-500 space-y-3 p-6 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gray-800/80 border border-gray-700/80 flex items-center justify-center text-gray-400 shadow-inner">
                                <Compass size={32} className="opacity-60" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-300">Chưa có dữ liệu biểu đồ</h3>
                                <p className="text-xs text-gray-400 mt-1 max-w-md">
                                    Vui lòng chọn <b>Account Watchlist</b> và <b>Symbol trong Watchlist</b> ở trên để hiển thị biểu đồ nến và các thống kê phân tích Insight.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Box 2: Insight Deep-dive Analysis Panels (Spread, Intraday, Week, Year) */}
            {chartCandles.length > 0 && (
                <div className="bg-gray-800 rounded-2xl border border-gray-700/80 p-5 shadow-xl space-y-5">
                    {/* Insight Panel Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-700/60 pb-3 gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl bg-gray-900 border border-gray-700 ${activeInsightObj.color}`}>
                                <ActiveInsightIcon size={20} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                    <span>Thống kê Insight: {activeInsightObj.label}</span>
                                    <span className="text-xs font-semibold text-gray-400">({selectedSymbol} • {timeframe})</span>
                                </h2>
                                <p className="text-xs text-gray-400">{activeInsightObj.desc}</p>
                            </div>
                        </div>

                        {/* Quick switch tabs */}
                        <div className="flex items-center bg-gray-900 p-1 rounded-xl border border-gray-700 gap-1">
                            {INSIGHT_MODES.map(mode => {
                                const Icon = mode.icon;
                                const isActive = insightMode === mode.id;
                                return (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        onClick={() => setInsightMode(mode.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${isActive
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                            }`}
                                    >
                                        <Icon size={14} className={isActive ? 'text-white' : mode.color} />
                                        <span>{mode.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ========================================== */}
                    {/* 1. SPREAD INSIGHT VIEW                     */}
                    {/* ========================================== */}
                    {insightMode === 'spread' && spreadStats && (
                        <div className="space-y-4">
                            {/* Unit Mode Switcher & Insight Subheader */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-900/60 p-3 rounded-xl border border-gray-700/60 gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Đơn vị hiển thị thống kê:</span>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                            {spreadViewUnit === 'price' ? 'Biên độ Khoảng Giá (High - Low)' : 'Tỷ lệ Phần trăm (%)'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        Chọn xem phân phối theo <b>Khoảng giá (Điểm / Giá trị tuyệt đối)</b> hoặc <b>Tỷ lệ biến động %</b>
                                    </p>
                                </div>
                                <div className="flex items-center bg-gray-950 p-1 rounded-lg border border-gray-700/80 gap-1 self-start sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => setSpreadViewUnit('price')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${spreadViewUnit === 'price'
                                            ? 'bg-sky-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                            }`}
                                    >
                                        <BarChart2 size={13} />
                                        <span>Khoảng Giá (Price Range)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSpreadViewUnit('percent')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${spreadViewUnit === 'percent'
                                            ? 'bg-amber-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                            }`}
                                    >
                                        <Percent size={13} />
                                        <span>Tỷ lệ Phần trăm (%)</span>
                                    </button>
                                </div>
                            </div>

                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5">
                                    <span className="text-xs text-gray-400 block mb-1">Spread Trung bình</span>
                                    <span className="text-lg font-bold text-amber-400 font-mono block">
                                        {spreadViewUnit === 'price' ? formatNumber(spreadStats.avgPrice) : `${spreadStats.avgPercent.toFixed(2)}%`}
                                    </span>
                                    <span className="text-[11px] text-gray-500 block mt-0.5 font-mono">
                                        {spreadViewUnit === 'price' ? `~${spreadStats.avgPercent.toFixed(2)}%` : `~${formatNumber(spreadStats.avgPrice)}`}
                                    </span>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5">
                                    <span className="text-xs text-gray-400 block mb-1">Spread Trung vị (P50)</span>
                                    <span className="text-lg font-bold text-sky-400 font-mono block">
                                        {spreadViewUnit === 'price' ? formatNumber(spreadStats.medianPrice) : `${spreadStats.medianPercent.toFixed(2)}%`}
                                    </span>
                                    <span className="text-[11px] text-gray-500 block mt-0.5 font-mono">
                                        {spreadViewUnit === 'price' ? `~${spreadStats.medianPercent.toFixed(2)}%` : `~${formatNumber(spreadStats.medianPrice)}`}
                                    </span>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5">
                                    <span className="text-xs text-gray-400 block mb-1">Biên độ Hẹp nhất (Min)</span>
                                    <span className="text-lg font-bold text-emerald-400 font-mono block">
                                        {spreadViewUnit === 'price' ? formatNumber(spreadStats.minPrice) : `${spreadStats.minPercent.toFixed(2)}%`}
                                    </span>
                                    <span className="text-[11px] text-gray-500 block mt-0.5 font-mono">
                                        {spreadViewUnit === 'price' ? `~${spreadStats.minPercent.toFixed(2)}%` : `~${formatNumber(spreadStats.minPrice)}`}
                                    </span>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5">
                                    <span className="text-xs text-gray-400 block mb-1">Biên độ Rộng nhất (Max)</span>
                                    <span className="text-lg font-bold text-rose-400 font-mono block">
                                        {spreadViewUnit === 'price' ? formatNumber(spreadStats.maxPrice) : `${spreadStats.maxPercent.toFixed(2)}%`}
                                    </span>
                                    <span className="text-[11px] text-gray-500 block mt-0.5 font-mono">
                                        {spreadViewUnit === 'price' ? `~${spreadStats.maxPercent.toFixed(2)}%` : `~${formatNumber(spreadStats.maxPrice)}`}
                                    </span>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5">
                                    <span className="text-xs text-gray-400 block mb-1">Phân vị 90% (P90)</span>
                                    <span className="text-lg font-bold text-purple-400 font-mono block">
                                        {spreadViewUnit === 'price' ? formatNumber(spreadStats.p90Price) : `${spreadStats.p90Percent.toFixed(2)}%`}
                                    </span>
                                    <span className="text-[11px] text-gray-500 block mt-0.5 font-mono">
                                        {spreadViewUnit === 'price' ? `~${spreadStats.p90Percent.toFixed(2)}%` : `~${formatNumber(spreadStats.p90Price)}`}
                                    </span>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5">
                                    <span className="text-xs text-gray-400 block mb-1">Phân vị 99% (P99)</span>
                                    <span className="text-lg font-bold text-fuchsia-400 font-mono block">
                                        {spreadViewUnit === 'price' ? formatNumber(spreadStats.p99Price) : `${spreadStats.p99Percent.toFixed(2)}%`}
                                    </span>
                                    <span className="text-[11px] text-gray-500 block mt-0.5 font-mono">
                                        {spreadViewUnit === 'price' ? `~${spreadStats.p99Percent.toFixed(2)}%` : `~${formatNumber(spreadStats.p99Price)}`}
                                    </span>
                                </div>
                            </div>

                            {/* Spread Histogram Chart & Percentiles Table */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-2 bg-gray-900/70 border border-gray-700/60 rounded-xl p-4 flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                            <BarChart3 size={16} className={spreadViewUnit === 'price' ? 'text-sky-400' : 'text-amber-400'} />
                                            <span>
                                                Phân phối Tần suất & Đường cong Chuông Chuẩn (Bell Curve) {spreadViewUnit === 'price' ? '(Khoảng Giá)' : '(Tỷ lệ %)'}
                                            </span>
                                        </h3>
                                        <span className="text-xs text-gray-400">
                                            Tổng: <b className="text-white">{spreadStats.total}</b> nến
                                        </span>
                                    </div>
                                    <div className="h-[400px] w-full">
                                        <ReactECharts option={spreadBucketOption} style={{ height: '100%', width: '100%' }} />
                                    </div>
                                </div>

                                <div className="bg-gray-900/70 border border-gray-700/60 rounded-xl p-4 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                                            <Percent size={16} className="text-cyan-400" />
                                            <span>Bảng Phân vị Biên độ Nến chi tiết</span>
                                        </h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                                <thead>
                                                    <tr className="border-b border-gray-800 text-gray-400 text-[11px]">
                                                        <th className="py-2 font-semibold">Phân vị</th>
                                                        <th className="py-2 font-semibold text-right text-sky-300">Khoảng giá</th>
                                                        <th className="py-2 font-semibold text-right text-amber-300">Tỷ lệ (%)</th>
                                                        <th className="py-2 font-semibold text-right text-gray-400">Mô tả</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800/60 font-mono">
                                                    <tr className="hover:bg-gray-800/30 transition">
                                                        <td className="py-2 text-emerald-400 font-semibold font-sans">Min (Tối thiểu)</td>
                                                        <td className="py-2 text-right text-sky-400 font-bold">{formatNumber(spreadStats.minPrice)}</td>
                                                        <td className="py-2 text-right text-amber-400">{spreadStats.minPercent.toFixed(2)}%</td>
                                                        <td className="py-2 text-right text-gray-400 font-sans text-[11px]">Nén giá tối đa</td>
                                                    </tr>
                                                    <tr className="hover:bg-gray-800/30 transition">
                                                        <td className="py-2 text-gray-300 font-sans">25% (P25 - Hẹp)</td>
                                                        <td className="py-2 text-right text-sky-300">{formatNumber(spreadStats.p25Price)}</td>
                                                        <td className="py-2 text-right text-amber-300">{spreadStats.p25Percent.toFixed(2)}%</td>
                                                        <td className="py-2 text-right text-gray-400 font-sans text-[11px]">25% nến hẹp hơn</td>
                                                    </tr>
                                                    <tr className="bg-sky-500/10 hover:bg-sky-500/15 transition">
                                                        <td className="py-2 text-sky-300 font-bold font-sans">50% (P50 - Trung vị)</td>
                                                        <td className="py-2 text-right text-sky-300 font-bold text-sm">{formatNumber(spreadStats.medianPrice)}</td>
                                                        <td className="py-2 text-right text-amber-300 font-bold text-sm">{spreadStats.medianPercent.toFixed(2)}%</td>
                                                        <td className="py-2 text-right text-sky-300 font-sans font-bold text-[11px]">Biên độ chuẩn</td>
                                                    </tr>
                                                    <tr className="hover:bg-gray-800/30 transition">
                                                        <td className="py-2 text-gray-300 font-sans">75% (P75 - Rộng)</td>
                                                        <td className="py-2 text-right text-sky-300">{formatNumber(spreadStats.p75Price)}</td>
                                                        <td className="py-2 text-right text-amber-300">{spreadStats.p75Percent.toFixed(2)}%</td>
                                                        <td className="py-2 text-right text-gray-400 font-sans text-[11px]">75% nến dưới mức</td>
                                                    </tr>
                                                    <tr className="hover:bg-gray-800/30 transition">
                                                        <td className="py-2 text-amber-300 font-semibold font-sans">90% (P90 - Rất rộng)</td>
                                                        <td className="py-2 text-right text-sky-300 font-bold">{formatNumber(spreadStats.p90Price)}</td>
                                                        <td className="py-2 text-right text-amber-400 font-bold">{spreadStats.p90Percent.toFixed(2)}%</td>
                                                        <td className="py-2 text-right text-amber-400/80 font-sans text-[11px]">Biến động mạnh</td>
                                                    </tr>
                                                    <tr className="hover:bg-gray-800/30 transition">
                                                        <td className="py-2 text-rose-300 font-semibold font-sans">99% (P99 - Đột biến)</td>
                                                        <td className="py-2 text-right text-rose-400 font-bold">{formatNumber(spreadStats.p99Price)}</td>
                                                        <td className="py-2 text-right text-rose-400 font-bold">{spreadStats.p99Percent.toFixed(2)}%</td>
                                                        <td className="py-2 text-right text-rose-400/80 font-sans text-[11px]">Ngoại lai / Tin tức</td>
                                                    </tr>
                                                    <tr className="hover:bg-gray-800/30 transition">
                                                        <td className="py-2 text-fuchsia-400 font-semibold font-sans">Max (Cực đại)</td>
                                                        <td className="py-2 text-right text-fuchsia-400 font-bold">{formatNumber(spreadStats.maxPrice)}</td>
                                                        <td className="py-2 text-right text-fuchsia-400 font-bold">{spreadStats.maxPercent.toFixed(2)}%</td>
                                                        <td className="py-2 text-right text-gray-400 font-sans text-[11px]">Cực đại lịch sử</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-gray-800/90 border border-gray-700/60 text-xs text-gray-300 mt-3 space-y-1">
                                        <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                                            <span>💡 Mẹo ứng dụng thực chiến:</span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 leading-relaxed">
                                            Biên độ nến trung vị (P50) là <b>{formatNumber(spreadStats.medianPrice)}</b> ({spreadStats.medianPercent.toFixed(2)}%). Khi đặt Stop Loss, hãy đặt cách điểm Entry tối thiểu bằng mức P50 ({formatNumber(spreadStats.medianPrice)}) để tránh bị quét lệnh do độ nhiễu dao động tự nhiên của nến.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Spread Timeline Chart */}
                            <div className="bg-gray-900/70 border border-gray-700/60 rounded-xl p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                        <Activity size={16} className={spreadViewUnit === 'price' ? 'text-sky-400' : 'text-amber-400'} />
                                        <span>
                                            Diễn biến Biên độ Nến theo dòng thời gian ({spreadViewUnit === 'price' ? 'Khoảng Giá Tuyệt Đối' : 'Tỷ lệ %'} Timeline)
                                        </span>
                                    </h3>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="text-sky-400 font-semibold flex items-center gap-1">
                                            <span className="w-3 h-0.5 bg-sky-400 inline-block border-t border-dashed"></span>
                                            Đường TB: {spreadViewUnit === 'price' ? formatNumber(spreadStats.avgPrice) : `${spreadStats.avgPercent.toFixed(2)}%`}
                                        </span>
                                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                                            <span className="w-3 h-0.5 bg-rose-400 inline-block border-t border-dotted"></span>
                                            Đường P90: {spreadViewUnit === 'price' ? formatNumber(spreadStats.p90Price) : `${spreadStats.p90Percent.toFixed(2)}%`}
                                        </span>
                                    </div>
                                </div>
                                <div className="h-[250px] w-full">
                                    <ReactECharts option={spreadTimelineOption} style={{ height: '100%', width: '100%' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================== */}
                    {/* 2. INTRADAY INSIGHT VIEW                   */}
                    {/* ========================================== */}
                    {insightMode === 'intraday' && intradayStats && (
                        <div className="space-y-4">
                            {/* KPI Highlights */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        <ArrowUpRight size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Giờ Tăng mạnh nhất</span>
                                        <span className="text-lg font-bold text-emerald-400">
                                            {intradayStats.bestBullHour?.label} ({intradayStats.bestBullHour?.bullRate}%)
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                        <ArrowDownRight size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Giờ Giảm nhiều nhất</span>
                                        <span className="text-lg font-bold text-rose-400">
                                            {intradayStats.bestBearHour?.label} ({intradayStats.bestBearHour?.bearRate}%)
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                        <Flame size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Giờ Thanh khoản cao nhất</span>
                                        <span className="text-lg font-bold text-amber-300">
                                            {intradayStats.highestVolHour?.label}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                                        <TrendingUp size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Lợi nhuận TB cao nhất</span>
                                        <span className="text-lg font-bold text-cyan-400">
                                            {intradayStats.highestReturnHour?.label} (+{intradayStats.highestReturnHour?.avgRet}%)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-gray-900/70 border border-gray-700/60 rounded-xl p-4">
                                <h3 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                                    <Sun size={16} className="text-orange-400" />
                                    <span>Tỷ lệ Số nến Tăng vs Giảm & Win Rate theo khung giờ trong ngày</span>
                                </h3>
                                <div className="h-[380px]">
                                    <ReactECharts option={intradayChartOption} style={{ height: '100%', width: '100%' }} />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-gray-900/70 border border-gray-700/60 rounded-xl overflow-hidden">
                                <div className="p-3 border-b border-gray-800 text-xs font-bold text-gray-200 uppercase tracking-wider">
                                    Chi tiết từng khung giờ trong ngày
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left text-gray-300">
                                        <thead className="bg-gray-800/80 text-gray-400 uppercase font-semibold">
                                            <tr>
                                                <th className="px-4 py-2.5">Khung giờ</th>
                                                <th className="px-4 py-2.5">Tổng số nến</th>
                                                <th className="px-4 py-2.5">Nến Tăng (Bull)</th>
                                                <th className="px-4 py-2.5">Nến Giảm (Bear)</th>
                                                <th className="px-4 py-2.5">Xác suất Tăng %</th>
                                                <th className="px-4 py-2.5">Lợi nhuận TB (%)</th>
                                                <th className="px-4 py-2.5">Khối lượng TB</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800 font-mono">
                                            {intradayStats.activeHours.map((row) => (
                                                <tr key={row.hour} className="hover:bg-gray-800/50">
                                                    <td className="px-4 py-2 font-bold text-white">{row.label}</td>
                                                    <td className="px-4 py-2 text-gray-400">{row.total}</td>
                                                    <td className="px-4 py-2 text-emerald-400 font-semibold">{row.bull}</td>
                                                    <td className="px-4 py-2 text-rose-400 font-semibold">{row.bear}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={`px-2 py-0.5 rounded font-bold ${row.bullRate >= 50 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                                            {row.bullRate}%
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-2 font-bold ${row.avgRet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {row.avgRet >= 0 ? `+${row.avgRet}%` : `${row.avgRet}%`}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-400">{formatNumber(row.avgVol)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================== */}
                    {/* 3. WEEK INSIGHT VIEW                       */}
                    {/* ========================================== */}
                    {insightMode === 'week' && weekStats && (
                        <div className="space-y-4">
                            {/* KPI Highlights */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        <ArrowUpRight size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Ngày Tăng tốt nhất</span>
                                        <span className="text-lg font-bold text-emerald-400">
                                            {weekStats.bestBullDay?.dayName} ({weekStats.bestBullDay?.bullRate}%)
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                        <ArrowDownRight size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Ngày Giảm nhiều nhất</span>
                                        <span className="text-lg font-bold text-rose-400">
                                            {weekStats.bestBearDay?.dayName} ({weekStats.bestBearDay?.bearRate}%)
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                        <TrendingUp size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Lợi nhuận TB cao nhất</span>
                                        <span className="text-lg font-bold text-sky-400">
                                            {weekStats.highestReturnDay?.dayName} (+{weekStats.highestReturnDay?.avgRet}%)
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                        <Flame size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Thanh khoản sôi động nhất</span>
                                        <span className="text-lg font-bold text-amber-300">
                                            {weekStats.highestVolDay?.dayName}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-gray-900/70 border border-gray-700/60 rounded-xl p-4">
                                <h3 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                                    <Calendar size={16} className="text-emerald-400" />
                                    <span>Lợi nhuận Trung bình (%) & Xác suất Tăng theo các thứ trong tuần</span>
                                </h3>
                                <div className="h-[380px]">
                                    <ReactECharts option={weekChartOption} style={{ height: '100%', width: '100%' }} />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-gray-900/70 border border-gray-700/60 rounded-xl overflow-hidden">
                                <div className="p-3 border-b border-gray-800 text-xs font-bold text-gray-200 uppercase tracking-wider">
                                    Thống kê chi tiết từng thứ trong tuần
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left text-gray-300">
                                        <thead className="bg-gray-800/80 text-gray-400 uppercase font-semibold">
                                            <tr>
                                                <th className="px-4 py-2.5">Thứ trong tuần</th>
                                                <th className="px-4 py-2.5">Số phiên</th>
                                                <th className="px-4 py-2.5">Số phiên Tăng</th>
                                                <th className="px-4 py-2.5">Số phiên Giảm</th>
                                                <th className="px-4 py-2.5">Xác suất Tăng %</th>
                                                <th className="px-4 py-2.5">Lợi nhuận TB (%)</th>
                                                <th className="px-4 py-2.5">Biên độ TB (Spread %)</th>
                                                <th className="px-4 py-2.5">Khối lượng TB</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800 font-mono">
                                            {weekStats.days.map((row) => (
                                                <tr key={row.dayIdx} className="hover:bg-gray-800/50">
                                                    <td className="px-4 py-2 font-bold text-white font-sans">{row.dayName}</td>
                                                    <td className="px-4 py-2 text-gray-400">{row.total}</td>
                                                    <td className="px-4 py-2 text-emerald-400 font-semibold">{row.bull}</td>
                                                    <td className="px-4 py-2 text-rose-400 font-semibold">{row.bear}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={`px-2 py-0.5 rounded font-bold ${row.bullRate >= 50 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                                            {row.bullRate}%
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-2 font-bold ${row.avgRet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {row.avgRet >= 0 ? `+${row.avgRet}%` : `${row.avgRet}%`}
                                                    </td>
                                                    <td className="px-4 py-2 text-amber-400">{row.avgSpread}%</td>
                                                    <td className="px-4 py-2 text-gray-400">{formatNumber(row.avgVol)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================== */}
                    {/* 4. YEAR INSIGHT VIEW                       */}
                    {/* ========================================== */}
                    {insightMode === 'year' && yearStats && (
                        <div className="space-y-4">
                            {/* KPI Highlights */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        <ArrowUpRight size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Tháng Tăng mạnh nhất trong năm</span>
                                        <span className="text-lg font-bold text-emerald-400">
                                            {yearStats.bestMonth?.monthName} (+{yearStats.bestMonth?.avgRet}%)
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                        <ArrowDownRight size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Tháng Giảm nhiều nhất (Sell Season)</span>
                                        <span className="text-lg font-bold text-rose-400">
                                            {yearStats.worstMonth?.monthName} ({yearStats.worstMonth?.avgRet}%)
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                        <Sparkles size={22} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 block">Xác suất Tăng cao nhất</span>
                                        <span className="text-lg font-bold text-sky-300">
                                            {yearStats.highestWinMonth?.monthName} ({yearStats.highestWinMonth?.bullRate}%)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-gray-900/70 border border-gray-700/60 rounded-xl p-4">
                                <h3 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                                    <CalendarDays size={16} className="text-sky-400" />
                                    <span>Mùa vụ Hiệu suất Trung bình (%) & Tỷ lệ Tháng Dương qua 12 Tháng</span>
                                </h3>
                                <div className="h-[380px]">
                                    <ReactECharts option={yearChartOption} style={{ height: '100%', width: '100%' }} />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-gray-900/70 border border-gray-700/60 rounded-xl overflow-hidden">
                                <div className="p-3 border-b border-gray-800 text-xs font-bold text-gray-200 uppercase tracking-wider">
                                    Chi tiết thống kê mùa vụ 12 tháng
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left text-gray-300">
                                        <thead className="bg-gray-800/80 text-gray-400 uppercase font-semibold">
                                            <tr>
                                                <th className="px-4 py-2.5">Tháng</th>
                                                <th className="px-4 py-2.5">Số chu kỳ nạp</th>
                                                <th className="px-4 py-2.5">Số kỳ Tăng</th>
                                                <th className="px-4 py-2.5">Số kỳ Giảm</th>
                                                <th className="px-4 py-2.5">Xác suất Tăng %</th>
                                                <th className="px-4 py-2.5">Lợi nhuận Mùa vụ TB (%)</th>
                                                <th className="px-4 py-2.5">Tăng Max (%)</th>
                                                <th className="px-4 py-2.5">Giảm Max (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800 font-mono">
                                            {yearStats.months.map((row) => (
                                                <tr key={row.monthIdx} className="hover:bg-gray-800/50">
                                                    <td className="px-4 py-2 font-bold text-white font-sans">{row.monthName}</td>
                                                    <td className="px-4 py-2 text-gray-400">{row.total}</td>
                                                    <td className="px-4 py-2 text-emerald-400 font-semibold">{row.bull}</td>
                                                    <td className="px-4 py-2 text-rose-400 font-semibold">{row.bear}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={`px-2 py-0.5 rounded font-bold ${row.bullRate >= 50 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                                            {row.bullRate}%
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-2 font-bold ${row.avgRet >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                                                        {row.avgRet >= 0 ? `+${row.avgRet}%` : `${row.avgRet}%`}
                                                    </td>
                                                    <td className="px-4 py-2 text-emerald-400">+{row.maxRet}%</td>
                                                    <td className="px-4 py-2 text-rose-400">{row.minRet}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StrategyInsight;
