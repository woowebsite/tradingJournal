import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

import { fetchWatchlists } from '../features/watchlistSlice';
import { fetchSymbols } from '../features/marketSlice';
import { useAccount } from '../context/AccountContext';
import { getPythonStrategies, scanPythonStrategy, optimizePythonStrategy } from '../services/pythonStrategy';
import { getStrategyTemplates, createStrategyTemplate, updateStrategyTemplate, deleteStrategyTemplate, assignDefaultStrategyTemplate } from '../services/strategyTemplate';
import { getSymbolInsights, getSymbolInsightsBySymbol } from '../services/symbolInsight';
import DeflatedSharpeRatioCard from '../components/DeflatedSharpeRatioCard';
import { formatNumber } from '../utils/formatNumber';
import { buildPythonChartSignals } from '../utils/chartSignals';
import { subscribeBinanceKlineWS } from '../services/binance';
import { getYahooFinanceHistory } from '../services/yahooFinance';
import { getStockHistory } from '../services/24hmoney';

// Strategy Registry
import {
    getStrategyConfig,
    getDefaultParams,
    getDefaultOptFlags,
    buildStrategyScanPayload,
    buildStrategyOptimizePayload,
    applyStrategyOptimizeConfig
} from '../strategies';

// Modular Sub-components
import StrategyHeader from '../components/python-strategy/StrategyHeader';
import WatchlistSymbolBar from '../components/python-strategy/WatchlistSymbolBar';
import DynamicStrategyForm from '../components/python-strategy/DynamicStrategyForm';
import SummaryMetricsBar from '../components/python-strategy/SummaryMetricsBar';
import ActiveTradeBanner from '../components/python-strategy/ActiveTradeBanner';
import OptimalConfigBanner from '../components/python-strategy/OptimalConfigBanner';
import TradingChartSection from '../components/python-strategy/TradingChartSection';
import TradesHistoryTable from '../components/python-strategy/TradesHistoryTable';
import SaveTemplateModal from '../components/python-strategy/SaveTemplateModal';
import InsightHistoryModal from '../components/python-strategy/InsightHistoryModal';
import OptimizationLeaderboardModal from '../components/python-strategy/OptimizationLeaderboardModal';
import StrategyTemplatesListModal from '../components/python-strategy/StrategyTemplatesListModal';

const PythonStrategy = () => {
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();
    const querySymbol = useMemo(() => {
        const s = searchParams.get('symbol');
        return s ? s.trim().toUpperCase() : '';
    }, [searchParams]);

    const { selectedAccount } = useAccount();
    const { items: watchlists = [] } = useSelector(state => state.watchlists);
    const { symbols = [] } = useSelector(state => state.market);
    const chartCardRef = useRef(null);

    // 1. Core Selection States
    const [strategyFiles, setStrategyFiles] = useState([]);
    const [selectedStrategyFile, setSelectedStrategyFile] = useState('strategy_supertrend_ma288.py');
    const [selectedWatchlistId, setSelectedWatchlistId] = useState('');
    const [selectedSymbol, setSelectedSymbol] = useState(querySymbol || '');

    // 2. Current Strategy Schema Definition
    const currentStrategy = useMemo(() => {
        return getStrategyConfig(selectedStrategyFile);
    }, [selectedStrategyFile]);

    // 3. Dynamic Strategy Parameters & Optimization Flags States
    const [params, setParams] = useState(() => getDefaultParams('strategy_supertrend_ma288.py'));
    const [optFlags, setOptFlags] = useState(() => getDefaultOptFlags('strategy_supertrend_ma288.py'));

    // 4. Execution & Market Data States
    const [timeframe, setTimeframe] = useState('D1');
    const [countback, setCountback] = useState(1000);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [optimizing, setOptimizing] = useState(false);
    const [bestInfo, setBestInfo] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [focusDate, setFocusDate] = useState(null);

    // 4b. Realtime Kline & Price States
    const [liveCandle, setLiveCandle] = useState(null);
    const [livePrice, setLivePrice] = useState(null);
    const [wsStatus, setWsStatus] = useState('disconnected');

    // 5. Symbol Insight States
    const [symbolInsightStats, setSymbolInsightStats] = useState(null);
    const [loadingInsightStats, setLoadingInsightStats] = useState(false);
    const [insightModalOpen, setInsightModalOpen] = useState(false);
    const [savedInsightsList, setSavedInsightsList] = useState([]);

    // 6. Optimization Leaderboard States
    const [optimizationModalOpen, setOptimizationModalOpen] = useState(false);
    const [optimizationConfigs, setOptimizationConfigs] = useState([]);
    const [activeAppliedConfigRank, setActiveAppliedConfigRank] = useState(null);

    // 7. Strategy Template States
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [templatesListModalOpen, setTemplatesListModalOpen] = useState(false);
    const [overwriteTemplateId, setOverwriteTemplateId] = useState('');
    const [templateNameInput, setTemplateNameInput] = useState('');
    const [templateDescInput, setTemplateDescInput] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);

    // Load initial Watchlists, Symbols, Strategies, and Templates
    useEffect(() => {
        dispatch(fetchWatchlists());
        dispatch(fetchSymbols());

        const loadStrategies = async () => {
            const files = await getPythonStrategies();
            setStrategyFiles(files);
            if (files && files.length > 0) {
                setSelectedStrategyFile(files[0].fileName);
            }
        };

        const loadTemplates = async () => {
            try {
                const data = await getStrategyTemplates();
                setTemplates(data || []);
            } catch (err) {
                console.error('Failed to load strategy templates:', err);
            }
        };

        loadStrategies();
        loadTemplates();
    }, [dispatch]);

    // Lọc Watchlists theo Account hiện tại
    const accountWatchlists = useMemo(() => {
        if (!selectedAccount) return watchlists;
        return watchlists.filter(w => {
            const marketMatch = !w.market || w.market.documentId === selectedAccount?.market?.documentId || w.market.id === selectedAccount?.market?.id;
            const accountMatch = !w.account || w.account.documentId === selectedAccount.documentId || w.account.id === selectedAccount.id;
            return marketMatch && accountMatch;
        });
    }, [watchlists, selectedAccount]);

    // Symbols trong Watchlist đang chọn
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

        if (querySymbol && !normalized.includes(querySymbol)) {
            normalized.unshift(querySymbol);
        }

        return [...new Set(normalized)];
    }, [selectedWatchlistId, accountWatchlists, symbols, querySymbol]);

    // Kiểm tra Symbol hiện tại có thuộc thị trường Crypto/Binance không
    const isCryptoSymbol = useMemo(() => {
        const symName = String(selectedSymbol || '').toUpperCase();
        return selectedAccount?.market?.Name === 'Crypto' ||
            symName.includes('USDT') ||
            symName.includes('USDC') ||
            symName.includes('BUSD') ||
            symName.endsWith('.P') ||
            symName.includes('PERP') ||
            symName.startsWith('BINANCE:');
    }, [selectedAccount?.market?.Name, selectedSymbol]);

    // Real-time Kline & Live Price Connection (WebSocket cho Crypto, Polling cho Stocks / Indices)
    useEffect(() => {
        const symName = selectedSymbol;
        if (!symName) {
            setWsStatus('disconnected');
            setLiveCandle(null);
            setLivePrice(null);
            return;
        }

        const currentTf = timeframe || 'D1';

        // 1. Đối với Crypto -> Dùng Binance WebSocket trực tiếp
        if (isCryptoSymbol) {
            const unsubscribe = subscribeBinanceKlineWS(
                symName,
                currentTf,
                (candle) => {
                    setLiveCandle(candle);
                    if (candle.close !== undefined && candle.close !== null) {
                        setLivePrice(candle.close);
                    }
                },
                (status) => {
                    setWsStatus(status);
                }
            );

            return () => {
                unsubscribe();
            };
        }

        // 2. Đối với Cổ phiếu / Chỉ số (NASDAQ, QQQ, NQ=F, GOLD, VNINDEX...) -> Polling thời gian thực mỗi 5s
        let isCancelled = false;
        setWsStatus('connecting');

        const pollLatestCandle = async () => {
            if (isCancelled) return;
            try {
                const isUsOrGlobal = [
                    'USTEC', 'USTECH', 'USTEC.P', 'NAS100', 'NAS100.P', 'NAS100USD', 'US100', 'US100.P',
                    'NASDAQ', 'IXIC', '^IXIC', 'NDX', '^NDX', 'NASDAQ100', 'NQ', 'NQ=F', 'QQQ',
                    'US500', 'US500.P', 'SPX500', 'ES', 'ES=F', 'SP500', 'S&P500', 'SPX', 'GSPC', '^GSPC', 'SPY',
                    'US30', 'US30.P', 'DJ30', 'WALLSTREET', 'YM', 'YM=F', 'DOW', 'DOWJONES', 'DJI', '^DJI', 'DIA',
                    'GER40', 'GER30', 'DAX', 'UK100', 'FTSE', 'JPN225', 'NIKKEI', 'HK50',
                    'GOLD', 'GC=F', 'XAUUSD', 'XAUUSD.P', 'SILVER', 'SI=F', 'XAGUSD',
                    'BRENT', 'BZ=F', 'UKOIL', 'WTI', 'CL=F', 'USOIL', 'CRUDEOIL', 'NATGAS', 'COPPER',
                    'DXY', 'DX-Y.NYB', 'USDX', 'US10Y', '^TNX', 'VIX', '^VIX',
                    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'
                ].includes(symName.toUpperCase()) || symName.startsWith('^') || symName.includes('=');

                let latestCandles = [];
                if (isUsOrGlobal) {
                    latestCandles = await getYahooFinanceHistory(symName, currentTf, 5);
                } else {
                    latestCandles = await getStockHistory(symName, currentTf, 5);
                    if (!latestCandles || latestCandles.length === 0) {
                        latestCandles = await getYahooFinanceHistory(symName, currentTf, 5);
                    }
                }

                if (!isCancelled && Array.isArray(latestCandles) && latestCandles.length > 0) {
                    const last = latestCandles[latestCandles.length - 1];
                    setLiveCandle({
                        ...last,
                        isClosed: false,
                    });
                    if (last.close !== undefined && last.close !== null) {
                        setLivePrice(last.close);
                    }
                    setWsStatus('connected');
                }
            } catch (err) {
                if (!isCancelled) {
                    setWsStatus('error');
                }
            }
        };

        pollLatestCandle();
        const pollInterval = setInterval(pollLatestCandle, 5000);

        return () => {
            isCancelled = true;
            clearInterval(pollInterval);
        };
    }, [isCryptoSymbol, selectedSymbol, timeframe]);

    // Tự động chọn Watchlist đầu tiên
    useEffect(() => {
        if (accountWatchlists.length > 0 && !selectedWatchlistId) {
            if (querySymbol) {
                const targetWl = accountWatchlists.find(w => {
                    const syms = w.symbols || [];
                    return syms.some(s => {
                        const sName = typeof s === 'string' ? s : (s?.Name || s?.name || s?.ticker || '');
                        return sName.trim().toUpperCase() === querySymbol;
                    });
                });
                if (targetWl) {
                    setSelectedWatchlistId(targetWl.documentId || targetWl.id);
                    return;
                }
            }
            setSelectedWatchlistId(accountWatchlists[0].documentId || accountWatchlists[0].id);
        }
    }, [accountWatchlists, selectedWatchlistId, querySymbol]);

    // Reset selectedSymbol khi đổi Watchlist
    useEffect(() => {
        if (watchlistSymbols.length > 0 && selectedSymbol) {
            const currentSelectedInList = watchlistSymbols.includes(selectedSymbol);
            if (!currentSelectedInList && (!querySymbol || selectedSymbol !== querySymbol)) {
                setSelectedSymbol('');
                setScanResult(null);
            }
        }
    }, [watchlistSymbols, selectedSymbol, querySymbol]);

    // Lọc Strategy Templates của Symbol đang chọn
    const symbolTemplates = useMemo(() => {
        if (!selectedSymbol) return [];
        const cleanSym = String(selectedSymbol).trim().toUpperCase();
        return templates.filter(t => {
            const tSymName = String(t.symbolName || t.symbol?.Name || t.symbol?.name || '').trim().toUpperCase();
            return tSymName === cleanSym;
        });
    }, [templates, selectedSymbol]);

    useEffect(() => {
        if (selectedTemplateId) {
            const exists = symbolTemplates.some(t => String(t.id || t.documentId) === String(selectedTemplateId));
            if (!exists) {
                setSelectedTemplateId('');
            }
        }
    }, [selectedSymbol, symbolTemplates, selectedTemplateId]);

    // Parameter & Optimization Flag Change Handlers
    const handleParamChange = useCallback((key, value) => {
        setParams(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleOptFlagChange = useCallback((key, value) => {
        setOptFlags(prev => ({ ...prev, [key]: value }));
    }, []);

    // Số lượng tham số đang được chọn tối ưu
    const { optCount, totalOptCount } = useMemo(() => {
        const optimizableFields = (currentStrategy?.fields || []).filter(f => f.optimizable);
        const keys = optimizableFields.map(f => f.optKey || f.name);
        const uniqueKeys = [...new Set(keys)];
        return {
            optCount: uniqueKeys.filter(k => Boolean(optFlags[k])).length,
            totalOptCount: uniqueKeys.length,
        };
    }, [currentStrategy, optFlags]);

    const handleToggleAllOpt = useCallback((enableAll = true) => {
        const optimizableFields = (currentStrategy?.fields || []).filter(f => f.optimizable);
        const updated = {};
        optimizableFields.forEach(f => {
            const key = f.optKey || f.name;
            updated[key] = enableAll;
        });
        setOptFlags(prev => ({ ...prev, ...updated }));
    }, [currentStrategy]);

    // Helper: Kiểm tra bản ghi Insight khớp symbol
    const isInsightMatchSymbol = useCallback((item, targetSym) => {
        if (!item || !targetSym) return false;
        const cleanSym = String(targetSym).trim().toUpperCase();
        const symObjName = String(item.symbol?.Name || item.symbol?.name || item.symbol?.ticker || '').trim().toUpperCase();
        if (symObjName && symObjName === cleanSym) return true;
        const detailSym = String(item.details?.summary?.symbol || '').trim().toUpperCase();
        if (detailSym && detailSym === cleanSym) return true;
        const title = String(item.title || '').toUpperCase();
        if (title === cleanSym || title.startsWith(`${cleanSym} `) || title.startsWith(`${cleanSym}-`) || title.startsWith(`${cleanSym}:`) || title.startsWith(`${cleanSym}_`)) return true;
        if (title.includes(` ${cleanSym} `) || title.includes(`(${cleanSym})`) || title.includes(`[${cleanSym}]`)) return true;
        return false;
    }, []);

    // Tải thông tin Spread từ SymbolInsight
    const loadSymbolInsight = useCallback(async (targetSymbol) => {
        const sym = String(targetSymbol || selectedSymbol || '').trim().toUpperCase();
        if (!sym) {
            setSymbolInsightStats(null);
            return;
        }
        setLoadingInsightStats(true);
        try {
            const symObj = symbols.find(s => String(s.Name || s.name || s.ticker || '').trim().toUpperCase() === sym);
            let insights = [];
            if (symObj?.documentId || symObj?.id) {
                insights = await getSymbolInsightsBySymbol(symObj.documentId || symObj.id);
            }
            if (!insights || insights.length === 0) {
                insights = await getSymbolInsights({
                    'filters[title][$containsi]': sym,
                    'pagination[pageSize]': 20
                });
            }
            const matched = (insights || []).filter(item => isInsightMatchSymbol(item, sym));
            setSymbolInsightStats(matched.length > 0 ? matched[0] : null);
        } catch (err) {
            console.warn('Could not load SymbolInsight for symbol:', sym, err);
            setSymbolInsightStats(null);
        } finally {
            setLoadingInsightStats(false);
        }
    }, [selectedSymbol, symbols, isInsightMatchSymbol]);

    const handleOpenInsightModal = useCallback(async () => {
        const sym = String(selectedSymbol || '').trim().toUpperCase();
        if (!sym) {
            setErrorMessage('Vui lòng chọn Symbol trước khi xem Lịch sử Insight.');
            return;
        }
        setLoadingInsightStats(true);
        setInsightModalOpen(true);
        try {
            const symObj = symbols.find(s => String(s.Name || s.name || s.ticker || '').trim().toUpperCase() === sym);
            let insights = [];
            if (symObj?.documentId || symObj?.id) {
                insights = await getSymbolInsightsBySymbol(symObj.documentId || symObj.id);
            }
            if (!insights || insights.length === 0) {
                insights = await getSymbolInsights({
                    'filters[title][$containsi]': sym,
                    'pagination[pageSize]': 30,
                    'sort': 'savedAt:desc,createdAt:desc'
                });
            }
            const matched = (insights || []).filter(item => isInsightMatchSymbol(item, sym));
            setSavedInsightsList(matched);
        } catch (err) {
            console.error('Failed to load saved insights list:', err);
            setSavedInsightsList([]);
        } finally {
            setLoadingInsightStats(false);
        }
    }, [selectedSymbol, symbols, isInsightMatchSymbol]);

    const handleSelectInsightItem = useCallback((item) => {
        setSymbolInsightStats(item);
        setInsightModalOpen(false);
    }, []);

    useEffect(() => {
        if (selectedSymbol) {
            loadSymbolInsight(selectedSymbol);
        } else {
            setSymbolInsightStats(null);
        }
    }, [selectedSymbol, loadSymbolInsight]);

    // Giá trị Spread (P25, P50, P75, P90, P99)
    const spreadValues = useMemo(() => {
        if (symbolInsightStats) {
            return {
                p25: symbolInsightStats.spreadP25Price,
                p50: symbolInsightStats.spreadMedianPrice,
                p75: symbolInsightStats.spreadP75Price,
                p90: symbolInsightStats.spreadP90Price,
                p99: symbolInsightStats.spreadP99Price,
                min: symbolInsightStats.spreadMinPrice,
                max: symbolInsightStats.spreadMaxPrice,
                source: 'SymbolInsight'
            };
        }
        if (scanResult?.spreadStats) {
            const ss = scanResult.spreadStats;
            return {
                p25: ss.p25Price ?? ss.p25,
                p50: ss.medianPrice ?? ss.median ?? ss.p50,
                p75: ss.p75Price ?? ss.p75,
                p90: ss.p90Price ?? ss.p90,
                p99: ss.p99Price ?? ss.p99,
                min: ss.minPrice ?? ss.min,
                max: ss.maxPrice ?? ss.max,
                source: 'LiveScan'
            };
        }
        return null;
    }, [symbolInsightStats, scanResult]);

    // 4. SCAN STRATEGY
    const handleScan = useCallback(async (tickerToScan = null, customCountback = null, customTimeframe = null, customParams = null) => {
        const ticker = String(tickerToScan || selectedSymbol || '').trim().toUpperCase();
        const currentTf = String(customTimeframe || timeframe || 'D1').trim().toUpperCase();
        const activeParams = customParams || params;

        if (!ticker) {
            setErrorMessage('Vui lòng chọn Symbol trước khi chạy Scan.');
            return;
        }

        if (!activeParams.allowLong && !activeParams.allowShort) {
            setErrorMessage('Vui lòng chọn ít nhất 1 loại lệnh (Long Trade hoặc Short Trade).');
            return;
        }

        setScanning(true);
        setErrorMessage('');
        const reqCountback = customCountback || countback || 1000;
        try {
            const basePayload = {
                strategyFile: selectedStrategyFile,
                ticker,
                timeframe: currentTf,
                countback: reqCountback,
            };

            const payload = buildStrategyScanPayload(selectedStrategyFile, activeParams, basePayload);
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
            console.error('Scan error:', err);
            const errDetail = err?.response?.data?.error?.message || err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi thực thi chiến lược Python.';
            setErrorMessage(typeof errDetail === 'object' ? JSON.stringify(errDetail) : String(errDetail));
            setScanResult(null);
        } finally {
            setScanning(false);
        }
    }, [selectedSymbol, params, countback, selectedStrategyFile, timeframe]);

    // Tự động scan querySymbol trong URL
    const queryLoadedRef = useRef(false);
    useEffect(() => {
        if (querySymbol && !queryLoadedRef.current) {
            queryLoadedRef.current = true;
            setSelectedSymbol(querySymbol);
            handleScan(querySymbol, 1000, timeframe);
        }
    }, [querySymbol, timeframe, handleScan]);

    // Infinite Scroll tải thêm nến
    const handleLoadMore = useCallback(async () => {
        if (scanning || optimizing || loadingMore || !hasMore) return;
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

            const basePayload = {
                strategyFile: selectedStrategyFile,
                ticker,
                timeframe,
                countback: nextCount,
            };

            const payload = buildStrategyScanPayload(selectedStrategyFile, params, basePayload);
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
    }, [scanning, optimizing, loadingMore, hasMore, countback, scanResult, selectedSymbol, selectedStrategyFile, timeframe, params]);

    // 5. OPTIMIZE STRATEGY
    const handleOptimize = useCallback(async (tickerToOptimize) => {
        const ticker = String(tickerToOptimize || selectedSymbol || '').trim().toUpperCase();
        if (!ticker) {
            setErrorMessage('Vui lòng chọn Symbol trước khi chạy Optimize.');
            return;
        }

        if (!params.allowLong && !params.allowShort) {
            setErrorMessage('Vui lòng chọn ít nhất 1 loại lệnh (Long Trade hoặc Short Trade).');
            return;
        }

        setOptimizing(true);
        setErrorMessage('');
        try {
            const basePayload = {
                strategyFile: selectedStrategyFile,
                ticker,
                timeframe,
                countback: 50000,
                allowLong: params.allowLong,
                allowShort: params.allowShort,
            };

            const payload = buildStrategyOptimizePayload(selectedStrategyFile, params, optFlags, basePayload);
            const result = await optimizePythonStrategy(payload);

            if (result?.error) {
                setErrorMessage(result.error);
            } else {
                const topConfigs = result?.topConfigs || (result?.bestParams ? [{ ...result.bestParams, rank: 1 }] : []);
                setOptimizationConfigs(topConfigs);

                if (topConfigs.length > 0) {
                    setOptimizationModalOpen(true);
                } else {
                    setErrorMessage('Không tìm thấy cấu hình tối ưu phù hợp với dữ liệu hiện tại.');
                }

                if (result?.candles?.length) {
                    setCountback(result.candles.length);
                }
                if (result && !result.error && Array.isArray(result.candles)) {
                    setScanResult(result);
                    if (result.bestParams) {
                        setBestInfo(result.bestParams);
                        setActiveAppliedConfigRank(1);
                        const updatedBest = applyStrategyOptimizeConfig(selectedStrategyFile, result.bestParams, params);
                        setParams(updatedBest);
                    }
                }
                if (ticker !== selectedSymbol) {
                    setSelectedSymbol(ticker);
                }
            }
        } catch (err) {
            console.error('Optimize error:', err);
            const errDetail = err?.response?.data?.error?.message || err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi tối ưu hóa tham số chiến lược Python.';
            setErrorMessage(typeof errDetail === 'object' ? JSON.stringify(errDetail) : String(errDetail));
        } finally {
            setOptimizing(false);
        }
    }, [selectedStrategyFile, selectedSymbol, timeframe, params, optFlags]);

    // Áp dụng cấu hình được chọn từ BXH Leaderboard
    const handleApplyOptimizeConfig = useCallback(async (config) => {
        if (!config) return;
        const ticker = String(selectedSymbol || '').trim().toUpperCase();
        if (!ticker) return;

        const updatedParams = applyStrategyOptimizeConfig(selectedStrategyFile, config, params);
        setParams(updatedParams);
        setActiveAppliedConfigRank(config.rank);
        setBestInfo(config);
        setOptimizationModalOpen(false);

        // Chạy scan ngay với cấu hình mới trên cùng tập nến đã tối ưu
        const targetCountback = scanResult?.candles?.length || countback || 5000;
        handleScan(ticker, targetCountback, timeframe, updatedParams);
    }, [selectedSymbol, selectedStrategyFile, params, countback, timeframe, handleScan, scanResult]);

    // Reset về giá trị mặc định
    const handleResetDefault = useCallback(() => {
        setBestInfo(null);
        setErrorMessage('');
        const ticker = String(selectedSymbol || '').trim().toUpperCase();
        const defaultVals = getDefaultParams(selectedStrategyFile);
        setParams(defaultVals);

        if (ticker) {
            handleScan(ticker, 500, timeframe, defaultVals);
        }
    }, [selectedSymbol, selectedStrategyFile, timeframe, handleScan]);

    // Template Handlers: Select, Save, Delete
    const handleSelectTemplate = (templateId, customSymbol = null) => {
        setSelectedTemplateId(templateId);
        if (!templateId) return;
        const tpl = templates.find(t => String(t.id || t.documentId) === String(templateId));
        if (!tpl) return;

        const targetSymbol = customSymbol || String(tpl.symbolName || tpl.symbol?.Name || tpl.symbol?.name || selectedSymbol || '').trim().toUpperCase();
        if (targetSymbol && targetSymbol !== selectedSymbol) {
            setSelectedSymbol(targetSymbol);
        }

        if (tpl.strategyFile && tpl.strategyFile !== selectedStrategyFile) {
            setSelectedStrategyFile(tpl.strategyFile);
        }
        const targetTf = tpl.timeframe || timeframe;
        if (tpl.timeframe) {
            setTimeframe(tpl.timeframe);
        }

        const tplConfig = { ...(tpl.config || {}) };
        delete tplConfig.metrics;
        delete tplConfig.backtestSummary;

        const mergedParams = {
            ...getDefaultParams(tpl.strategyFile || selectedStrategyFile),
            ...tplConfig,
        };
        setParams(mergedParams);

        const reqCount = tplConfig.countback || countback || 1000;
        setCountback(reqCount);
        setBestInfo(null);
        setHasMore(true);

        handleScan(targetSymbol || selectedSymbol, reqCount, targetTf, mergedParams);
    };

    // Áp dụng Template từ Modal (Nạp cấu hình và chạy Scan)
    const handleApplyTemplateModal = async (tpl) => {
        if (!tpl) return;
        const tplId = String(tpl.id || tpl.documentId);
        const sym = String(tpl.symbolName || tpl.symbol?.Name || tpl.symbol?.name || selectedSymbol || '').trim().toUpperCase();
        handleSelectTemplate(tplId, sym);
    };

    // Đặt Template làm Mặc định cho Symbol (Chỉ gán default ngầm, không kích hoạt scan nặng)
    const handleSetDefaultTemplate = async (tpl) => {
        if (!tpl) return;
        const tplId = String(tpl.id || tpl.documentId);
        const sym = String(tpl.symbolName || tpl.symbol?.Name || tpl.symbol?.name || selectedSymbol || '').trim().toUpperCase();

        const targetSymObj = (Array.isArray(symbols) ? symbols : []).find(s =>
            String(s.Name || s.name || '').trim().toUpperCase() === sym
        );
        const targetSymId = targetSymObj?.documentId || targetSymObj?.id || tpl.symbol?.documentId || tpl.symbol?.id;
        if (targetSymId && tplId) {
            try {
                await assignDefaultStrategyTemplate(targetSymId, tplId);
                getStrategyTemplates().then(data => setTemplates(data || [])).catch(() => {});
                dispatch(fetchSymbols());
            } catch (err) {
                console.error('Failed to assign default template to symbol in PythonStrategy:', err);
            }
        }
    };

    const handleOpenSaveModal = () => {
        const defaultDesc = typeof currentStrategy?.generateDescription === 'function'
            ? currentStrategy.generateDescription(params)
            : '';

        if (selectedTemplateId) {
            const activeTpl = symbolTemplates.find(t =>
                String(t.documentId || t.id) === String(selectedTemplateId) ||
                String(t.id) === String(selectedTemplateId)
            );
            if (activeTpl) {
                setOverwriteTemplateId(String(activeTpl.documentId || activeTpl.id));
                setTemplateNameInput(activeTpl.name || '');
                setTemplateDescInput(activeTpl.description || defaultDesc);
                setSaveModalOpen(true);
                return;
            }
        }

        setOverwriteTemplateId('__NEW__');
        const defaultName = `${selectedSymbol} - ${currentStrategy.name.replace(' Strategy', '')} (${timeframe})`;
        setTemplateNameInput(defaultName);
        setTemplateDescInput(defaultDesc);
        setSaveModalOpen(true);
    };

    const handleModalSelectTemplate = (val) => {
        setOverwriteTemplateId(val);
        const defaultDesc = typeof currentStrategy?.generateDescription === 'function'
            ? currentStrategy.generateDescription(params)
            : '';

        if (!val || val === '__NEW__') {
            const defaultName = `${selectedSymbol} - ${currentStrategy.name.replace(' Strategy', '')} (${timeframe})`;
            setTemplateNameInput(defaultName);
            setTemplateDescInput(defaultDesc);
        } else {
            const tpl = symbolTemplates.find(t =>
                String(t.documentId || t.id) === String(val) ||
                String(t.id) === String(val)
            );
            if (tpl) {
                setTemplateNameInput(tpl.name || '');
                setTemplateDescInput(tpl.description || defaultDesc);
            }
        }
    };

    const handleSaveTemplate = async (e) => {
        if (e) e.preventDefault();
        const name = templateNameInput.trim();
        if (!name) return;

        setSavingTemplate(true);
        try {
            const currentSymObj = symbols.find(s => String(s.Name || s.name || '').trim().toUpperCase() === String(selectedSymbol).trim().toUpperCase());
            const defaultDesc = typeof currentStrategy?.generateDescription === 'function'
                ? currentStrategy.generateDescription(params)
                : '';

            // Extract backtest summary metrics if available
            const metrics = scanResult?.summary ? {
                profitFactor: profitFactor !== undefined && profitFactor !== null ? profitFactor : (scanResult.summary.profitFactor ?? 0),
                winRate: scanResult.summary.winRate ?? 0,
                totalTrades: scanResult.summary.totalTrades ?? 0,
                closedTrades: scanResult.summary.closedTrades ?? 0,
                winTrades: scanResult.summary.winTrades ?? 0,
                lossTrades: scanResult.summary.lossTrades ?? 0,
                totalPnlPercent: scanResult.summary.totalPnlPercent ?? 0,
                avgPnlPercent: scanResult.summary.avgPnlPercent ?? 0,
                grossProfit: scanResult.summary.grossProfit ?? 0,
                grossLoss: scanResult.summary.grossLoss ?? 0,
                calculatedAt: new Date().toISOString(),
            } : (
                (overwriteTemplateId && overwriteTemplateId !== '__NEW__')
                    ? (symbolTemplates.find(t => String(t.documentId || t.id) === String(overwriteTemplateId))?.config?.metrics || null)
                    : null
            );

            const payload = {
                name,
                description: templateDescInput.trim() || defaultDesc,
                strategyFile: selectedStrategyFile,
                timeframe,
                config: {
                    ...params,
                    countback,
                    metrics,
                    backtestSummary: metrics,
                },
                symbol: currentSymObj?.documentId || currentSymObj?.id || null,
                symbolName: selectedSymbol,
                account: selectedAccount?.documentId || selectedAccount?.id || null,
            };

            let savedResult = null;
            if (overwriteTemplateId && overwriteTemplateId !== '__NEW__') {
                savedResult = await updateStrategyTemplate(overwriteTemplateId, payload);
            } else {
                savedResult = await createStrategyTemplate(payload);
            }

            const updatedTemplates = await getStrategyTemplates();
            setTemplates(updatedTemplates);
            if (savedResult?.documentId || savedResult?.id) {
                setSelectedTemplateId(String(savedResult.documentId || savedResult.id));
            }
            setSaveModalOpen(false);
            setTemplateNameInput('');
            setTemplateDescInput('');
            setOverwriteTemplateId('');
        } catch (err) {
            console.error('Failed to save strategy template:', err);
            const errDetail = err?.response?.data?.error?.message || err?.message || 'Không thể lưu template chiến lược.';
            setErrorMessage(typeof errDetail === 'object' ? JSON.stringify(errDetail) : String(errDetail));
        } finally {
            setSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = async (templateId, e) => {
        if (e) e.stopPropagation();
        if (!templateId) return;
        if (!window.confirm('Bạn có chắc chắn muốn xóa template chiến lược này?')) return;

        try {
            await deleteStrategyTemplate(templateId);
            const updated = await getStrategyTemplates();
            setTemplates(updated);
            if (String(selectedTemplateId) === String(templateId)) {
                setSelectedTemplateId('');
            }
        } catch (err) {
            console.error('Failed to delete template:', err);
        }
    };

    // Đổi file chiến lược: nạp params và optFlags mặc định theo schema mới
    const handleStrategyChange = (newFileName) => {
        setSelectedStrategyFile(newFileName);
        const newParams = getDefaultParams(newFileName);
        const newOptFlags = getDefaultOptFlags(newFileName);
        setParams(newParams);
        setOptFlags(newOptFlags);
        setBestInfo(null);
        setCountback(1000);
        setHasMore(true);
        setScanResult(null);
    };

    // Tự động scan lần đầu khi chọn symbol hoặc đổi chiến lược / timeframe
    useEffect(() => {
        if (selectedSymbol && !scanResult && !scanning && !optimizing) {
            handleScan(selectedSymbol);
        }
    }, [selectedSymbol, selectedStrategyFile, timeframe]); // eslint-disable-line react-hooks/exhaustive-deps

    // Chuẩn bị dữ liệu nến cho TradingViewChart
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

    // Chuẩn bị Markers tín hiệu cho TradingViewChart (sử dụng common helper)
    const chartSignals = useMemo(() => {
        return buildPythonChartSignals(scanResult?.signals);
    }, [scanResult]);

    const summary = scanResult?.summary;

    // Tính toán Profit Factor
    const profitFactor = useMemo(() => {
        if (summary?.profitFactor !== undefined && summary?.profitFactor !== null) {
            return summary.profitFactor;
        }
        if (!scanResult?.trades) return 0;
        const closed = scanResult.trades.filter(t => t.status === 'Closed');
        if (closed.length === 0) return 0;

        const grossProfit = closed
            .filter(t => (t.pnl_percent || 0) > 0)
            .reduce((sum, t) => sum + (t.pnl_percent || 0), 0);

        const grossLoss = closed
            .filter(t => (t.pnl_percent || 0) < 0)
            .reduce((sum, t) => sum + Math.abs(t.pnl_percent || 0), 0);

        if (grossLoss === 0) {
            return grossProfit > 0 ? '∞' : '0.00';
        }
        return (grossProfit / grossLoss).toFixed(2);
    }, [scanResult, summary]);

    // Zoom biểu đồ tới nến Entry khi click View
    const handleViewTrade = useCallback((trade) => {
        const targetDate = trade.entry_time || (trade.entry_date ? String(trade.entry_date).split('T')[0] : null);
        if (targetDate) {
            setFocusDate(targetDate);
            chartCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    return (
        <div className="flex-1 flex flex-col bg-gray-900 text-gray-100 min-h-screen space-y-6">
            {/* 1. Header Area */}
            <StrategyHeader
                selectedAccount={selectedAccount}
                selectedSymbol={selectedSymbol}
            />

            {/* 2. Watchlist & Symbol Selection Box */}
            <WatchlistSymbolBar
                selectedWatchlistId={selectedWatchlistId}
                onWatchlistChange={(val) => {
                    setSelectedWatchlistId(val);
                    setSelectedSymbol('');
                    setScanResult(null);
                    setBestInfo(null);
                }}
                accountWatchlists={accountWatchlists}
                selectedSymbol={selectedSymbol}
                onSymbolChange={(sym) => {
                    setSelectedSymbol(sym);
                    setBestInfo(null);
                    setCountback(1000);
                    setHasMore(true);
                    if (sym) {
                        handleScan(sym, 1000, timeframe);
                    } else {
                        setScanResult(null);
                    }
                }}
                watchlistSymbols={watchlistSymbols}
                selectedTemplateId={selectedTemplateId}
                onTemplateSelect={handleSelectTemplate}
                onTemplateDelete={handleDeleteTemplate}
                onOpenTemplatesList={() => setTemplatesListModalOpen(true)}
                symbolTemplates={symbolTemplates}
                timeframe={timeframe}
                onTimeframeChange={(newTf) => {
                    setTimeframe(newTf);
                    setCountback(1000);
                    setHasMore(true);
                    setBestInfo(null);
                    handleScan(selectedSymbol, 1000, newTf);
                }}
            />

            {/* 3. Strategy Configuration Box (Dynamic Form) */}
            <DynamicStrategyForm
                strategyFiles={strategyFiles}
                selectedStrategyFile={selectedStrategyFile}
                onStrategyChange={handleStrategyChange}
                currentStrategy={currentStrategy}
                params={params}
                onParamChange={handleParamChange}
                optFlags={optFlags}
                onOptFlagChange={handleOptFlagChange}
                onToggleAllOpt={handleToggleAllOpt}
                optCount={optCount}
                totalOptCount={totalOptCount}
                timeframe={timeframe}
                spreadValues={spreadValues}
                symbolInsightStats={symbolInsightStats}
                loadingInsightStats={loadingInsightStats}
                onOpenInsightModal={handleOpenInsightModal}
                selectedSymbol={selectedSymbol}
                scanResult={scanResult}
                scanning={scanning}
                optimizing={optimizing}
                optimizationConfigsCount={optimizationConfigs.length}
                onResetDefault={handleResetDefault}
                onOpenSaveModal={handleOpenSaveModal}
                onOpenLeaderboard={() => setOptimizationModalOpen(true)}
                onOptimize={() => handleOptimize(selectedSymbol)}
                onScan={() => handleScan(selectedSymbol)}
            />

            {/* 4. Optimal Params Success Banner */}
            <OptimalConfigBanner
                bestInfo={bestInfo}
                onClose={() => setBestInfo(null)}
                onOpenLeaderboard={() => setOptimizationModalOpen(true)}
                hasLeaderboard={optimizationConfigs.length > 0}
                currentStrategy={currentStrategy}
            />

            {/* 5. Error Banner */}
            {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-sm text-red-300 flex items-center gap-2.5">
                    <AlertTriangle size={18} className="text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* 6. Summary Metrics Bar */}
            <SummaryMetricsBar
                scanResult={scanResult}
                profitFactor={profitFactor}
            />

            {/* 7. Active Position Action Bar */}
            <ActiveTradeBanner
                activeTrade={summary?.activeTrade}
                ticker={scanResult?.ticker || selectedSymbol}
            />

            {/* 8. Chart Area */}
            <TradingChartSection
                chartCardRef={chartCardRef}
                scanning={scanning}
                chartCandles={chartCandles}
                chartSignals={chartSignals}
                symbol={scanResult?.ticker || selectedSymbol}
                timeframe={timeframe}
                currentStrategy={currentStrategy}
                params={params}
                focusDate={focusDate}
                onLoadMore={handleLoadMore}
                loadingMore={loadingMore}
                hasMore={hasMore}
                liveCandle={liveCandle}
                livePrice={livePrice}
                wsStatus={wsStatus}
                isCryptoSymbol={isCryptoSymbol}
            />

            {/* 9. Trades History Table */}
            <TradesHistoryTable
                trades={scanResult?.trades || []}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                focusDate={focusDate}
                onViewTrade={handleViewTrade}
                ticker={scanResult?.ticker || selectedSymbol}
            />

            {/* 10. Deflated Sharpe Ratio Card */}
            {scanResult?.trades && scanResult.trades.length > 0 && (
                <DeflatedSharpeRatioCard
                    trades={scanResult.trades}
                    timeframe={timeframe}
                    defaultTrials={bestInfo ? 1440 : 1}
                />
            )}

            {/* 11. Modal Lưu Strategy Template */}
            <SaveTemplateModal
                isOpen={saveModalOpen}
                onClose={() => setSaveModalOpen(false)}
                onSave={handleSaveTemplate}
                saving={savingTemplate}
                templateNameInput={templateNameInput}
                setTemplateNameInput={setTemplateNameInput}
                templateDescInput={templateDescInput}
                setTemplateDescInput={setTemplateDescInput}
                overwriteTemplateId={overwriteTemplateId}
                onModalSelectTemplate={handleModalSelectTemplate}
                symbolTemplates={symbolTemplates}
                selectedSymbol={selectedSymbol}
                selectedStrategyFile={selectedStrategyFile}
                timeframe={timeframe}
                currentStrategy={currentStrategy}
                params={params}
                scanResult={scanResult}
                profitFactor={profitFactor}
            />

            {/* 12. Modal Lịch sử Insight đã lưu (SymbolInsight) */}
            <InsightHistoryModal
                isOpen={insightModalOpen}
                onClose={() => setInsightModalOpen(false)}
                selectedSymbol={selectedSymbol}
                loadingInsightStats={loadingInsightStats}
                savedInsightsList={savedInsightsList}
                symbolInsightStats={symbolInsightStats}
                onSelectInsightItem={handleSelectInsightItem}
            />

            {/* 13. Modal BXH Cấu Hình Tối Ưu (Optimization Leaderboard) */}
            <OptimizationLeaderboardModal
                isOpen={optimizationModalOpen}
                onClose={() => setOptimizationModalOpen(false)}
                optimizationConfigs={optimizationConfigs}
                activeAppliedConfigRank={activeAppliedConfigRank}
                onApplyConfig={handleApplyOptimizeConfig}
                selectedSymbol={selectedSymbol}
                selectedStrategyFile={selectedStrategyFile}
                timeframe={timeframe}
                currentStrategy={currentStrategy}
            />

            {/* 14. Modal Danh sách tất cả Strategy Templates */}
            <StrategyTemplatesListModal
                isOpen={templatesListModalOpen}
                onClose={() => setTemplatesListModalOpen(false)}
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                defaultTemplateId={
                    (() => {
                        const targetSymObj = (Array.isArray(symbols) ? symbols : []).find(s =>
                            String(s.Name || s.name || '').trim().toUpperCase() === String(selectedSymbol).trim().toUpperCase()
                        );
                        return targetSymObj?.strategy_template?.documentId || targetSymObj?.strategy_template?.id || (typeof targetSymObj?.strategy_template === 'string' || typeof targetSymObj?.strategy_template === 'number' ? targetSymObj.strategy_template : null);
                    })()
                }
                selectedSymbol={selectedSymbol}
                onApplyTemplate={handleApplyTemplateModal}
                onSetDefaultTemplate={handleSetDefaultTemplate}
                onDeleteTemplate={handleDeleteTemplate}
            />
        </div>
    );
};

export default PythonStrategy;
