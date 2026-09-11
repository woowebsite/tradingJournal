import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    BrainCircuit,
    Play,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    ShieldAlert,
    Target,
    Activity,
    Sliders,
    ExternalLink,
    Search,
    ListFilter,
    Layers,
    Clock,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    BarChart3,
    DollarSign,
    Award,
    Eye,
    Sparkles,
    RotateCcw,
    BookmarkPlus,
    Bookmark,
    Trash2,
    Save,
    X,
    Check
} from 'lucide-react';
import { fetchWatchlists } from '../features/watchlistSlice';
import { fetchSymbols } from '../features/marketSlice';
import { useAccount } from '../context/AccountContext';
import { getPythonStrategies, scanPythonStrategy, optimizePythonStrategy } from '../services/pythonStrategy';
import { getStrategyTemplates, createStrategyTemplate, updateStrategyTemplate, deleteStrategyTemplate } from '../services/strategyTemplate';
import TradingViewChart from '../components/TradingViewChart';
import DeflatedSharpeRatioCard from '../components/DeflatedSharpeRatioCard';
import { formatNumber } from '../utils/formatNumber';
import dayjs from 'dayjs';

const PythonStrategy = () => {
    const dispatch = useDispatch();
    const { selectedAccount, defaultWatchlist } = useAccount();
    const { items: watchlists = [] } = useSelector(state => state.watchlists);
    const { symbols = [] } = useSelector(state => state.market);
    const chartCardRef = useRef(null);

    // States
    const [strategyFiles, setStrategyFiles] = useState([]);
    const [selectedStrategyFile, setSelectedStrategyFile] = useState('strategy_supertrend_ma288.py');
    const [selectedWatchlistId, setSelectedWatchlistId] = useState('');
    const [selectedSymbol, setSelectedSymbol] = useState('');

    // Supertrend Strategy States
    const [riskReward, setRiskReward] = useState(1.5);
    const [entryType, setEntryType] = useState('candle_close'); // 'candle_close' | 'st_reversal'
    const [stPeriod, setStPeriod] = useState(10);
    const [stMultiplier, setStMultiplier] = useState(3.0);
    const [maPeriod, setMaPeriod] = useState(288);
    const [tpSupertrend, setTpSupertrend] = useState(true);
    const [tpRR, setTpRR] = useState(true);

    // VWAP + MA9 Strategy States
    const [vwapMaPeriod, setVwapMaPeriod] = useState(9);
    const [vwapAnchor, setVwapAnchor] = useState('year');
    const [vwapTpTarget, setVwapTpTarget] = useState('tp1_vwap'); // 'tp1_vwap' | 'tp2_upper2' | 'tp3_upper3'
    const [mult1, setMult1] = useState(1.0);
    const [mult2, setMult2] = useState(2.0);
    const [mult3, setMult3] = useState(3.0);

    // Common States
    const [timeframe, setTimeframe] = useState('D1');
    const [countback, setCountback] = useState(1000);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [allowLong, setAllowLong] = useState(true);
    const [allowShort, setAllowShort] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [optimizing, setOptimizing] = useState(false);
    const [bestInfo, setBestInfo] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'Open', 'Closed', 'Long', 'Short'
    const [focusDate, setFocusDate] = useState(null);

    // Strategy Template States
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [overwriteTemplateId, setOverwriteTemplateId] = useState('');
    const [templateNameInput, setTemplateNameInput] = useState('');
    const [templateDescInput, setTemplateDescInput] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);

    // Lọc Strategy Templates chỉ thuộc về Symbol đang chọn
    const symbolTemplates = useMemo(() => {
        if (!selectedSymbol) return [];
        const cleanSym = String(selectedSymbol).trim().toUpperCase();
        return templates.filter(t => {
            const tSymName = String(t.symbolName || t.symbol?.Name || t.symbol?.name || '').trim().toUpperCase();
            return tSymName === cleanSym;
        });
    }, [templates, selectedSymbol]);

    // Reset selectedTemplateId khi đổi symbol nếu template đang chọn không thuộc symbol mới
    useEffect(() => {
        if (selectedTemplateId) {
            const exists = symbolTemplates.some(t => String(t.id || t.documentId) === String(selectedTemplateId));
            if (!exists) {
                setSelectedTemplateId('');
            }
        }
    }, [selectedSymbol, symbolTemplates, selectedTemplateId]);

    const isVWAP = useMemo(() => {
        return String(selectedStrategyFile || '').toLowerCase().includes('vwap');
    }, [selectedStrategyFile]);

    // 1. Tải danh sách Watchlists, Symbols, Python Strategies và Strategy Templates
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

    // 2. Lọc Watchlists theo Account hiện tại
    const accountWatchlists = useMemo(() => {
        if (!selectedAccount) return watchlists;
        return watchlists.filter(w => {
            const marketMatch = !w.market || w.market.documentId === selectedAccount?.market?.documentId || w.market.id === selectedAccount?.market?.id;
            const accountMatch = !w.account || w.account.documentId === selectedAccount.documentId || w.account.id === selectedAccount.id;
            return marketMatch && accountMatch;
        });
    }, [watchlists, selectedAccount]);

    // Lấy symbols của watchlist đang chọn (chuẩn hóa thành danh sách tên symbol dạng string)
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

    // 3. Tự động chọn Watchlist đầu tiên khi load xong
    useEffect(() => {
        if (accountWatchlists.length > 0 && !selectedWatchlistId) {
            setSelectedWatchlistId(accountWatchlists[0].documentId || accountWatchlists[0].id);
        }
    }, [accountWatchlists, selectedWatchlistId]);

    // Khi đổi Watchlist -> nếu selectedSymbol không nằm trong Watchlist mới thì reset
    useEffect(() => {
        if (watchlistSymbols.length > 0 && selectedSymbol) {
            const currentSelectedInList = watchlistSymbols.includes(selectedSymbol);
            if (!currentSelectedInList) {
                setSelectedSymbol('');
                setScanResult(null);
            }
        }
    }, [watchlistSymbols, selectedSymbol]);

    // 4. Hàm thực hiện Scan Signal qua Python Backend
    const handleScan = useCallback(async (tickerToScan = null, customCountback = null, customTimeframe = null) => {
        const ticker = String(tickerToScan || selectedSymbol || '').trim().toUpperCase();
        const currentTf = String(customTimeframe || timeframe || 'D1').trim().toUpperCase();
        if (!ticker) {
            setErrorMessage('Vui lòng chọn Symbol trước khi chạy Scan.');
            return;
        }

        if (!allowLong && !allowShort) {
            setErrorMessage('Vui lòng chọn ít nhất 1 loại lệnh (Long Trade hoặc Short Trade).');
            return;
        }

        if (!isVWAP && !tpSupertrend && !tpRR) {
            setErrorMessage('Vui lòng chọn ít nhất 1 phương thức chốt lời (Supertrend đảo chiều hoặc Tỷ lệ R:R).');
            return;
        }

        setScanning(true);
        setErrorMessage('');
        const reqCountback = customCountback || countback || 1000;
        try {
            const payload = isVWAP ? {
                strategyFile: selectedStrategyFile,
                ticker,
                timeframe: currentTf,
                countback: reqCountback,
                maPeriod: parseInt(vwapMaPeriod) || 9,
                vwapAnchor,
                mult1: parseFloat(mult1) || 1.0,
                mult2: parseFloat(mult2) || 2.0,
                mult3: parseFloat(mult3) || 3.0,
                tpTarget: vwapTpTarget,
                allowLong,
                allowShort,
            } : {
                strategyFile: selectedStrategyFile,
                ticker,
                timeframe: currentTf,
                countback: reqCountback,
                rr: parseFloat(riskReward) || 1.5,
                entryType,
                stPeriod: parseInt(stPeriod) || 10,
                stMultiplier: parseFloat(stMultiplier) || 3.0,
                maPeriod: parseInt(maPeriod) || 288,
                allowLong,
                allowShort,
                tpSupertrend,
                tpRR,
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
            console.error('Scan error:', err);
            const errDetail = err?.response?.data?.error?.message || err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi thực thi chiến lược Python.';
            setErrorMessage(typeof errDetail === 'object' ? JSON.stringify(errDetail) : String(errDetail));
            setScanResult(null);
        } finally {
            setScanning(false);
        }
    }, [selectedSymbol, allowLong, allowShort, isVWAP, tpSupertrend, tpRR, countback, selectedStrategyFile, timeframe, vwapMaPeriod, vwapAnchor, mult1, mult2, mult3, vwapTpTarget, riskReward, entryType, stPeriod, stMultiplier, maPeriod]);

    // 4.1 Hàm cuộn sang trái tải thêm nến lịch sử (Infinite Scroll)
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
            const payload = isVWAP ? {
                strategyFile: selectedStrategyFile,
                ticker,
                timeframe,
                countback: nextCount,
                maPeriod: parseInt(vwapMaPeriod) || 9,
                vwapAnchor,
                mult1: parseFloat(mult1) || 1.0,
                mult2: parseFloat(mult2) || 2.0,
                mult3: parseFloat(mult3) || 3.0,
                tpTarget: vwapTpTarget,
                allowLong,
                allowShort,
            } : {
                strategyFile: selectedStrategyFile,
                ticker,
                timeframe,
                countback: nextCount,
                rr: parseFloat(riskReward) || 1.5,
                entryType,
                stPeriod: parseInt(stPeriod) || 10,
                stMultiplier: parseFloat(stMultiplier) || 3.0,
                maPeriod: parseInt(maPeriod) || 288,
                allowLong,
                allowShort,
                tpSupertrend,
                tpRR,
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
    }, [scanning, optimizing, loadingMore, hasMore, countback, scanResult, selectedSymbol, isVWAP, selectedStrategyFile, timeframe, vwapMaPeriod, vwapAnchor, mult1, mult2, mult3, vwapTpTarget, allowLong, allowShort, riskReward, entryType, stPeriod, stMultiplier, maPeriod, tpSupertrend, tpRR]);

    // 4.2 Hàm tối ưu hóa tham số (Best Params Optimizer)
    const handleOptimize = useCallback(async (tickerToOptimize) => {
        const ticker = String(tickerToOptimize || selectedSymbol || '').trim().toUpperCase();
        if (!ticker) {
            setErrorMessage('Vui lòng chọn Symbol trước khi chạy Optimize.');
            return;
        }

        if (!allowLong && !allowShort) {
            setErrorMessage('Vui lòng chọn ít nhất 1 loại lệnh (Long Trade hoặc Short Trade).');
            return;
        }

        setOptimizing(true);
        setErrorMessage('');
        setBestInfo(null);
        try {
            const result = await optimizePythonStrategy({
                strategyFile: selectedStrategyFile,
                ticker,
                timeframe,
                countback: 50000,
                allowLong,
                allowShort,
                vwapAnchor,
            });

            if (result?.error) {
                setErrorMessage(result.error);
            } else {
                if (result?.bestParams) {
                    const bp = result.bestParams;
                    if (isVWAP) {
                        if (bp.maPeriod !== undefined) setVwapMaPeriod(bp.maPeriod);
                        if (bp.tpTarget !== undefined) setVwapTpTarget(bp.tpTarget);
                        if (bp.mult2 !== undefined) setMult2(bp.mult2);
                        if (bp.mult3 !== undefined) setMult3(bp.mult3);
                        if (bp.vwapAnchor !== undefined) setVwapAnchor(bp.vwapAnchor);
                    } else {
                        if (bp.stPeriod !== undefined) setStPeriod(bp.stPeriod);
                        if (bp.stMultiplier !== undefined) setStMultiplier(bp.stMultiplier);
                        if (bp.maPeriod !== undefined) setMaPeriod(bp.maPeriod);
                        if (bp.riskReward !== undefined) setRiskReward(bp.riskReward);
                        if (bp.entryType !== undefined) setEntryType(bp.entryType);
                        if (bp.tpSupertrend !== undefined) setTpSupertrend(bp.tpSupertrend);
                        if (bp.tpRR !== undefined) setTpRR(bp.tpRR);
                    }
                    setBestInfo(bp);
                }
                if (result?.candles?.length) {
                    setCountback(result.candles.length);
                }
                setScanResult(result);
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
    }, [selectedStrategyFile, selectedSymbol, allowLong, allowShort, isVWAP, timeframe, vwapAnchor]);

    // 4.2 Hàm reset các thông số về mặc định (Default)
    const handleResetDefault = useCallback(() => {
        setBestInfo(null);
        setErrorMessage('');
        const ticker = String(selectedSymbol || '').trim().toUpperCase();

        if (isVWAP) {
            const defaultVWAP = {
                maPeriod: 9,
                vwapAnchor: 'year',
                mult1: 1.0,
                mult2: 2.0,
                mult3: 3.0,
                tpTarget: 'tp1_vwap',
                allowLong: true,
                allowShort: true,
            };

            setVwapMaPeriod(defaultVWAP.maPeriod);
            setVwapAnchor(defaultVWAP.vwapAnchor);
            setMult1(defaultVWAP.mult1);
            setMult2(defaultVWAP.mult2);
            setMult3(defaultVWAP.mult3);
            setVwapTpTarget(defaultVWAP.tpTarget);
            setAllowLong(defaultVWAP.allowLong);
            setAllowShort(defaultVWAP.allowShort);

            if (ticker) {
                setScanning(true);
                scanPythonStrategy({
                    strategyFile: selectedStrategyFile,
                    ticker,
                    countback: 500,
                    maPeriod: defaultVWAP.maPeriod,
                    vwapAnchor: defaultVWAP.vwapAnchor,
                    mult1: defaultVWAP.mult1,
                    mult2: defaultVWAP.mult2,
                    mult3: defaultVWAP.mult3,
                    tpTarget: defaultVWAP.tpTarget,
                    allowLong: defaultVWAP.allowLong,
                    allowShort: defaultVWAP.allowShort,
                })
                    .then((result) => {
                        if (result?.error) setErrorMessage(result.error);
                        else setScanResult(result);
                    })
                    .catch((err) => console.error(err))
                    .finally(() => setScanning(false));
            }
        } else {
            const defaultParams = {
                stPeriod: 10,
                stMultiplier: 3.0,
                maPeriod: 288,
                riskReward: 1.5,
                entryType: 'candle_close',
                tpSupertrend: true,
                tpRR: true,
                allowLong: true,
                allowShort: true,
            };

            setStPeriod(defaultParams.stPeriod);
            setStMultiplier(defaultParams.stMultiplier);
            setMaPeriod(defaultParams.maPeriod);
            setRiskReward(defaultParams.riskReward);
            setEntryType(defaultParams.entryType);
            setTpSupertrend(defaultParams.tpSupertrend);
            setTpRR(defaultParams.tpRR);
            setAllowLong(defaultParams.allowLong);
            setAllowShort(defaultParams.allowShort);

            if (ticker) {
                setScanning(true);
                scanPythonStrategy({
                    strategyFile: selectedStrategyFile,
                    ticker,
                    countback: 500,
                    rr: defaultParams.riskReward,
                    entryType: defaultParams.entryType,
                    stPeriod: defaultParams.stPeriod,
                    stMultiplier: defaultParams.stMultiplier,
                    maPeriod: defaultParams.maPeriod,
                    allowLong: defaultParams.allowLong,
                    allowShort: defaultParams.allowShort,
                    tpSupertrend: defaultParams.tpSupertrend,
                    tpRR: defaultParams.tpRR,
                })
                    .then((result) => {
                        if (result?.error) setErrorMessage(result.error);
                        else setScanResult(result);
                    })
                    .catch((err) => console.error(err))
                    .finally(() => setScanning(false));
            }
        }
    }, [selectedSymbol, selectedStrategyFile, isVWAP]);

    // 4.3 Template Handlers: Select, Save, Delete
    const handleSelectTemplate = (templateId) => {
        setSelectedTemplateId(templateId);
        if (!templateId) return;
        const tpl = templates.find(t => String(t.id || t.documentId) === String(templateId));
        if (!tpl) return;

        if (tpl.strategyFile && tpl.strategyFile !== selectedStrategyFile) {
            setSelectedStrategyFile(tpl.strategyFile);
        }
        const targetTf = tpl.timeframe || timeframe;
        if (tpl.timeframe) {
            setTimeframe(tpl.timeframe);
        }

        const cfg = tpl.config || {};
        const isTargetVWAP = (tpl.strategyFile || selectedStrategyFile || '').toLowerCase().includes('vwap');

        if (isTargetVWAP) {
            if (cfg.vwapMaPeriod !== undefined) setVwapMaPeriod(cfg.vwapMaPeriod);
            if (cfg.vwapAnchor !== undefined) setVwapAnchor(cfg.vwapAnchor);
            if (cfg.vwapTpTarget !== undefined) setVwapTpTarget(cfg.vwapTpTarget);
            if (cfg.mult1 !== undefined) setMult1(cfg.mult1);
            if (cfg.mult2 !== undefined) setMult2(cfg.mult2);
            if (cfg.mult3 !== undefined) setMult3(cfg.mult3);
        } else {
            if (cfg.riskReward !== undefined) setRiskReward(cfg.riskReward);
            if (cfg.entryType !== undefined) setEntryType(cfg.entryType);
            if (cfg.stPeriod !== undefined) setStPeriod(cfg.stPeriod);
            if (cfg.stMultiplier !== undefined) setStMultiplier(cfg.stMultiplier);
            if (cfg.maPeriod !== undefined) setMaPeriod(cfg.maPeriod);
            if (cfg.tpSupertrend !== undefined) setTpSupertrend(cfg.tpSupertrend);
            if (cfg.tpRR !== undefined) setTpRR(cfg.tpRR);
        }

        if (cfg.allowLong !== undefined) setAllowLong(cfg.allowLong);
        if (cfg.allowShort !== undefined) setAllowShort(cfg.allowShort);
        const reqCount = cfg.countback || countback || 1000;
        setCountback(reqCount);
        setBestInfo(null);
        setHasMore(true);

        handleScan(selectedSymbol, reqCount, targetTf);
    };

    const handleOpenSaveModal = () => {
        if (selectedTemplateId) {
            const activeTpl = symbolTemplates.find(t =>
                String(t.documentId || t.id) === String(selectedTemplateId) ||
                String(t.id) === String(selectedTemplateId)
            );
            if (activeTpl) {
                setOverwriteTemplateId(String(activeTpl.documentId || activeTpl.id));
                setTemplateNameInput(activeTpl.name || '');
                setTemplateDescInput(activeTpl.description || '');
                setSaveModalOpen(true);
                return;
            }
        }

        setOverwriteTemplateId('__NEW__');
        const defaultName = isVWAP
            ? `${selectedSymbol} - VWAP MA${vwapMaPeriod} ${vwapAnchor.toUpperCase()} (${timeframe})`
            : `${selectedSymbol} - Supertrend MA${maPeriod} (${timeframe})`;
        setTemplateNameInput(defaultName);
        setTemplateDescInput('');
        setSaveModalOpen(true);
    };

    const handleModalSelectTemplate = (val) => {
        setOverwriteTemplateId(val);
        if (!val || val === '__NEW__') {
            const defaultName = isVWAP
                ? `${selectedSymbol} - VWAP MA${vwapMaPeriod} ${vwapAnchor.toUpperCase()} (${timeframe})`
                : `${selectedSymbol} - Supertrend MA${maPeriod} (${timeframe})`;
            setTemplateNameInput(defaultName);
            setTemplateDescInput('');
        } else {
            const tpl = symbolTemplates.find(t =>
                String(t.documentId || t.id) === String(val) ||
                String(t.id) === String(val)
            );
            if (tpl) {
                setTemplateNameInput(tpl.name || '');
                setTemplateDescInput(tpl.description || '');
            }
        }
    };

    const handleSaveTemplate = async (e) => {
        if (e) e.preventDefault();
        const name = templateNameInput.trim();
        if (!name) return;

        setSavingTemplate(true);
        try {
            const config = isVWAP ? {
                vwapMaPeriod: parseInt(vwapMaPeriod) || 9,
                vwapAnchor,
                vwapTpTarget,
                mult1: parseFloat(mult1) || 1.0,
                mult2: parseFloat(mult2) || 2.0,
                mult3: parseFloat(mult3) || 3.0,
                allowLong,
                allowShort,
                countback,
            } : {
                riskReward: parseFloat(riskReward) || 1.5,
                entryType,
                stPeriod: parseInt(stPeriod) || 10,
                stMultiplier: parseFloat(stMultiplier) || 3.0,
                maPeriod: parseInt(maPeriod) || 288,
                tpSupertrend,
                tpRR,
                allowLong,
                allowShort,
                countback,
            };

            const currentSymObj = symbols.find(s => String(s.Name || s.name || '').trim().toUpperCase() === String(selectedSymbol).trim().toUpperCase());

            const payload = {
                name,
                description: templateDescInput.trim(),
                strategyFile: selectedStrategyFile,
                timeframe,
                config,
                symbol: currentSymObj?.documentId || currentSymObj?.id || null,
                symbolName: selectedSymbol,
                account: selectedAccount?.documentId || selectedAccount?.id || null,
            };

            let savedResult = null;
            if (overwriteTemplateId && overwriteTemplateId !== '__NEW__') {
                // Ghi đè template đã chọn
                savedResult = await updateStrategyTemplate(overwriteTemplateId, payload);
            } else {
                // Tạo template mới
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

    // Khi đổi file chiến lược, tự động scan lại với chiến lược mới
    const handleStrategyChange = (newFileName) => {
        setSelectedStrategyFile(newFileName);
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

    // 5. Chuẩn bị dữ liệu nến cho TradingViewChart
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

    // 6. Chuẩn bị Markers tín hiệu cho TradingViewChart
    const chartSignals = useMemo(() => {
        if (!scanResult?.signals) return [];
        return scanResult.signals.map(sig => {
            const isEntry = sig.action === 'Entry';
            const isTP = sig.type === 'takeprofit';
            const isSL = sig.type === 'stoploss';
            const isShort = sig.type === 'Short' || sig.pos_type === 'Short';
            const isLong = sig.type === 'Long' || sig.pos_type === 'Long';

            let ruleType = 'entry';
            let color = '#10b981'; // Green
            let shape = 'arrowUp';
            let position = 'belowBar';
            let text = '';

            if (isTP) {
                ruleType = 'takeprofit';
                color = '#3b82f6'; // Luôn là mũi tên blue
                // Long TP: nằm TRÊN nến hướng xuống (aboveBar)
                // Short TP: nằm DƯỚI nến hướng lên (belowBar)
                if (isShort) {
                    position = 'belowBar';
                    shape = 'arrowUp';
                } else {
                    position = 'aboveBar';
                    shape = 'arrowDown';
                }
            } else if (isSL) {
                ruleType = 'stoploss';
                color = '#ef4444'; // Hình tròn màu đỏ (circle)
                shape = 'circle';
                position = isShort ? 'aboveBar' : 'belowBar';
                text = '';
            } else if (isShort) {
                ruleType = 'entry';
                color = '#ef4444'; // Mũi tên đỏ hướng xuống
                shape = 'arrowDown';
                position = 'aboveBar';
            } else {
                ruleType = 'entry';
                color = '#10b981'; // Mũi tên xanh Green hướng lên
                shape = 'arrowUp';
                position = 'belowBar';
            }

            return {
                date: sig.date,
                time: sig.time,
                type: ruleType,
                posType: sig.pos_type || (isEntry ? sig.type : null),
                action: sig.action,
                color,
                shape,
                position,
                text,
                name: sig.rule?.Name || `${sig.type} @ ${formatNumber(sig.price || sig.entry)}`,
                rules: [
                    {
                        Name: sig.rule?.Name || `${sig.type} @ ${formatNumber(sig.price || sig.entry)}`,
                        Type: ruleType,
                        signalText: isTP ? 'TP' : isSL ? 'SL' : `${sig.type}`
                    }
                ]
            };
        });
    }, [scanResult]);

    // 7. Lọc danh sách Trades hiển thị trong Table
    const tradesList = useMemo(() => {
        if (!scanResult?.trades) return [];
        if (activeTab === 'all') return [...scanResult.trades].reverse();
        if (activeTab === 'Open') return scanResult.trades.filter(t => t.status === 'Open').reverse();
        if (activeTab === 'Closed') return scanResult.trades.filter(t => t.status === 'Closed').reverse();
        if (activeTab === 'Long' || activeTab === 'Short') return scanResult.trades.filter(t => t.type === activeTab).reverse();
        return [...scanResult.trades].reverse();
    }, [scanResult, activeTab]);

    const summary = scanResult?.summary;
    const activeTrade = summary?.activeTrade;

    // 8. Tính toán Profit Factor (Tổng Gross Profit / Tổng Gross Loss)
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

    // 9. Di chuyển và zoom biểu đồ tới nến Entry khi click View
    const handleViewTrade = useCallback((trade) => {
        const targetDate = trade.entry_time || (trade.entry_date ? String(trade.entry_date).split('T')[0] : null);
        if (targetDate) {
            setFocusDate(targetDate);
            chartCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    return (
        <div className="flex-1 flex flex-col p-4 md:p-6 bg-gray-900 text-gray-100 min-h-screen space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 shadow-lg shadow-purple-500/10">
                            <BrainCircuit size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                                Python Strategy
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30">
                                    1 Entry 1 Lúc
                                </span>
                            </h1>
                            <p className="text-sm text-gray-400 mt-0.5">
                                Quét tín hiệu và mô phỏng chu kỳ lệnh (Entry ➔ TP/SL ➔ Tìm Entry mới) trực tiếp từ Python
                            </p>
                        </div>
                    </div>
                </div>

                {/* Account badge */}
                {selectedAccount && (
                    <div className="flex items-center gap-2 bg-gray-800/80 border border-gray-700/60 rounded-xl px-3.5 py-2 self-start md:self-auto shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs text-gray-400">Tài khoản:</span>
                        <span className="text-xs font-semibold text-gray-200">{selectedAccount.Name || selectedAccount.name}</span>
                    </div>
                )}
            </div>

            {/* 1. Box Top: Watchlist & Symbol Selection */}
            <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-700/70 p-4 shadow-xl space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-700/60 pb-2.5">
                    <Layers size={16} className="text-blue-400" />
                    <h2 className="text-sm font-bold text-gray-200 tracking-wide uppercase">
                        Watchlist & Symbol Selection
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                    {/* Dropdown: WatchLists của Account */}
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
                                setBestInfo(null);
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

                    {/* Dropdown: Symbol trong Watchlist */}
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
                                setBestInfo(null);
                                setCountback(1000);
                                setHasMore(true);
                                if (newSym) {
                                    handleScan(newSym, 1000, timeframe);
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

                    {/* Dropdown: Strategy Template */}
                    <div className="lg:col-span-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                <Bookmark size={14} className="text-cyan-400" />
                                Strategy Template {selectedSymbol ? `(${selectedSymbol})` : ''}
                            </label>
                            {selectedTemplateId && (
                                <button
                                    type="button"
                                    onClick={(e) => handleDeleteTemplate(selectedTemplateId, e)}
                                    title="Xóa template đã chọn"
                                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition cursor-pointer"
                                >
                                    <Trash2 size={12} />
                                    <span>Xóa</span>
                                </button>
                            )}
                        </div>
                        <select
                            value={selectedTemplateId}
                            onChange={(e) => handleSelectTemplate(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition cursor-pointer font-medium"
                        >
                            <option value="">
                                {symbolTemplates.length > 0
                                    ? `-- Chọn Template của ${selectedSymbol} (${symbolTemplates.length}) --`
                                    : `-- Chưa có Template (${selectedSymbol}) --`}
                            </option>
                            {symbolTemplates.map(tpl => {
                                const tplId = String(tpl.id || tpl.documentId);
                                const stratShortName = String(tpl.strategyFile || '').replace('strategy_', '').replace('.py', '');
                                return (
                                    <option key={tplId} value={tplId}>
                                        {tpl.name} ({stratShortName} - {tpl.timeframe || 'D1'})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Dropdown: Timeframe */}
                    <div className="lg:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                            <Clock size={14} className="text-amber-400" />
                            Timeframe
                        </label>
                        <select
                            value={timeframe}
                            onChange={(e) => {
                                const newTf = e.target.value;
                                setTimeframe(newTf);
                                setCountback(1000);
                                setHasMore(true);
                                setBestInfo(null);
                                handleScan(selectedSymbol, 1000, newTf);
                            }}
                            className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition cursor-pointer font-semibold"
                        >
                            <option value="M1">M1 (1 Phút)</option>
                            <option value="M5">M5 (5 Phút)</option>
                            <option value="M30">M30 (30 Phút)</option>
                            <option value="H4">H4 (4 Giờ)</option>
                            <option value="D1">D1 (1 Ngày)</option>
                            <option value="W1">W1 (1 Tuần)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. Box Bottom: Strategy Configuration */}
            <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-700/70 p-4 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-gray-700/60 pb-2.5">
                    <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-purple-400" />
                        <h2 className="text-sm font-bold text-gray-200 tracking-wide uppercase">
                            Strategy Configuration
                        </h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* CỘT 1: STRATEGY & INDICATORS CONFIGURATION */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                <BrainCircuit size={14} className="text-purple-400" />
                                Strategy & Indicators Configuration
                            </span>
                        </div>

                        {/* Dropdown: Python Strategy Files */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                <BrainCircuit size={13} className="text-purple-400" />
                                Python Strategy
                            </label>
                            <select
                                value={selectedStrategyFile}
                                onChange={(e) => handleStrategyChange(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition cursor-pointer font-mono h-[42px]"
                            >
                                {strategyFiles.length === 0 ? (
                                    <>
                                        <option value="strategy_supertrend_ma288.py">strategy_supertrend_ma288.py</option>
                                        <option value="strategy_vwap_ma9.py">strategy_vwap_ma9.py</option>
                                    </>
                                ) : (
                                    strategyFiles.map(file => (
                                        <option key={file.fileName} value={file.fileName}>
                                            {file.name || file.fileName}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* Indicator Parameters */}
                        {isVWAP ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {/* MA Period */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center justify-between" title="Chu kỳ MA (SMA)">
                                        <span className="flex items-center gap-1 text-[11px] truncate">
                                            <BarChart3 size={12} className="text-amber-400 shrink-0" />
                                            MA Period
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">9</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="500"
                                        value={vwapMaPeriod}
                                        onChange={(e) => setVwapMaPeriod(e.target.value)}
                                        placeholder="9"
                                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-2 py-2 text-sm text-center text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition font-mono h-[42px]"
                                    />
                                </div>

                                {/* VWAP Anchor */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center justify-between" title="Chu kỳ Anchor của VWAP">
                                        <span className="flex items-center gap-1 text-[11px] truncate">
                                            <Clock size={12} className="text-blue-400 shrink-0" />
                                            Anchor
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">Year</span>
                                    </label>
                                    <select
                                        value={vwapAnchor}
                                        onChange={(e) => setVwapAnchor(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-2 py-2 text-xs text-center text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition cursor-pointer h-[42px]"
                                    >
                                        <option value="day">Ngày (Daily)</option>
                                        <option value="week">Tuần (Weekly)</option>
                                        <option value="month">Tháng (Month)</option>
                                        <option value="quarter">Quý (Quarter)</option>
                                        <option value="year">Năm (Year)</option>
                                    </select>
                                </div>

                                {/* Mult 2 */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center justify-between" title="Hệ số dải Upper 2 / Lower 2">
                                        <span className="flex items-center gap-1 text-[11px] truncate">
                                            <Activity size={12} className="text-purple-400 shrink-0" />
                                            Band 2 (σ)
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">2.0</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.5"
                                        max="5.0"
                                        value={mult2}
                                        onChange={(e) => setMult2(e.target.value)}
                                        placeholder="2.0"
                                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-2 py-2 text-sm text-center text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition font-mono h-[42px]"
                                    />
                                </div>

                                {/* Mult 3 */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center justify-between" title="Hệ số dải Upper 3 / Lower 3">
                                        <span className="flex items-center gap-1 text-[11px] truncate">
                                            <Activity size={12} className="text-rose-400 shrink-0" />
                                            Band 3 (σ)
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">3.0</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="1.0"
                                        max="6.0"
                                        value={mult3}
                                        onChange={(e) => setMult3(e.target.value)}
                                        placeholder="3.0"
                                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-2 py-2 text-sm text-center text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition font-mono h-[42px]"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2.5">
                                {/* Supertrend Period */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center justify-between" title="SUPERTREND_PERIOD">
                                        <span className="flex items-center gap-1 text-[11px] truncate">
                                            <TrendingUp size={12} className="text-emerald-400 shrink-0" />
                                            ST Period
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">10</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="500"
                                        value={stPeriod}
                                        onChange={(e) => setStPeriod(e.target.value)}
                                        placeholder="10"
                                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-2.5 py-2 text-sm text-center text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition font-mono h-[42px]"
                                    />
                                </div>

                                {/* Supertrend Multiplier */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center justify-between" title="SUPERTREND_MULTIPLIER">
                                        <span className="flex items-center gap-1 text-[11px] truncate">
                                            <Activity size={12} className="text-emerald-400 shrink-0" />
                                            ST Multiplier
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">3.0</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="50"
                                        value={stMultiplier}
                                        onChange={(e) => setStMultiplier(e.target.value)}
                                        placeholder="3.0"
                                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-2.5 py-2 text-sm text-center text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition font-mono h-[42px]"
                                    />
                                </div>

                                {/* MA Period */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 flex items-center justify-between" title="MA_PERIOD">
                                        <span className="flex items-center gap-1 text-[11px] truncate">
                                            <BarChart3 size={12} className="text-purple-400 shrink-0" />
                                            MA Period
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">288</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000"
                                        value={maPeriod}
                                        onChange={(e) => setMaPeriod(e.target.value)}
                                        placeholder="288"
                                        className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-2.5 py-2 text-sm text-center text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition font-mono h-[42px]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CỘT 2: ENTRY, TAKE PROFIT & STOP LOSS */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Target size={14} className="text-indigo-400" />
                                Entry, Take Profit & Stop Loss
                            </span>
                        </div>

                        {isVWAP ? (
                            <>
                                {/* Hàng 1: Điều kiện Vào lệnh (Entry) & Lựa chọn Loại lệnh */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                            <Activity size={13} className="text-indigo-400" />
                                            Điều kiện Vào lệnh (Entry)
                                        </label>
                                        <div className="w-full bg-gray-900/90 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-indigo-300 font-medium flex items-center h-[42px]" title="Giá đóng cửa > MA & Giá > Lower 2 & MA < VWAP">
                                            <span className="truncate">Giá &gt; MA{vwapMaPeriod} &amp; Giá &gt; Lower2 &amp; MA &lt; VWAP</span>
                                        </div>
                                    </div>

                                    {/* 2 Checkbox: Long Trade & Short Trade */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                            <Layers size={13} className="text-purple-400" />
                                            Loại lệnh giao dịch
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${allowLong ? 'border-emerald-500/50 bg-emerald-950/20 shadow-sm shadow-emerald-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                                }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={allowLong}
                                                    onChange={(e) => setAllowLong(e.target.checked)}
                                                    className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-600 focus:ring-emerald-500 focus:ring-offset-gray-900 cursor-pointer accent-emerald-500"
                                                />
                                                <TrendingUp size={14} className={allowLong ? 'text-emerald-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                                <span className={`text-xs font-semibold truncate ${allowLong ? 'text-emerald-300' : 'text-gray-400'}`}>
                                                    Long
                                                </span>
                                            </label>

                                            <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${allowShort ? 'border-rose-500/50 bg-rose-950/20 shadow-sm shadow-rose-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                                }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={allowShort}
                                                    onChange={(e) => setAllowShort(e.target.checked)}
                                                    className="w-4 h-4 rounded text-rose-600 bg-gray-800 border-gray-600 focus:ring-rose-500 focus:ring-offset-gray-900 cursor-pointer accent-rose-500"
                                                />
                                                <TrendingDown size={14} className={allowShort ? 'text-rose-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                                <span className={`text-xs font-semibold truncate ${allowShort ? 'text-rose-300' : 'text-gray-400'}`}>
                                                    Short
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Hàng 2: Mục tiêu Chốt lời (Take Profit) & Cắt lỗ (Stop Loss) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                            <Target size={13} className="text-emerald-400" />
                                            Mục tiêu Chốt lời (Take Profit)
                                        </label>
                                        <select
                                            value={vwapTpTarget}
                                            onChange={(e) => setVwapTpTarget(e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition cursor-pointer h-[42px]"
                                        >
                                            <option value="tp1_vwap">TP 1: Tại đường VWAP (Mặc định)</option>
                                            <option value="tp2_upper2">TP 2: Tại dải Upper 2</option>
                                            <option value="tp3_upper3">TP 3: Tại dải Upper 3</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                            <ShieldAlert size={13} className="text-rose-400" />
                                            Cắt lỗ (Stop Loss)
                                        </label>
                                        <div className="w-full bg-gray-900/90 border border-rose-500/30 rounded-xl px-3 py-2 text-xs text-rose-300 font-semibold flex items-center justify-between h-[42px]">
                                            <span>Tại Lower 2 (VWAP - 2.0σ)</span>
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">LOWER 2</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Hàng 1 của Cột 2: Điều kiện Vào lệnh (Entry) & Lựa chọn Loại lệnh (Long / Short Trade) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {/* Dropdown: Loại Entry */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                            <Activity size={13} className="text-indigo-400" />
                                            Điều kiện Vào lệnh (Entry)
                                        </label>
                                        <select
                                            value={entryType}
                                            onChange={(e) => setEntryType(e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition cursor-pointer h-[42px]"
                                        >
                                            <option value="candle_close">Nến xanh/đỏ đóng cửa (Mặc định)</option>
                                            <option value="st_reversal">Supertrend đảo chiều</option>
                                        </select>
                                    </div>

                                    {/* 2 Checkbox: Long Trade & Short Trade */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                            <Layers size={13} className="text-purple-400" />
                                            Loại lệnh giao dịch
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${allowLong ? 'border-emerald-500/50 bg-emerald-950/20 shadow-sm shadow-emerald-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                                }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={allowLong}
                                                    onChange={(e) => setAllowLong(e.target.checked)}
                                                    className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-600 focus:ring-emerald-500 focus:ring-offset-gray-900 cursor-pointer accent-emerald-500"
                                                />
                                                <TrendingUp size={14} className={allowLong ? 'text-emerald-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                                <span className={`text-xs font-semibold truncate ${allowLong ? 'text-emerald-300' : 'text-gray-400'}`}>
                                                    Long
                                                </span>
                                            </label>

                                            <label className={`flex items-center justify-center gap-2 bg-gray-900 border rounded-xl px-2 py-2 cursor-pointer transition select-none h-[42px] ${allowShort ? 'border-rose-500/50 bg-rose-950/20 shadow-sm shadow-rose-950/50' : 'border-gray-700 hover:border-gray-600 opacity-60'
                                                }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={allowShort}
                                                    onChange={(e) => setAllowShort(e.target.checked)}
                                                    className="w-4 h-4 rounded text-rose-600 bg-gray-800 border-gray-600 focus:ring-rose-500 focus:ring-offset-gray-900 cursor-pointer accent-rose-500"
                                                />
                                                <TrendingDown size={14} className={allowShort ? 'text-rose-400 shrink-0' : 'text-gray-400 shrink-0'} />
                                                <span className={`text-xs font-semibold truncate ${allowShort ? 'text-rose-300' : 'text-gray-400'}`}>
                                                    Short
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Hàng 2 của Cột 2: 2 Take Profit Options in 2 Columns */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {/* Checkbox 1: Chốt khi Supertrend đảo chiều */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                            <TrendingUp size={13} className="text-emerald-400" />
                                            1. Chốt khi ST đảo chiều
                                        </label>
                                        <label className={`flex items-center gap-2.5 bg-gray-900 border rounded-xl px-3 py-2 cursor-pointer transition select-none h-[42px] ${tpSupertrend ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-gray-700 hover:border-gray-600'
                                            }`}>
                                            <input
                                                type="checkbox"
                                                checked={tpSupertrend}
                                                onChange={(e) => setTpSupertrend(e.target.checked)}
                                                className="w-4 h-4 rounded text-emerald-600 bg-gray-800 border-gray-600 focus:ring-emerald-500 focus:ring-offset-gray-900 cursor-pointer accent-emerald-500"
                                            />
                                            <span className={`text-xs font-semibold truncate ${tpSupertrend ? 'text-emerald-300' : 'text-gray-400'}`}>
                                                Supertrend Đảo Chiều
                                            </span>
                                        </label>
                                    </div>

                                    {/* Checkbox 2: Chốt theo tỷ lệ R:R & Input R:R */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                            <Target size={13} className="text-amber-400" />
                                            2. Chốt theo tỷ lệ R:R
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <label className={`flex items-center gap-2.5 bg-gray-900 border rounded-xl px-3 py-2 cursor-pointer transition select-none h-[42px] flex-1 min-w-0 ${tpRR ? 'border-amber-500/50 bg-amber-950/20' : 'border-gray-700 hover:border-gray-600'
                                                }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={tpRR}
                                                    onChange={(e) => setTpRR(e.target.checked)}
                                                    className="w-4 h-4 rounded text-amber-600 bg-gray-800 border-gray-600 focus:ring-amber-500 focus:ring-offset-gray-900 cursor-pointer accent-amber-500"
                                                />
                                                <span className={`text-xs font-semibold truncate ${tpRR ? 'text-amber-300' : 'text-gray-400'}`}>
                                                    Tỷ lệ R:R
                                                </span>
                                            </label>

                                            <div className="w-16 sm:w-20">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0.5"
                                                    max="5.0"
                                                    disabled={!tpRR}
                                                    value={riskReward}
                                                    onChange={(e) => setRiskReward(e.target.value)}
                                                    placeholder="1.5"
                                                    title="Tỷ lệ Risk:Reward cho Take Profit"
                                                    className={`w-full h-[42px] bg-gray-900 border rounded-xl px-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition ${tpRR ? 'border-amber-500/40 text-amber-300' : 'border-gray-800 text-gray-500 bg-gray-900/50 cursor-not-allowed'
                                                        }`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Status bar & Button Run Scan Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-700/50">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span className="font-medium text-gray-300">Cấu hình:</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-semibold font-mono">
                            <Clock size={12} className="text-amber-400" />
                            {timeframe}
                        </span>
                        {isVWAP ? (
                            <>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs font-medium">
                                    <Activity size={12} className="text-blue-400" />
                                    VWAP ({vwapAnchor.toUpperCase()}) + MA({vwapMaPeriod})
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                                    <Target size={12} className="text-emerald-400" />
                                    {vwapTpTarget === 'tp1_vwap' ? 'TP: VWAP' : (vwapTpTarget === 'tp2_upper2' ? 'TP: Upper 2' : 'TP: Upper 3')}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium">
                                    <ShieldAlert size={12} className="text-rose-400" />
                                    SL: Lower 2
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium">
                                    <Activity size={12} className="text-indigo-400" />
                                    Entry: {entryType === 'st_reversal' ? 'Supertrend đảo chiều' : 'Đóng cửa nến xanh/đỏ'}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-medium font-mono">
                                    <Sliders size={12} className="text-cyan-400" />
                                    ST({stPeriod},{stMultiplier}) + MA({maPeriod})
                                </span>
                                {tpSupertrend && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                                        <CheckCircle2 size={12} className="text-emerald-400" />
                                        ST Đảo chiều
                                    </span>
                                )}
                                {tpRR && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium">
                                        <CheckCircle2 size={12} className="text-amber-400" />
                                        Cố định R:R ({riskReward}R)
                                    </span>
                                )}
                            </>
                        )}
                        {allowLong && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                                <TrendingUp size={12} className="text-emerald-400" />
                                Long
                            </span>
                        )}
                        {allowShort && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium">
                                <TrendingDown size={12} className="text-rose-400" />
                                Short
                            </span>
                        )}
                        {!allowLong && !allowShort && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium">
                                <AlertTriangle size={12} className="text-rose-400" />
                                Chưa chọn loại lệnh
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5 self-stretch sm:self-auto shrink-0">
                        {/* Button Default - Reset về tham số mặc định */}
                        <button
                            onClick={handleResetDefault}
                            disabled={scanning || optimizing}
                            title="Reset các thông số indicator và cấu hình về mặc định"
                            className="h-[42px] bg-gray-800/90 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-600 active:scale-[0.98] text-gray-300 font-semibold rounded-xl px-3.5 sm:px-4 flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-1 sm:flex-none"
                        >
                            <RotateCcw size={15} className="text-gray-400" />
                            <span>Default</span>
                        </button>

                        {/* Button Save Config - Lưu cấu hình thành template */}
                        <button
                            onClick={handleOpenSaveModal}
                            disabled={scanning || optimizing || !selectedSymbol}
                            title="Lưu cấu hình hiện tại thành Strategy Template vào Strapi"
                            className="h-[42px] bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-500 active:scale-[0.98] font-semibold rounded-xl px-3.5 sm:px-4 flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-1 sm:flex-none"
                        >
                            <BookmarkPlus size={15} className="text-cyan-400" />
                            <span>Save Config</span>
                        </button>

                        {/* Button Optimize - Tìm tham số có Profit Factor cao nhất */}
                        <button
                            onClick={() => handleOptimize(selectedSymbol)}
                            disabled={scanning || optimizing || !selectedSymbol}
                            title="Tự động tìm bộ tham số mang lại Profit Factor cao nhất"
                            className="h-[42px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] text-white font-bold rounded-xl px-4 sm:px-5 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-1 sm:flex-none"
                        >
                            {optimizing ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>Optimizing...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} className="text-yellow-200 fill-yellow-200" />
                                    <span>Optimize</span>
                                </>
                            )}
                        </button>

                        {/* Button Run Scan */}
                        <button
                            onClick={() => handleScan(selectedSymbol)}
                            disabled={scanning || optimizing || !selectedSymbol}
                            className="h-[42px] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 active:scale-[0.98] text-white font-semibold rounded-xl px-5 sm:px-6 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-1 sm:flex-none"
                        >
                            {scanning ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>Scanning...</span>
                                </>
                            ) : (
                                <>
                                    <Play size={16} className="fill-current" />
                                    <span>Run Scan</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Optimal Params Success Banner */}
            {bestInfo && (
                <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/40 rounded-xl p-3.5 text-sm text-amber-200 flex items-center justify-between gap-3 shadow-md shadow-amber-500/5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
                            <Sparkles size={18} />
                        </div>
                        <div className="text-xs leading-relaxed">
                            <span className="font-bold text-amber-300">Đã tìm thấy & áp dụng bộ tham số tối ưu nhất:</span>
                            <span className="ml-1.5 inline-block text-gray-300">
                                Profit Factor: <strong className="text-emerald-400 text-sm font-bold">{bestInfo.profitFactor}</strong>
                                {' '}| Win Rate: <strong className="text-sky-300 font-bold">{bestInfo.winRate}%</strong> ({bestInfo.closedTrades} lệnh đóng)
                                {isVWAP ? (
                                    <>
                                        {' '}| <span className="font-mono text-cyan-300">VWAP + MA({bestInfo.maPeriod}) | Band 2 ({bestInfo.mult2}σ) | Band 3 ({bestInfo.mult3}σ)</span>
                                        {' '}| TP: <span className="text-emerald-300 font-semibold">{bestInfo.tpTarget === 'tp1_vwap' ? 'VWAP' : (bestInfo.tpTarget === 'tp2_upper2' ? 'Upper 2' : 'Upper 3')}</span>
                                    </>
                                ) : (
                                    <>
                                        {' '}| <span className="font-mono text-cyan-300">ST({bestInfo.stPeriod}, {bestInfo.stMultiplier}) + MA({bestInfo.maPeriod})</span>
                                        {' '}| Entry: <span className="text-indigo-300 font-semibold">{bestInfo.entryType === 'st_reversal' ? 'ST Đảo chiều' : 'Đóng nến'}</span>
                                        {' '}| R:R: <span className="text-amber-300 font-semibold">{bestInfo.riskReward}R</span>
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => setBestInfo(null)}
                        className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer shrink-0 text-xs"
                        title="Đóng thông báo"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-sm text-red-300 flex items-center gap-2.5">
                    <AlertTriangle size={18} className="text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Strategy Highlights & Performance Metrics */}
            {scanResult && summary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">Profit Factor</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-lg font-bold ${profitFactor === '∞' || parseFloat(profitFactor) >= 1.5
                                ? 'text-emerald-400'
                                : parseFloat(profitFactor) >= 1.0
                                    ? 'text-sky-400'
                                    : 'text-rose-400'
                                }`}>
                                {profitFactor}
                            </span>
                            <span className="text-xs text-gray-400">
                                (Lãi / Lỗ)
                            </span>
                        </div>
                    </div>

                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">Tổng số lệnh (Trades)</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold text-white">{summary.totalTrades}</span>
                            <span className="text-xs text-gray-400">
                                ({summary.closedTrades} đóng, {summary.activeTrade ? '1 mở' : '0 mở'})
                            </span>
                        </div>
                    </div>

                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">Tỷ lệ thắng (Win Rate)</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-lg font-bold ${summary.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {summary.winRate}%
                            </span>
                            <span className="text-xs text-gray-400">
                                ({summary.winTrades} TP / {summary.lossTrades} SL)
                            </span>
                        </div>
                    </div>

                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">Tổng Lợi nhuận (PnL)</span>
                        <span className={`text-lg font-bold ${summary.totalPnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {summary.totalPnlPercent > 0 ? `+${summary.totalPnlPercent}%` : `${summary.totalPnlPercent}%`}
                        </span>
                    </div>

                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 shadow-sm">
                        <span className="text-xs text-gray-400 block mb-1">ST({stPeriod},{stMultiplier}) & MA({maPeriod})</span>
                        <div className="text-xs space-y-0.5">
                            <div className="text-amber-400">ST: <b>{formatNumber(summary.supertrend || 0)}</b></div>
                            <div className="text-purple-400">MA: <b>{formatNumber(summary.ma288 || 0)}</b></div>
                        </div>
                    </div>

                    {/* Active Position Card */}
                    <div className={`border rounded-xl p-3 shadow-sm ${activeTrade
                        ? activeTrade.type === 'Long'
                            ? 'bg-emerald-950/30 border-emerald-500/30'
                            : 'bg-red-950/30 border-red-500/30'
                        : 'bg-gray-800/60 border-gray-700/50'
                        }`}>
                        <span className="text-xs text-gray-400 block mb-1">Trạng thái Vị thế</span>
                        {activeTrade ? (
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1 font-bold text-xs">
                                    {activeTrade.type === 'Long' ? (
                                        <TrendingUp size={14} className="text-emerald-400" />
                                    ) : (
                                        <TrendingDown size={14} className="text-red-400" />
                                    )}
                                    <span className={activeTrade.type === 'Long' ? 'text-emerald-400' : 'text-red-400'}>
                                        ĐANG GIỮ {activeTrade.type.toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-300">
                                    PnL: <b className={activeTrade.pnl_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                        {activeTrade.pnl_percent > 0 ? `+${activeTrade.pnl_percent}%` : `${activeTrade.pnl_percent}%`}
                                    </b>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-gray-500 italic block mt-1">Đang chờ Entry mới</span>
                        )}
                    </div>
                </div>
            )}

            {/* Active Position Action Bar */}
            {activeTrade && (
                <div className="bg-gradient-to-r from-gray-800/90 via-gray-800/70 to-gray-800/90 border border-gray-700 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Lệnh đang giữ:</span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${activeTrade.type === 'Long' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                }`}>
                                {activeTrade.type.toUpperCase()} (#{activeTrade.trade_no})
                            </span>
                            <span className="text-xs text-gray-400">
                                ({dayjs(activeTrade.entry_date).format('YYYY-MM-DD')})
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-gray-300">Entry: <b className="text-white">{formatNumber(activeTrade.entry_price)}</b></span>
                            <span className="text-red-300">SL: <b className="text-red-400">{formatNumber(activeTrade.stop_loss)}</b></span>
                            <span className="text-emerald-300">TP ({activeTrade.risk_reward}R): <b className="text-emerald-400">{formatNumber(activeTrade.take_profit)}</b></span>
                        </div>
                    </div>

                    <Link
                        to={`/trade-station?symbol=${encodeURIComponent(scanResult?.ticker || '')}&price=${activeTrade.entry_price}&slPrice=${activeTrade.stop_loss}&tpPrice=${activeTrade.take_profit}`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/20 cursor-pointer self-start md:self-auto"
                    >
                        <span>Mở trên Trade Station</span>
                        <ExternalLink size={14} />
                    </Link>
                </div>
            )}

            {/* Chart Area */}
            <div ref={chartCardRef} className="bg-gray-800 rounded-2xl border border-gray-700/80 p-4 shadow-xl flex flex-col space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-700/60 pb-3 gap-2">
                    <div className="flex items-center gap-2">
                        <Activity size={18} className="text-blue-400" />
                        <h2 className="text-base font-bold text-gray-100">
                            Biểu đồ Nến & Chu kỳ Lệnh ({scanResult?.ticker || selectedSymbol})
                        </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Mũi tên xanh Green ↑: Entry Long
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Mũi tên đỏ Red ↓: Entry Short
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Mũi tên xanh Blue: Take Profit
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Chấm tròn đỏ ●: Stop Loss
                        </span>
                    </div>
                </div>

                <div className="h-[480px] w-full relative rounded-xl overflow-hidden bg-gray-900">
                    {scanning ? (
                        <div className="h-full w-full flex flex-col items-center justify-center space-y-3">
                            <RefreshCw size={36} className="text-purple-400 animate-spin" />
                            <p className="text-sm text-gray-400">Đang chạy chiến lược Python & mô phỏng lệnh 1 lúc...</p>
                        </div>
                    ) : chartCandles.length > 0 ? (
                        <TradingViewChart
                            data={chartCandles}
                            symbol={scanResult?.ticker || selectedSymbol}
                            signals={chartSignals}
                            template={isVWAP ? "VWAP" : "Supertrend"}
                            vwapAnchor={vwapAnchor}
                            timeframe={timeframe}
                            supertrendPeriod={parseInt(stPeriod) || 10}
                            supertrendMultiplier={parseFloat(stMultiplier) || 3.0}
                            maPeriod={parseInt(isVWAP ? vwapMaPeriod : maPeriod) || (isVWAP ? 9 : 288)}
                            focusDate={focusDate}
                            onLoadMore={handleLoadMore}
                            isLoadingMore={loadingMore}
                            hasMore={hasMore}
                        />
                    ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                            <BrainCircuit size={40} className="opacity-40" />
                            <p className="text-sm">Vui lòng chọn Symbol và bấm <b>Run Scan</b> để nạp biểu đồ</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Trades History Table */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700/80 overflow-hidden shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-700/80 gap-3">
                    <div className="flex items-center gap-2">
                        <Clock size={18} className="text-purple-400" />
                        <h3 className="text-base font-bold text-gray-100">
                            Lịch sử Lệnh Giao Dịch (1 Lệnh 1 Lúc) ({tradesList.length})
                        </h3>
                    </div>

                    <div className="flex items-center bg-gray-900 p-1 rounded-xl border border-gray-700 text-xs">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${activeTab === 'all' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            Tất cả ({scanResult?.trades?.length || 0})
                        </button>
                        <button
                            onClick={() => setActiveTab('Open')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${activeTab === 'Open' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            Đang mở ({scanResult?.trades?.filter(t => t.status === 'Open').length || 0})
                        </button>
                        <button
                            onClick={() => setActiveTab('Closed')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${activeTab === 'Closed' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            Đã đóng ({scanResult?.trades?.filter(t => t.status === 'Closed').length || 0})
                        </button>
                        <button
                            onClick={() => setActiveTab('Long')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${activeTab === 'Long' ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            Long ({scanResult?.trades?.filter(t => t.type === 'Long').length || 0})
                        </button>
                        <button
                            onClick={() => setActiveTab('Short')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${activeTab === 'Short' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            Short ({scanResult?.trades?.filter(t => t.type === 'Short').length || 0})
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto max-h-96 custom-scrollbar">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-gray-900/70 text-gray-400 text-xs uppercase tracking-wider sticky top-0 backdrop-blur z-10">
                            <tr>
                                <th className="py-3 px-3">#</th>
                                <th className="py-3 px-3">Vị thế</th>
                                <th className="py-3 px-3">Ngày Vào (Entry)</th>
                                <th className="py-3 px-3">Giá Vào</th>
                                <th className="py-3 px-3">Cắt lỗ (SL)</th>
                                <th className="py-3 px-3">Chốt lời (TP)</th>
                                <th className="py-3 px-3">Ngày Đóng (Exit)</th>
                                <th className="py-3 px-3">Giá Đóng</th>
                                <th className="py-3 px-3">Kết Quả</th>
                                <th className="py-3 px-3">PnL (%)</th>
                                <th className="py-3 px-3">Thời Gian</th>
                                <th className="py-3 px-3 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50 text-gray-300">
                            {tradesList.length === 0 ? (
                                <tr>
                                    <td colSpan="12" className="py-8 text-center text-gray-500 italic">
                                        Không có lệnh giao dịch nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                tradesList.map((trade, idx) => {
                                    const tradeDate = trade.entry_time || (trade.entry_date ? String(trade.entry_date).split('T')[0] : '');
                                    const isFocused = focusDate === tradeDate;

                                    return (
                                        <tr key={idx} className={`transition ${isFocused ? 'bg-purple-900/20' : 'hover:bg-gray-700/30'}`}>
                                            <td className="py-3 px-3 font-mono text-xs text-gray-500">
                                                #{trade.trade_no}
                                            </td>
                                            <td className="py-3 px-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewTrade(trade)}
                                                    title={`Xem nến Entry ${trade.entry_time || (trade.entry_date ? dayjs(trade.entry_date).format('YYYY-MM-DD') : '')} trên biểu đồ`}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm hover:scale-105 active:scale-95 ${trade.type === 'Long'
                                                        ? isFocused
                                                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-emerald-600/30'
                                                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                                                        : isFocused
                                                            ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-red-600/30'
                                                            : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
                                                        }`}
                                                >
                                                    {trade.type === 'Long' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                                    <span>{trade.type.toUpperCase()}</span>
                                                    <Eye size={11} className="opacity-70 ml-0.5" />
                                                </button>
                                            </td>
                                            <td className="py-3 px-3 font-mono text-xs text-gray-300">
                                                {dayjs(trade.entry_date).format('YYYY-MM-DD')}
                                            </td>
                                            <td className="py-3 px-3 font-semibold text-white">
                                                {formatNumber(trade.entry_price)}
                                            </td>
                                            <td className="py-3 px-3 text-red-400 font-medium text-xs">
                                                {formatNumber(trade.stop_loss)}
                                            </td>
                                            <td className="py-3 px-3 text-emerald-400 font-medium text-xs">
                                                {trade.take_profit ? formatNumber(trade.take_profit) : <span className="text-gray-400 italic text-[11px]">Theo ST</span>}
                                            </td>
                                            <td className="py-3 px-3 font-mono text-xs text-gray-400">
                                                {trade.exit_date ? dayjs(trade.exit_date).format('YYYY-MM-DD') : '-'}
                                            </td>
                                            <td className="py-3 px-3 font-semibold text-gray-200">
                                                {trade.exit_price ? formatNumber(trade.exit_price) : '-'}
                                            </td>
                                            <td className="py-3 px-3 text-xs">
                                                {trade.status === 'Open' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                                                        <Clock size={12} /> Đang mở
                                                    </span>
                                                ) : trade.exit_reason === 'StopLoss' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold">
                                                        <XCircle size={12} /> Stop Loss
                                                    </span>
                                                ) : (trade.exit_reason && trade.exit_reason.includes('TakeProfit')) || trade.pnl_percent > 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                                                        <CheckCircle2 size={12} /> {trade.exit_reason || 'Take Profit'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                                                        <AlertTriangle size={12} /> {trade.exit_reason || 'Đóng vị thế'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 font-bold">
                                                <span className={trade.pnl_percent > 0 ? 'text-emerald-400' : trade.pnl_percent < 0 ? 'text-rose-400' : 'text-gray-400'}>
                                                    {trade.pnl_percent > 0 ? `+${trade.pnl_percent}%` : `${trade.pnl_percent}%`}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-xs text-gray-400">
                                                {trade.holding_bars || 0} nến
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <Link
                                                    to={`/trade-station?symbol=${encodeURIComponent(scanResult?.ticker || '')}&price=${trade.entry_price}&slPrice=${trade.stop_loss}&tpPrice=${trade.take_profit || ''}`}
                                                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition"
                                                >
                                                    <span>Đặt lệnh</span>
                                                    <ExternalLink size={12} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Deflated Sharpe Ratio (DSR) Card */}
            {scanResult?.trades && scanResult.trades.length > 0 && (
                <DeflatedSharpeRatioCard
                    trades={scanResult.trades}
                    timeframe={timeframe}
                    defaultTrials={bestInfo ? 1440 : 1}
                />
            )}

            {/* Modal Save Strategy Template */}
            {saveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                            <div className="flex items-center gap-2">
                                <BookmarkPlus size={20} className="text-cyan-400" />
                                <h3 className="text-base font-bold text-gray-100">Lưu Strategy Template</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSaveModalOpen(false)}
                                className="text-gray-400 hover:text-gray-200 p-1 rounded-lg transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTemplate} className="space-y-4">
                            {/* Dropdown: Chọn Template để ghi đè hoặc tạo mới */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                                    <span>Chọn Template ghi đè hoặc tạo mới:</span>
                                    {overwriteTemplateId && overwriteTemplateId !== '__NEW__' ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                                            Chế độ: Ghi đè
                                        </span>
                                    ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                                            Chế độ: Tạo mới
                                        </span>
                                    )}
                                </label>
                                <select
                                    value={overwriteTemplateId || '__NEW__'}
                                    onChange={(e) => handleModalSelectTemplate(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition cursor-pointer font-medium"
                                >
                                    <option value="__NEW__">✨ [+ Tạo Template Mới Cho {selectedSymbol}]</option>
                                    {symbolTemplates.map(tpl => {
                                        const tplId = String(tpl.id || tpl.documentId);
                                        return (
                                            <option key={tplId} value={tplId}>
                                                🔄 Ghi đè: {tpl.name} ({tpl.timeframe || 'D1'})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Tên Template Input */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                                    <span>Tên Template *</span>
                                    <span className="text-[11px] text-gray-500 font-normal">Có thể chỉnh sửa</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nhập tên template..."
                                    value={templateNameInput}
                                    onChange={(e) => setTemplateNameInput(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-300">Mô tả (tùy chọn)</label>
                                <textarea
                                    rows={2}
                                    placeholder="Ghi chú về thiết lập tham số hoặc thị trường áp dụng..."
                                    value={templateDescInput}
                                    onChange={(e) => setTemplateDescInput(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>

                            <div className="bg-gray-900/80 rounded-xl p-3 border border-gray-700/50 space-y-1 text-xs text-gray-400">
                                <div className="flex justify-between">
                                    <span>Symbol:</span>
                                    <span className="text-emerald-400 font-bold font-mono">{selectedSymbol}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Chiến lược:</span>
                                    <span className="text-gray-200 font-semibold">{selectedStrategyFile}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Timeframe:</span>
                                    <span className="text-amber-400 font-semibold">{timeframe}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Cấu hình:</span>
                                    <span className="text-gray-300 font-mono text-[11px] truncate max-w-[210px]">
                                        {isVWAP
                                            ? `MA${vwapMaPeriod} | ${vwapAnchor.toUpperCase()} | ${vwapTpTarget}`
                                            : `ST(${stPeriod}, ${stMultiplier}) | MA${maPeriod} | RR ${riskReward}`}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSaveModalOpen(false)}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm font-semibold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingTemplate || !templateNameInput.trim()}
                                    className={`px-5 py-2 text-white rounded-xl text-sm font-bold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer ${
                                        overwriteTemplateId && overwriteTemplateId !== '__NEW__'
                                            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/25'
                                            : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/25'
                                    }`}
                                >
                                    {savingTemplate ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            <span>Đang lưu...</span>
                                        </>
                                    ) : overwriteTemplateId && overwriteTemplateId !== '__NEW__' ? (
                                        <>
                                            <RefreshCw size={14} />
                                            <span>Ghi đè Template</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={14} />
                                            <span>Lưu Template Mới</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PythonStrategy;
