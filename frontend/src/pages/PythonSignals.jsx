import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols } from '../features/symbolSlice';
import { useAccount } from '../context/AccountContext';
import { getStrategyTemplates, deleteStrategyTemplate } from '../services/strategyTemplate';
import { scanPythonStrategy, buildPythonScanParams } from '../services/pythonStrategy';
import StrategyTemplatesListModal from '../components/python-strategy/StrategyTemplatesListModal';
import {
    Activity,
    BrainCircuit,
    RefreshCw,
    Search,
    TrendingUp,
    TrendingDown,
    Clock,
    DollarSign,
    Target,
    ShieldAlert,
    ExternalLink,
    Filter,
    LayoutGrid,
    ListFilter,
    CheckCircle2,
    AlertTriangle,
    Layers,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles,
    BookmarkCheck
} from 'lucide-react';

const PythonSignals = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { items: symbols, loading: symbolsLoading } = useSelector(state => state.symbols);
    const { selectedAccount, accountSymbols = [], loading: accountLoading } = useAccount();

    const [templates, setTemplates] = useState([]);
    const [scanResults, setScanResults] = useState({});
    const [isScanningAll, setIsScanningAll] = useState(false);
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, currentSymbol: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'open', 'profit', 'loss', 'waiting'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [scanningSingleMap, setScanningSingleMap] = useState({});

    const [selectedTemplateModalSymbol, setSelectedTemplateModalSymbol] = useState('');
    const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
    const [selectedTemplateIdForModal, setSelectedTemplateIdForModal] = useState(null);

    const handleOpenTemplateModal = (symName, templateId) => {
        setSelectedTemplateModalSymbol(symName);
        setSelectedTemplateIdForModal(templateId || null);
        setIsTemplatesModalOpen(true);
    };

    const handleApplyTemplateFromModal = (template) => {
        const sym = template?.symbolName || template?.symbol?.Name || template?.symbol?.name || selectedTemplateModalSymbol;
        setIsTemplatesModalOpen(false);
        navigate(`/python-strategy?symbol=${sym}&templateId=${template.documentId || template.id}`);
    };

    const handleDeleteTemplate = async (templateId) => {
        try {
            await deleteStrategyTemplate(templateId);
            setTemplates(prev => prev.filter(t => (t.documentId || t.id) !== templateId));
        } catch (err) {
            alert(`Không thể xóa template: ${err.message || err}`);
        }
    };

    const currentAccountId = selectedAccount?.documentId || selectedAccount?.id || null;
    const prevAccountIdRef = useRef(null);
    const autoScannedAccountIdRef = useRef(null);

    // 1. Fetch symbols for selected market when selectedAccount changes
    useEffect(() => {
        if (selectedAccount?.market) {
            const marketId = selectedAccount.market.documentId || selectedAccount.market.id;
            dispatch(fetchSymbols(marketId));
        }
    }, [dispatch, selectedAccount?.market]);

    // 2. Fetch all strategy templates
    useEffect(() => {
        getStrategyTemplates()
            .then(data => setTemplates(data || []))
            .catch(err => console.error('Failed to load strategy templates:', err));
    }, []);

    // 3. Reset scan results when account changes
    useEffect(() => {
        if (prevAccountIdRef.current && prevAccountIdRef.current !== currentAccountId) {
            setScanResults({});
            setScanningSingleMap({});
            autoScannedAccountIdRef.current = null;
        }
        prevAccountIdRef.current = currentAccountId;
    }, [currentAccountId]);

    // 4. Map only symbols belonging to current selected account that have assigned Strategy Template
    const configuredSymbols = useMemo(() => {
        if (!selectedAccount || !accountSymbols || accountSymbols.length === 0) return [];

        return accountSymbols.map(sym => {
            const symName = String(sym.Name || sym.name || '').trim().toUpperCase();
            const assigned = sym.strategy_template;
            const assignedId = assigned?.documentId || assigned?.id || (typeof assigned === 'string' || typeof assigned === 'number' ? String(assigned) : null);

            let template = null;
            if (assignedId && templates.length > 0) {
                template = templates.find(t =>
                    String(t.documentId || t.id) === String(assignedId) ||
                    String(t.id) === String(assignedId)
                ) || (typeof assigned === 'object' && assigned.name ? assigned : null);
            }

            // Fallback: match template by symbol name
            if (!template && templates.length > 0) {
                template = templates.find(t => {
                    const tSym = String(t.symbolName || t.symbol?.Name || t.symbol?.name || '').trim().toUpperCase();
                    return tSym === symName;
                }) || null;
            }

            return {
                ...sym,
                template
            };
        }).filter(item => Boolean(item.template));
    }, [accountSymbols, templates, selectedAccount]);

    // 5. Scan a single symbol
    const scanSingleSymbol = useCallback(async (symObj) => {
        const symName = String(symObj.Name || symObj.name || '').trim().toUpperCase();
        const tpl = symObj.template;
        if (!tpl) return null;

        const symKey = symObj.documentId || symObj.id || symName;
        setScanningSingleMap(prev => ({ ...prev, [symKey]: true }));

        try {
            const scanParams = buildPythonScanParams(tpl, symName, tpl.timeframe || 'D1');
            const res = await scanPythonStrategy(scanParams);

            if (res && !res.error) {
                setScanResults(prev => ({
                    ...prev,
                    [symKey]: {
                        symbol: symObj,
                        template: tpl,
                        data: res,
                        lastScanned: new Date().toISOString(),
                        error: null
                    }
                }));
                return res;
            } else {
                setScanResults(prev => ({
                    ...prev,
                    [symKey]: {
                        symbol: symObj,
                        template: tpl,
                        data: null,
                        lastScanned: new Date().toISOString(),
                        error: res?.error || 'No result returned'
                    }
                }));
                return null;
            }
        } catch (err) {
            console.error(`Error scanning ${symName}:`, err);
            setScanResults(prev => ({
                ...prev,
                [symKey]: {
                    symbol: symObj,
                    template: tpl,
                    data: null,
                    lastScanned: new Date().toISOString(),
                    error: err.message || String(err)
                }
            }));
            return null;
        } finally {
            setScanningSingleMap(prev => ({ ...prev, [symKey]: false }));
        }
    }, []);

    // 6. Scan all configured symbols
    const handleScanAll = useCallback(async () => {
        if (configuredSymbols.length === 0 || isScanningAll) return;

        setIsScanningAll(true);
        setScanProgress({ current: 0, total: configuredSymbols.length, currentSymbol: '' });

        for (let i = 0; i < configuredSymbols.length; i++) {
            const symObj = configuredSymbols[i];
            const symName = String(symObj.Name || symObj.name || '').trim().toUpperCase();
            setScanProgress({ current: i + 1, total: configuredSymbols.length, currentSymbol: symName });

            await scanSingleSymbol(symObj);
        }

        setIsScanningAll(false);
        setScanProgress({ current: 0, total: 0, currentSymbol: '' });
    }, [configuredSymbols, isScanningAll, scanSingleSymbol]);

    // 7. Auto-scan on initial load or account switch once symbols of the selected account are ready
    useEffect(() => {
        if (
            !accountLoading &&
            !symbolsLoading &&
            selectedAccount &&
            configuredSymbols.length > 0 &&
            templates.length > 0 &&
            !isScanningAll &&
            autoScannedAccountIdRef.current !== currentAccountId
        ) {
            autoScannedAccountIdRef.current = currentAccountId;
            handleScanAll();
        }
    }, [accountLoading, symbolsLoading, selectedAccount, configuredSymbols, templates.length, isScanningAll, currentAccountId, handleScanAll]);

    // 6. Process items list for UI display
    const processedItems = useMemo(() => {
        return configuredSymbols.map(sym => {
            const symKey = sym.documentId || sym.id || String(sym.Name).toUpperCase();
            const scan = scanResults[symKey];
            const resData = scan?.data;
            const summary = resData?.summary || {};
            const trades = resData?.trades || [];
            const activeTrade = summary.activeTrade || trades.find(t => t.status === 'Open') || null;
            const lastTrade = summary.latestTrade || trades[trades.length - 1] || null;
            const currentPrice = summary.currentPrice || (resData?.candles?.length > 0 ? resData.candles[resData.candles.length - 1].close : null);

            let status = 'waiting'; // 'open_long', 'open_short', 'waiting'
            if (activeTrade) {
                status = String(activeTrade.type).toLowerCase() === 'long' ? 'open_long' : 'open_short';
            }

            // Calculate progress between SL and TP for open trade
            let targetProgress = 50;
            if (activeTrade && currentPrice) {
                const entry = activeTrade.entry_price || activeTrade.entry;
                const sl = activeTrade.stop_loss;
                const tp = activeTrade.take_profit;
                if (sl && tp && sl !== tp) {
                    const totalRange = Math.abs(tp - sl);
                    const currentDist = status === 'open_long' ? (currentPrice - sl) : (sl - currentPrice);
                    targetProgress = Math.max(0, Math.min(100, Math.round((currentDist / totalRange) * 100)));
                }
            }

            return {
                symbol: sym,
                template: sym.template,
                scan,
                activeTrade,
                lastTrade,
                currentPrice,
                status,
                targetProgress,
                summary,
                tradesCount: summary.totalTrades || trades.length || 0,
                winRate: summary.winRate !== undefined ? summary.winRate : 0,
                totalPnlPercent: summary.totalPnlPercent !== undefined ? summary.totalPnlPercent : 0,
                profitFactor: summary.profitFactor !== undefined ? summary.profitFactor : 0,
                unrealizedPnl: activeTrade?.pnl_percent || 0,
                unrealizedAmount: activeTrade?.pnl_amount || 0,
                isScanning: Boolean(scanningSingleMap[symKey])
            };
        });
    }, [configuredSymbols, scanResults, scanningSingleMap]);

    // 7. Filtered items based on search and status
    const filteredItems = useMemo(() => {
        let list = processedItems;

        // Status filter
        if (filterStatus === 'open') {
            list = list.filter(item => item.activeTrade !== null);
        } else if (filterStatus === 'profit') {
            list = list.filter(item => item.activeTrade && item.unrealizedPnl > 0);
        } else if (filterStatus === 'loss') {
            list = list.filter(item => item.activeTrade && item.unrealizedPnl < 0);
        } else if (filterStatus === 'waiting') {
            list = list.filter(item => item.activeTrade === null);
        }

        // Search filter
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            list = list.filter(item =>
                (item.symbol.Name && item.symbol.Name.toLowerCase().includes(q)) ||
                (item.symbol.exchange && item.symbol.exchange.toLowerCase().includes(q)) ||
                (item.symbol.sector && item.symbol.sector.toLowerCase().includes(q)) ||
                (item.template?.name && item.template.name.toLowerCase().includes(q))
            );
        }

        // Sort: Open trades first, then highest unrealized PnL
        return list.sort((a, b) => {
            if (a.activeTrade && !b.activeTrade) return -1;
            if (!a.activeTrade && b.activeTrade) return 1;
            if (a.activeTrade && b.activeTrade) {
                return (b.unrealizedPnl || 0) - (a.unrealizedPnl || 0);
            }
            return (b.winRate || 0) - (a.winRate || 0);
        });
    }, [processedItems, filterStatus, searchTerm]);

    // 8. Aggregate Summary Statistics
    const metrics = useMemo(() => {
        const openTrades = processedItems.filter(item => item.activeTrade !== null);
        const totalUnrealizedPnl = openTrades.reduce((acc, curr) => acc + (curr.unrealizedPnl || 0), 0);
        const avgWinRate = processedItems.length > 0
            ? Math.round(processedItems.reduce((acc, curr) => acc + (curr.winRate || 0), 0) / processedItems.length * 10) / 10
            : 0;
        const profitableTrades = openTrades.filter(item => (item.unrealizedPnl || 0) > 0);

        return {
            totalConfigured: configuredSymbols.length,
            openTradesCount: openTrades.length,
            totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
            profitableCount: profitableTrades.length,
            lossCount: openTrades.length - profitableTrades.length,
            avgWinRate
        };
    }, [configuredSymbols.length, processedItems]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Header & Main Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-700 shadow-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20 shadow-inner">
                            <Activity size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
                                Python Strategy Signals
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-600/40 font-mono font-normal">
                                    LIVE SCANNER
                                </span>
                            </h1>
                            <p className="text-gray-400 text-sm mt-1">
                                Quét lệnh giao dịch đang mở và giám sát tín hiệu cho tài khoản{' '}
                                <span className="text-purple-300 font-semibold">{selectedAccount?.name || 'Tài khoản'}</span>
                                {selectedAccount?.market?.Name && (
                                    <span className="ml-2 text-xs px-2.5 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50 font-medium">
                                        {selectedAccount.market.Name}
                                    </span>
                                )}.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        to="/manage-symbols"
                        className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 text-sm font-medium transition flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                        <BrainCircuit size={16} className="text-purple-400" />
                        Gán Strategy Template
                    </Link>

                    <button
                        onClick={handleScanAll}
                        disabled={isScanningAll || configuredSymbols.length === 0}
                        className="flex items-center gap-2.5 px-6 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={18} className={isScanningAll ? 'animate-spin' : ''} />
                        {isScanningAll
                            ? `Đang quét (${scanProgress.current}/${scanProgress.total})...`
                            : 'Quét Tất Cả Tín Hiệu'}
                    </button>
                </div>
            </div>

            {/* Scanning Progress Banner */}
            {isScanningAll && (
                <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-purple-200 text-sm">
                    <div className="flex items-center gap-3">
                        <RefreshCw size={18} className="animate-spin text-purple-400 shrink-0" />
                        <div>
                            <span>Đang phân tích chiến lược cho mã: </span>
                            <span className="font-bold text-white uppercase">{scanProgress.currentSymbol || '...'}</span>
                            <span className="text-purple-300 text-xs ml-2">({scanProgress.current} / {scanProgress.total} symbols)</span>
                        </div>
                    </div>
                    <div className="w-full sm:w-48 bg-gray-800 rounded-full h-2 overflow-hidden border border-purple-700/50">
                        <div
                            className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full transition-all duration-300"
                            style={{ width: `${(scanProgress.current / (scanProgress.total || 1)) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* KPI Metric Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: Vị thế đang mở */}
                <div className="bg-gray-800/90 border border-gray-700/80 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lệnh Đang Mở</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl sm:text-3xl font-extrabold text-white">
                                {metrics.openTradesCount}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                                / {metrics.totalConfigured} mã
                            </span>
                        </div>
                    </div>
                    <div className={`p-3 rounded-xl border ${metrics.openTradesCount > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-700/40 text-gray-400 border-gray-600/40'}`}>
                        <Sparkles size={22} />
                    </div>
                </div>

                {/* Metric 2: Tổng PnL Unrealized */}
                <div className="bg-gray-800/90 border border-gray-700/80 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tổng PnL Lệnh Mở</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className={`text-2xl sm:text-3xl font-extrabold ${metrics.totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {metrics.totalUnrealizedPnl >= 0 ? `+${metrics.totalUnrealizedPnl}%` : `${metrics.totalUnrealizedPnl}%`}
                            </span>
                        </div>
                    </div>
                    <div className={`p-3 rounded-xl border ${metrics.totalUnrealizedPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {metrics.totalUnrealizedPnl >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                    </div>
                </div>

                {/* Metric 3: Lệnh Lãi / Lỗ */}
                <div className="bg-gray-800/90 border border-gray-700/80 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Trạng Thái Vị Thế</p>
                        <div className="flex items-center gap-3 mt-1.5 text-sm font-bold">
                            <span className="text-emerald-400 flex items-center gap-1">
                                <ArrowUpRight size={16} /> {metrics.profitableCount} Lãi
                            </span>
                            <span className="text-red-400 flex items-center gap-1">
                                <ArrowDownRight size={16} /> {metrics.lossCount} Lỗ
                            </span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Target size={22} />
                    </div>
                </div>

                {/* Metric 4: Tỷ lệ thắng TB */}
                <div className="bg-gray-800/90 border border-gray-700/80 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Win Rate Trung Bình</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl sm:text-3xl font-extrabold text-white">
                                {metrics.avgWinRate}%
                            </span>
                            <span className="text-xs text-gray-400">Backtest</span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <BrainCircuit size={22} />
                    </div>
                </div>
            </div>

            {/* Filter & Controls Toolbar */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Status Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-900/80 rounded-xl border border-gray-700/60">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${filterStatus === 'all' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        Tất cả ({processedItems.length})
                    </button>
                    <button
                        onClick={() => setFilterStatus('open')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${filterStatus === 'open' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        🔥 Đang Mở ({metrics.openTradesCount})
                    </button>
                    <button
                        onClick={() => setFilterStatus('profit')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${filterStatus === 'profit' ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        🟢 Đang Lãi ({metrics.profitableCount})
                    </button>
                    <button
                        onClick={() => setFilterStatus('loss')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${filterStatus === 'loss' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        🔴 Đang Lỗ ({metrics.lossCount})
                    </button>
                    <button
                        onClick={() => setFilterStatus('waiting')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${filterStatus === 'waiting' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        ⏳ Chờ Lệnh ({processedItems.length - metrics.openTradesCount})
                    </button>
                </div>

                {/* Search & View Switcher */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm symbol, template..."
                            className="w-full bg-gray-900/70 border border-gray-600 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                        />
                    </div>

                    <div className="flex items-center p-1 bg-gray-900/80 rounded-lg border border-gray-700 shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition cursor-pointer ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Chế độ Thẻ (Grid)"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-md transition cursor-pointer ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Chế độ Bảng (Table)"
                        >
                            <ListFilter size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            {accountLoading || (symbolsLoading && symbols.length === 0) ? (
                <div className="bg-gray-800 rounded-2xl border border-gray-700 p-12 text-center space-y-4">
                    <RefreshCw size={36} className="animate-spin text-purple-400 mx-auto" />
                    <h3 className="text-lg font-bold text-white">Đang tải danh sách symbol của tài khoản...</h3>
                    <p className="text-gray-400 text-sm">Vui lòng đợi hệ thống đồng bộ các cấu hình chiến lược.</p>
                </div>
            ) : configuredSymbols.length === 0 ? (
                <div className="bg-gray-800 rounded-2xl border border-gray-700 p-12 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
                        <BrainCircuit size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Chưa có Symbol nào trong tài khoản được gán Strategy Template</h3>
                    <p className="text-gray-400 max-w-md mx-auto text-sm">
                        Tài khoản <strong>{selectedAccount?.name || 'hiện tại'}</strong> {selectedAccount?.market?.Name ? `(Thị trường ${selectedAccount.market.Name})` : ''} chưa có mã symbol nào được cấu hình Strategy Template.
                    </p>
                    <Link
                        to="/manage-symbols"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 transition cursor-pointer"
                    >
                        Đến Quản Lý Symbols
                    </Link>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="bg-gray-800 rounded-2xl border border-gray-700 p-12 text-center text-gray-400 space-y-2">
                    <AlertTriangle size={36} className="text-amber-400 mx-auto" />
                    <h4 className="text-lg font-bold text-white">Không có kết quả phù hợp</h4>
                    <p className="text-sm">Không tìm thấy symbol nào khớp với bộ lọc hoặc từ khóa tìm kiếm.</p>
                </div>
            ) : viewMode === 'grid' ? (
                /* CLEAN GRID CARD VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredItems.map(item => {
                        const symName = String(item.symbol.Name || item.symbol.name || '').toUpperCase();
                        const isOpen = Boolean(item.activeTrade);
                        const isLong = item.status === 'open_long';
                        const isProfit = (item.unrealizedPnl || 0) >= 0;
                        const entryDate = item.activeTrade?.entry_date || item.activeTrade?.entry_time || item.lastTrade?.entry_date || '-';

                        return (
                            <div
                                key={item.symbol.id || symName}
                                className={`rounded-xl border transition-all duration-200 flex flex-col justify-between overflow-hidden bg-gray-800/80 hover:bg-gray-800 backdrop-blur-sm shadow-md hover:shadow-xl ${isOpen
                                    ? (isProfit
                                        ? 'border-emerald-500/40 hover:border-emerald-500/70'
                                        : 'border-rose-500/40 hover:border-rose-500/70')
                                    : 'border-gray-700/70 hover:border-gray-600'
                                    }`}
                            >
                                {/* Top Card Header */}
                                <div className="p-4 border-b border-gray-700/50 flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-white tracking-tight">{symName}</span>
                                            {item.symbol.exchange && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-700/80 text-gray-300">
                                                    {item.symbol.exchange}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                                            <BrainCircuit size={13} className="text-purple-400 shrink-0" />
                                            <span className="truncate max-w-[170px]" title={item.template?.name}>
                                                {item.template?.name || 'Strategy'}
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-mono">[{item.template?.timeframe || 'D1'}]</span>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="shrink-0">
                                        {isOpen ? (
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isLong
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLong ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                {isLong ? 'OPEN LONG' : 'OPEN SHORT'}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700/40 text-gray-400 border border-gray-700/60">
                                                <Clock size={11} />
                                                Chờ lệnh
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Main Card Body */}
                                <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                                    {isOpen ? (
                                        <>
                                            {/* Primary PnL & Current Price Section */}
                                            <div className="flex items-baseline justify-between pt-0.5">
                                                <div>
                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">PnL Tạm Tính</p>
                                                    <div className="flex items-baseline gap-1 mt-0.5">
                                                        <span className={`text-2xl font-black ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {isProfit ? `+${item.unrealizedPnl}%` : `${item.unrealizedPnl}%`}
                                                        </span>
                                                        {item.unrealizedAmount !== undefined && (
                                                            <span className="text-xs text-gray-400">
                                                                ({item.unrealizedAmount > 0 ? `+${item.unrealizedAmount}` : item.unrealizedAmount})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Giá Hiện Tại</p>
                                                    <p className="text-base font-bold text-white mt-0.5 font-mono">
                                                        ${Number(item.currentPrice || 0).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Entry, SL, TP Clean Level Display */}
                                            <div className="bg-gray-900/40 rounded-lg p-2.5 border border-gray-700/40 space-y-2">
                                                <div className="grid grid-cols-3 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 block font-medium">Giá Vào</span>
                                                        <span className="font-semibold text-gray-200 font-mono">
                                                            ${Number(item.activeTrade.entry_price || item.activeTrade.entry || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-rose-400 block font-medium">Cắt Lỗ (SL)</span>
                                                        <span className="font-semibold text-rose-300 font-mono">
                                                            ${Number(item.activeTrade.stop_loss || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-emerald-400 block font-medium">Chốt Lời (TP)</span>
                                                        <span className="font-semibold text-emerald-300 font-mono">
                                                            ${Number(item.activeTrade.take_profit || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Mini Progress Track */}
                                                <div className="space-y-1 pt-1 border-t border-gray-800/80">
                                                    <div className="flex justify-between text-[10px] text-gray-400">
                                                        <span>Vị trí giá hiện tại</span>
                                                        <span className="font-semibold">{item.targetProgress}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-300 ${isProfit ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                                            style={{ width: `${item.targetProgress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Timestamp & Holding duration */}
                                            <div className="flex items-center justify-between text-[11px] text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={11} className="text-gray-500" />
                                                    Vào lệnh: <span className="text-gray-300 font-mono">{entryDate.slice(0, 10)}</span>
                                                </span>
                                                <span className="text-gray-300 font-mono">
                                                    Nắm giữ: {item.activeTrade.holding_bars !== undefined ? `${item.activeTrade.holding_bars} nến` : '1 nến'}
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        /* Clean Waiting State */
                                        <div className="space-y-3">
                                            <div className="flex items-baseline justify-between pt-0.5">
                                                <div>
                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Trạng Thái</p>
                                                    <p className="text-sm font-semibold text-gray-300 mt-0.5">Chờ tín hiệu vào lệnh</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Giá Hiện Tại</p>
                                                    <p className="text-base font-bold text-white mt-0.5 font-mono">
                                                        ${Number(item.currentPrice || 0).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Last Trade Pill */}
                                            {item.lastTrade && (
                                                <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-900/40 rounded-lg border border-gray-700/40 text-xs">
                                                    <span className="text-gray-400 text-[11px]">Lệnh trước:</span>
                                                    <span className={`font-semibold ${item.lastTrade.pnl_percent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {item.lastTrade.type} ({item.lastTrade.pnl_percent >= 0 ? `+${item.lastTrade.pnl_percent}%` : `${item.lastTrade.pnl_percent}%`})
                                                    </span>
                                                </div>
                                            )}

                                            {/* 3 Stats Chips */}
                                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                                <div className="p-2 rounded-lg bg-gray-900/40 border border-gray-700/30">
                                                    <p className="text-[10px] text-gray-400 font-medium">Win Rate</p>
                                                    <p className="font-bold text-white mt-0.5 font-mono">{item.winRate}%</p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-gray-900/40 border border-gray-700/30">
                                                    <p className="text-[10px] text-gray-400 font-medium">Tổng PnL</p>
                                                    <p className={`font-bold mt-0.5 font-mono ${item.totalPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {item.totalPnlPercent >= 0 ? `+${item.totalPnlPercent}%` : `${item.totalPnlPercent}%`}
                                                    </p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-gray-900/40 border border-gray-700/30">
                                                    <p className="text-[10px] text-gray-400 font-medium">Trades</p>
                                                    <p className="font-bold text-white mt-0.5 font-mono">{item.tradesCount}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Clean Bottom Actions */}
                                <div className="p-3 bg-gray-900/40 border-t border-gray-700/40 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => scanSingleSymbol(item.symbol)}
                                        disabled={item.isScanning || isScanningAll}
                                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg border border-gray-700/60 transition cursor-pointer disabled:opacity-50"
                                        title="Quét lại mã này"
                                    >
                                        <RefreshCw size={13} className={item.isScanning ? 'animate-spin text-purple-400' : ''} />
                                    </button>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => handleOpenTemplateModal(symName, item.template?.documentId || item.template?.id)}
                                            className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 hover:text-white border border-purple-700/60 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                                            title="Xem chi tiết Strategy Template của symbol này"
                                        >
                                            <BookmarkCheck size={12} className="text-purple-400" />
                                            Template
                                        </button>

                                        <Link
                                            to={`/python-strategy?symbol=${symName}`}
                                            className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700/80 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                                            title="Chi tiết chiến lược Python"
                                        >
                                            <BrainCircuit size={12} className="text-purple-400" />
                                            Chi Tiết
                                        </Link>

                                        <Link
                                            to={`/trade-station?symbol=${symName}`}
                                            className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition flex items-center gap-1 cursor-pointer"
                                            title="Mở trên Trade Station"
                                        >
                                            <ExternalLink size={12} />
                                            Trade Station
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* TABLE VIEW */
                <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto max-h-[700px]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-900/70 text-gray-400 text-xs uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Symbol & Sàn</th>
                                    <th className="px-6 py-4 font-medium">Strategy Template</th>
                                    <th className="px-6 py-4 font-medium">Trạng Thái Vị Thế</th>
                                    <th className="px-6 py-4 font-medium">Giá Vào (Entry)</th>
                                    <th className="px-6 py-4 font-medium">Giá Hiện Tại</th>
                                    <th className="px-6 py-4 font-medium">Cắt Lỗ (SL)</th>
                                    <th className="px-6 py-4 font-medium">Chốt Lời (TP)</th>
                                    <th className="px-6 py-4 font-medium text-right">PnL Tạm Tính</th>
                                    <th className="px-6 py-4 font-medium text-right">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredItems.map(item => {
                                    const symName = String(item.symbol.Name || item.symbol.name || '').toUpperCase();
                                    const isOpen = Boolean(item.activeTrade);
                                    const isLong = item.status === 'open_long';
                                    const isProfit = (item.unrealizedPnl || 0) >= 0;

                                    return (
                                        <tr key={item.symbol.id || symName} className="hover:bg-gray-700/50 transition">
                                            {/* Symbol */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-white text-base">{symName}</span>
                                                    {item.symbol.exchange && (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                                                            {item.symbol.exchange}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.symbol.sector && (
                                                    <p className="text-xs text-gray-400 mt-0.5">{item.symbol.sector}</p>
                                                )}
                                            </td>

                                            {/* Strategy Template */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <BrainCircuit size={14} className="text-purple-400 shrink-0" />
                                                    <span className="font-medium text-purple-300 text-xs truncate max-w-[160px]" title={item.template?.name}>
                                                        {item.template?.name || '-'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-mono">[{item.template?.timeframe || 'D1'}]</span>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isOpen ? (
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isLong
                                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                                                        : 'bg-red-500/15 text-red-300 border border-red-500/40'
                                                        }`}>
                                                        {isLong ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                                        {isLong ? 'OPEN LONG' : 'OPEN SHORT'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700/40 text-gray-400 border border-gray-600/40">
                                                        <Clock size={11} />
                                                        Chờ Tín Hiệu
                                                    </span>
                                                )}
                                            </td>

                                            {/* Entry Price */}
                                            <td className="px-6 py-4 font-mono text-gray-200">
                                                {isOpen ? `$${Number(item.activeTrade.entry_price || item.activeTrade.entry || 0).toLocaleString()}` : '-'}
                                            </td>

                                            {/* Current Price */}
                                            <td className="px-6 py-4 font-mono font-bold text-white">
                                                ${Number(item.currentPrice || 0).toLocaleString()}
                                            </td>

                                            {/* SL */}
                                            <td className="px-6 py-4 font-mono text-red-400">
                                                {isOpen && item.activeTrade.stop_loss ? `$${Number(item.activeTrade.stop_loss).toLocaleString()}` : '-'}
                                            </td>

                                            {/* TP */}
                                            <td className="px-6 py-4 font-mono text-emerald-400">
                                                {isOpen && item.activeTrade.take_profit ? `$${Number(item.activeTrade.take_profit).toLocaleString()}` : '-'}
                                            </td>

                                            {/* PnL */}
                                            <td className="px-6 py-4 text-right whitespace-nowrap font-mono">
                                                {isOpen ? (
                                                    <span className={`font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {isProfit ? `+${item.unrealizedPnl}%` : `${item.unrealizedPnl}%`}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500 text-xs italic">N/A</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="flex justify-end items-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenTemplateModal(symName, item.template?.documentId || item.template?.id)}
                                                        className="px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 hover:text-white rounded-lg border border-purple-700/50 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                                                        title="Xem chi tiết Strategy Template của symbol này"
                                                    >
                                                        <BookmarkCheck size={13} className="text-purple-400" />
                                                        Template
                                                    </button>
                                                    <Link
                                                        to={`/python-strategy?symbol=${symName}`}
                                                        className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                                                        title="Chi tiết chiến lược Python"
                                                    >
                                                        <BrainCircuit size={13} className="text-purple-400" />
                                                        Chi Tiết
                                                    </Link>
                                                    <button
                                                        onClick={() => scanSingleSymbol(item.symbol)}
                                                        disabled={item.isScanning || isScanningAll}
                                                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition cursor-pointer disabled:opacity-50"
                                                        title="Quét lại mã này"
                                                    >
                                                        <RefreshCw size={14} className={item.isScanning ? 'animate-spin text-purple-400' : ''} />
                                                    </button>
                                                    <Link
                                                        to={`/trade-station?symbol=${symName}`}
                                                        className="p-1.5 text-purple-400 hover:bg-purple-900/30 rounded transition cursor-pointer"
                                                        title="Mở trên Trade Station"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Strategy Templates List Modal */}
            <StrategyTemplatesListModal
                isOpen={isTemplatesModalOpen}
                onClose={() => setIsTemplatesModalOpen(false)}
                templates={templates}
                selectedTemplateId={selectedTemplateIdForModal}
                selectedSymbol={selectedTemplateModalSymbol}
                onApplyTemplate={handleApplyTemplateFromModal}
                onDeleteTemplate={handleDeleteTemplate}
            />
        </div>
    );
};

export default PythonSignals;
