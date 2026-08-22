import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols, fetchHistories, loadExternalHistory, fetchExternalIndicators, syncSymbolMetadata } from '../features/marketSlice';
import { fetchSignals, scanSignals } from '../features/signalSlice';
import { fetchStrategies } from '../features/strategySlice';
import { deleteTrade, fetchOpenTrades, fetchTrades, saveTrade } from '../features/tradeSlice';
import { createSymbol } from '../features/symbolSlice';
import { fetchWatchlists, updateWatchlist } from '../features/watchlistSlice';
import TradingViewChart from '../components/TradingViewChart';
import CreateSymbolModal from '../components/CreateSymbolModal';
import StrategyPanel from '../containers/StrategyPanel';
import TechnicalPanel from '../containers/TechnicalPanel';
import WatchlistSelector from '../components/WatchlistSelector';
import TradeStationOrderForm from '../components/TradeStationOrderForm';
import TradeDetailModal from '../components/TradeDetailModal';
import TradeModal from '../components/TradeModal';
import { Search, RefreshCw, Plus } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { getTcbsRecommendations } from '../services/tcbsRecommendation';
import { upsertSymbolTechnicalAnalysis } from '../services/tcbs';
import { calculateSMA } from '../indicators/movingAverages';
import { calculateSupertrend } from '../indicators/supertrend';
import { calculateIchimoku } from '../indicators/ichimoku/ichimoku';
import { fetchRecentTcbsStrategySignals } from '../services/tcbsStrategy';
import { getStrategyId } from '../utils/roadmapCalculations';

const TradeStation = () => {
    const dispatch = useDispatch();
    const { symbols, histories, externalIndicators, loading } = useSelector(state => state.market);
    const { items: allSignals } = useSelector(state => state.signals);
    const { items: strategies } = useSelector(state => state.strategies);
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedSymbolId, setSelectedSymbolId] = useState(null);
    const [accountTrades, setAccountTrades] = useState([]);
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [tradeToEdit, setTradeToEdit] = useState(null);
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [tcbsRecommendations, setTcbsRecommendations] = useState([]);
    const [tcbsRecentSignals, setTcbsRecentSignals] = useState([]);
    const [loadingTcbsInsights, setLoadingTcbsInsights] = useState(false);
    const [showCreateSymbolModal, setShowCreateSymbolModal] = useState(false);
    const [creatingSymbol, setCreatingSymbol] = useState(false);
    const [addingToWatchlist, setAddingToWatchlist] = useState(false);
    const [chartTemplate, setChartTemplate] = useState('Supertrend');
    const [vwapAnchor, setVwapAnchor] = useState('Year');
    const lastAutoRefreshedSymbolRef = useRef(null);
    const metadataSyncedSymbolRef = useRef(null);
    const autoOpenedMissingSymbolRef = useRef('');
    const { selectedAccount, defaultWatchlist } = useAccount();
    const symbolParam = searchParams.get('symbol');
    const priceParam = searchParams.get('price');
    const slPriceParam = searchParams.get('slPrice');
    const tpPriceParam = searchParams.get('tpPrice');

    useEffect(() => {
        if (symbolParam && symbols.length > 0) {
            const normalizedParam = symbolParam.trim().toUpperCase();
            const found = symbols.find(s => String(s.Name || '').trim().toUpperCase() === normalizedParam);
            if (found) {
                const id = found.documentId || found.id;
                setSelectedSymbolId(id);
                setShowCreateSymbolModal(false);
                autoOpenedMissingSymbolRef.current = '';
                return;
            }

            if (autoOpenedMissingSymbolRef.current !== normalizedParam) {
                autoOpenedMissingSymbolRef.current = normalizedParam;
                setShowCreateSymbolModal(true);
            }
        }
    }, [symbolParam, symbols]);

    const tradeSetupValue = useMemo(() => ({
        price: priceParam || '',
        slPrice: slPriceParam || '',
        tpPrice: tpPriceParam || ''
    }), [priceParam, slPriceParam, tpPriceParam]);

    const tradeSetupKey = useMemo(() => (
        [symbolParam || '', priceParam || '', slPriceParam || '', tpPriceParam || ''].join(':')
    ), [priceParam, slPriceParam, symbolParam, tpPriceParam]);

    useEffect(() => {
        dispatch(fetchSymbols());
        dispatch(fetchSignals());
        dispatch(fetchStrategies());
        dispatch(fetchOpenTrades({ accountId: selectedAccount?.documentId }));
    }, [dispatch, selectedAccount?.documentId]);

    // Select first symbol by default if likely?
    // Or just wait for user.

    useEffect(() => {
        if (selectedSymbolId) {
            dispatch(fetchHistories(selectedSymbolId));

            // Also fetch external indicators
            const sym = symbols.find(s => (s.documentId || s.id) === selectedSymbolId);
            if (sym && sym.Name) {
                dispatch(fetchExternalIndicators(sym.Name));
            }
        }
    }, [dispatch, selectedSymbolId, symbols]); // 'symbols' dependency keeps the selected symbol lookup stable

    useEffect(() => {
        const accountId = selectedAccount?.documentId || selectedAccount?.id;
        if (!accountId) {
            setAccountTrades([]);
            return;
        }

        let cancelled = false;
        dispatch(fetchTrades({ accountId, pageSize: 50 }))
            .unwrap()
            .then(fetchedTrades => {
                if (!cancelled) setAccountTrades(fetchedTrades || []);
            })
            .catch(error => {
                if (!cancelled) {
                    console.error('Failed to fetch Trade Station account trades:', error);
                    setAccountTrades([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [dispatch, selectedAccount]);

    const selectedSymbol = symbols.find(s => (s.documentId || s.id) === selectedSymbolId);

    useEffect(() => {
        if (!selectedSymbolId || !selectedSymbol?.Name) return;
        if (metadataSyncedSymbolRef.current === selectedSymbolId) return;
        metadataSyncedSymbolRef.current = selectedSymbolId;

        dispatch(syncSymbolMetadata({
            ticker: selectedSymbol.Name,
            symbolId: selectedSymbolId,
        }))
        .unwrap()
        .then(() => console.log(`Metadata and stock ratio synced for ${selectedSymbol.Name}`))
        .catch(err => {
            metadataSyncedSymbolRef.current = null;
            console.error(`Failed to sync metadata and stock ratio: ${err}`);
        });
    }, [dispatch, selectedSymbol?.Name, selectedSymbolId]);

    useEffect(() => {
        if (!selectedSymbolId || !histories || histories.length === 0) return;

        const sortedHistory = [...histories]
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .reduce((unique, candle) => {
                const date = String(candle.date || '').split('T')[0];
                if (date && unique[unique.length - 1]?.date !== date) {
                    unique.push({ ...candle, date });
                }
                return unique;
            }, []);
        const candles = sortedHistory.map(candle => ({
            time: candle.date,
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
        }));
        const supertrend = calculateSupertrend(10, 3, candles).at(-1);
        const ichimoku = calculateIchimoku(candles, {
            conversionPeriod: 26,
            basePeriod: 78,
            spanBPeriod: 156,
            displacement: 78,
        });
        const ma200 = calculateSMA(candles, 200).at(-1);

        upsertSymbolTechnicalAnalysis(selectedSymbolId, {
            supertrend: supertrend?.value ?? null,
            supertrendDirection: supertrend?.direction ?? null,
            k26: ichimoku.conversion.at(-1)?.value ?? null,
            k78: ichimoku.base.at(-1)?.value ?? null,
            ma200: ma200?.value ?? null,
            calculatedAt: new Date().toISOString(),
        }).catch(error => {
            console.error(`Failed to save technical analysis for ${selectedSymbol.Name}:`, error);
        });
    }, [histories, selectedSymbol?.Name, selectedSymbolId]);

    const refreshSelectedAccountTrades = useCallback(() => {
        const accountId = selectedAccount?.documentId || selectedAccount?.id;
        if (!accountId) return Promise.resolve();
        return dispatch(fetchTrades({ accountId, pageSize: 50 }))
            .unwrap()
            .then(fetchedTrades => {
                setAccountTrades(fetchedTrades || []);
                return fetchedTrades;
            });
    }, [dispatch, selectedAccount]);

    const handleEditTrade = useCallback((trade) => {
        setSelectedTrade(null);
        setTradeToEdit(trade);
        setIsTradeModalOpen(true);
    }, []);

    const handleSaveTrade = useCallback(async (tradeData) => {
        try {
            await dispatch(saveTrade({ tradeData, tradeToEdit })).unwrap();
            await refreshSelectedAccountTrades();
            dispatch(fetchOpenTrades({ accountId: selectedAccount?.documentId || selectedAccount?.id }));
            setIsTradeModalOpen(false);
            setTradeToEdit(null);
        } catch (error) {
            console.error('Failed to save trade from Trade Station:', error);
            alert(`Failed to save trade: ${error?.error?.message || error?.message || error}`);
        }
    }, [dispatch, refreshSelectedAccountTrades, selectedAccount, tradeToEdit]);

    const handleDeleteTrade = useCallback(async () => {
        if (!tradeToEdit) return;
        if (!window.confirm('Delete this trade and all of its trade details?')) return;

        try {
            await dispatch(deleteTrade({
                tradeId: tradeToEdit.documentId || tradeToEdit.id,
                tradeDetails: tradeToEdit.trade_details || []
            })).unwrap();
            await refreshSelectedAccountTrades();
            dispatch(fetchOpenTrades({ accountId: selectedAccount?.documentId || selectedAccount?.id }));
            setIsTradeModalOpen(false);
            setTradeToEdit(null);
        } catch (error) {
            console.error('Failed to delete trade from Trade Station:', error);
            alert(`Failed to delete trade: ${error?.error?.message || error?.message || error}`);
        }
    }, [dispatch, refreshSelectedAccountTrades, selectedAccount, tradeToEdit]);

    const handleCreateMissingSymbol = useCallback(async (formData) => {
        const name = String(formData?.Name || '').trim();
        if (!name) return;

        const normalizedName = name.toUpperCase();
        const existing = symbols.find(s => String(s.Name || '').trim().toUpperCase() === normalizedName);
        if (existing) {
            const existingId = existing.documentId || existing.id;
            setSelectedSymbolId(existingId);
            setShowCreateSymbolModal(false);
            setSearchParams({ symbol: normalizedName }, { replace: true });
            return;
        }

        setCreatingSymbol(true);
        try {
            const payload = {
                Name: normalizedName,
                Description: formData.Description || '',
                exchange: formData.exchange || '',
                sector: formData.sector || ''
            };

            if (selectedAccount?.market) {
                payload.market = selectedAccount.market.documentId || selectedAccount.market.id;
            }

            const created = await dispatch(createSymbol(payload)).unwrap();
            const createdId = created?.documentId || created?.id;
            const createdName = created?.Name || normalizedName;

            await dispatch(fetchSymbols());
            setShowCreateSymbolModal(false);

            if (createdId) {
                setSelectedSymbolId(createdId);
                setSearchParams({ symbol: createdName }, { replace: true });
            }
        } catch (error) {
            console.error('Failed to create missing symbol:', error);
            alert(`Failed to create symbol: ${error?.error?.message || error?.message || error}`);
        } finally {
            setCreatingSymbol(false);
        }
    }, [dispatch, selectedAccount?.market, setSearchParams, symbols]);

    const handleAddCurrentSymbolToWatchlist = useCallback(async () => {
        if (!selectedSymbol) return;
        if (!defaultWatchlist) {
            alert('No default watchlist found for the current account.');
            return;
        }

        const currentSymbolId = selectedSymbol.documentId || selectedSymbol.id;
        if (!currentSymbolId) return;

        const existingSymbolIds = (defaultWatchlist.symbols || [])
            .map(sym => sym.documentId || sym.id)
            .filter(Boolean);

        if (existingSymbolIds.includes(currentSymbolId)) {
            alert('Symbol is already in the current watchlist.');
            return;
        }

        setAddingToWatchlist(true);
        try {
            const nextSymbolIds = Array.from(new Set([...existingSymbolIds, currentSymbolId]));
            await dispatch(updateWatchlist({
                id: defaultWatchlist.documentId || defaultWatchlist.id,
                data: { symbols: nextSymbolIds }
            })).unwrap();
            await dispatch(fetchWatchlists());
        } catch (error) {
            console.error('Failed to add symbol to watchlist:', error);
            alert(`Failed to add symbol to watchlist: ${error?.error?.message || error?.message || error}`);
        } finally {
            setAddingToWatchlist(false);
        }
    }, [defaultWatchlist, dispatch, selectedSymbol]);

    useEffect(() => {
        const loadTcbsInsights = async () => {
            const ticker = selectedSymbol?.Name?.trim().toUpperCase();
            if (!ticker) {
                setTcbsRecommendations([]);
                setTcbsRecentSignals([]);
                return;
            }

            setLoadingTcbsInsights(true);
            try {
                const [recommendations, recentSignals] = await Promise.all([
                    getTcbsRecommendations({ ticker }),
                    fetchRecentTcbsStrategySignals(ticker),
                ]);
                setTcbsRecommendations(recommendations);
                setTcbsRecentSignals(recentSignals);
            } catch (err) {
                console.error('Failed to load TCBS insights for trade station:', err);
                setTcbsRecommendations([]);
                setTcbsRecentSignals([]);
            } finally {
                setLoadingTcbsInsights(false);
            }
        };

        loadTcbsInsights();
    }, [selectedSymbol?.Name]);

    // Active Strategy Look-up
    const activeStrategyId = getStrategyId(selectedAccount?.strategy);

    const activeStrategy = (() => {
        if (!activeStrategyId) return null;
        return strategies.find(s => {
            const strategyId = getStrategyId(s);
            return strategyId === activeStrategyId || s.documentId === activeStrategyId || s.id === activeStrategyId;
        });
    })();

    const activeStrategyRuleIds = new Set([
        ...(activeStrategy?.rules || []),
        ...(activeStrategy?.entryRules || []),
        ...(activeStrategy?.takeProfitRules || []),
        ...(activeStrategy?.stoplossRules || []),
        ...(activeStrategy?.exitRules || [])
    ]
        .map(rule => rule?.documentId || rule?.id || rule)
        .filter(Boolean)
        .map(id => id.toString()));

    // Signals do not store the strategy directly. They are linked to the
    // account and to rules, so use the active strategy's rule IDs here.
    const symbolSignals = selectedSymbolId
        ? allSignals.filter(signal => {
            const signalSymbolId = signal.symbol?.documentId || signal.symbol?.id;
            if (signalSymbolId?.toString() !== selectedSymbolId?.toString()) return false;

            const signalAccountId = signal.account?.documentId || signal.account?.id;
            const selectedAccountId = selectedAccount?.documentId || selectedAccount?.id;
            if (!signalAccountId || !selectedAccountId || signalAccountId.toString() !== selectedAccountId.toString()) {
                return false;
            }

            if (activeStrategyRuleIds.size === 0) return false;
            return (signal.rules || []).some(rule => {
                const ruleId = rule?.documentId || rule?.id || rule;
                return ruleId && activeStrategyRuleIds.has(ruleId.toString());
            });
        })
        : [];

    // Older manually-created trades may not have `mode` persisted even though
    // Real is the schema default. Demo trades are always explicitly marked.
    const realTrades = accountTrades.filter(trade => trade.mode !== 'Demo');

    const symbolTrades = selectedSymbolId
        ? realTrades.filter(trade => {
            const tradeSymbolIds = [trade.symbol?.documentId, trade.symbol?.id]
                .filter(id => id !== undefined && id !== null)
                .map(String);
            const selectedSymbolIds = [selectedSymbol?.documentId, selectedSymbol?.id, selectedSymbolId]
                .filter(id => id !== undefined && id !== null)
                .map(String);
            const idsMatch = tradeSymbolIds.some(id => selectedSymbolIds.includes(id));
            const namesMatch = trade.symbol?.Name && selectedSymbol?.Name
                && trade.symbol.Name.trim().toUpperCase() === selectedSymbol.Name.trim().toUpperCase();

            return idsMatch || namesMatch;
        })
        : realTrades;


    const handleRefresh = useCallback(() => {
        if (!selectedSymbol || !selectedSymbolId) return;
        const ticker = selectedSymbol.Name;
        if (!ticker) return;
        const accountId = selectedAccount ? (selectedAccount.documentId || selectedAccount.id) : null;
        const selectedRuleIds = Array.from(new Set([
            ...(activeStrategy?.rules || []),
            ...(activeStrategy?.entryRules || []),
            ...(activeStrategy?.takeProfitRules || []),
            ...(activeStrategy?.stoplossRules || []),
            ...(activeStrategy?.exitRules || [])
        ].map(rule => rule.documentId || rule.id).filter(Boolean)));
        const scanSymbols = [{
            id: selectedSymbolId,
            documentId: selectedSymbolId,
            name: selectedSymbol.Name,
            Name: selectedSymbol.Name
        }];

        dispatch(loadExternalHistory({
            symbol: ticker,
            symbolId: selectedSymbolId,
            marketType: selectedAccount?.market?.Name // Pass Account Market Type
        }))
            .unwrap()
            .then(count => {
                if (count > 0) console.log(`Updated ${count} new records for ${ticker}`);
                else if (count === 0) console.log('No new records');

                if (selectedRuleIds.length > 0) {
                    return dispatch(scanSignals({
                        selectedRuleIds,
                        scanSymbols,
                        accountId,
                        strategyId: activeStrategyId,
                        syncDemoTrades: false
                    })).unwrap();
                }

                return 0;
            })
            .then(() => {
                dispatch(fetchSignals());
                if (accountId) refreshSelectedAccountTrades();
            })
            .catch(err => console.error(`Failed to refresh history: ${err}`));

    }, [activeStrategy, activeStrategyId, dispatch, refreshSelectedAccountTrades, selectedAccount, selectedSymbol, selectedSymbolId]);

    useEffect(() => {
        if (!symbolParam || !selectedSymbol || !selectedSymbolId) return;

        const refreshKey = `${selectedSymbolId}:${symbolParam}`;
        if (lastAutoRefreshedSymbolRef.current === refreshKey) return;

        lastAutoRefreshedSymbolRef.current = refreshKey;
        handleRefresh();
    }, [handleRefresh, selectedSymbol, selectedSymbolId, symbolParam]);

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
            <CreateSymbolModal
                key={symbolParam || 'create-symbol'}
                isOpen={showCreateSymbolModal}
                onClose={() => setShowCreateSymbolModal(false)}
                onSubmit={handleCreateMissingSymbol}
                initialName={symbolParam || ''}
                isSubmitting={creatingSymbol}
            />

            <div className="flex flex-1 gap-4 min-h-0">
                {/* Left Column: Chart & Strategy */}
                <div className="flex flex-col flex-1 gap-4 min-h-0">
                    {/* Left Panel: Chart */}
                    <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                        <div className="p-2 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-xl font-bold text-white">
                                    {selectedSymbol ? `${selectedSymbol.Name}` : 'Select a Symbol'}
                                </h2>
                                <span className="text-sm text-gray-400">{selectedSymbol?.exchange} - {selectedSymbol?.sector}</span>
                            </div>

                            {loading && <span className="text-sm text-blue-400 animate-pulse">Loading data...</span>}

                            <div className="ml-auto flex items-end justify-end gap-2">
                                <label className="inline-flex items-center gap-2 text-sm text-gray-400">
                                    <span>Template</span>
                                    <select
                                        aria-label="Chart template"
                                        value={chartTemplate}
                                        onChange={event => setChartTemplate(event.target.value)}
                                        className="rounded-lg border border-gray-600 bg-gray-700 px-2.5 py-1.5 text-sm text-white transition hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="Supertrend">Supertrend</option>
                                        <option value="Ichimoku">Ichimoku</option>
                                        <option value="VWAP">VWAP</option>
                                    </select>
                                </label>
                                {chartTemplate === 'VWAP' && (
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-400">
                                        <span>Anchor</span>
                                        <select
                                            aria-label="VWAP Anchor"
                                            value={vwapAnchor}
                                            onChange={event => setVwapAnchor(event.target.value)}
                                            className="rounded-lg border border-gray-600 bg-gray-700 px-2.5 py-1.5 text-sm text-white transition hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="Day">Day</option>
                                            <option value="Week">Week</option>
                                            <option value="Month">Month</option>
                                            <option value="Year">Year</option>
                                        </select>
                                    </label>
                                )}
                                {selectedSymbol && (
                                    <button
                                        type="button"
                                        onClick={handleAddCurrentSymbolToWatchlist}
                                        disabled={addingToWatchlist || !defaultWatchlist}
                                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                        title={defaultWatchlist ? 'Add current symbol to default watchlist' : 'No default watchlist available'}
                                    >
                                        <Plus size={16} />
                                        {addingToWatchlist ? 'Adding...' : 'AddTo Watchlist'}
                                    </button>
                                )}
                                {selectedSymbol && (
                                    <button
                                        type="button"
                                        onClick={handleRefresh}
                                        disabled={loading}
                                        className="refresh-btn inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-blue-400 transition hover:bg-gray-600 disabled:opacity-50"
                                        title="Refresh Data"
                                    >
                                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                        Refresh
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <TradingViewChart data={histories} symbol={selectedSymbol?.Name} signals={symbolSignals} strategy={activeStrategy} template={chartTemplate} vwapAnchor={vwapAnchor} />
                        </div>
                    </div>

                    {/* Strategy Panel */}
                    <StrategyPanel
                        activeStrategy={activeStrategy}
                        trades={symbolTrades}
                        onTradeClick={setSelectedTrade}
                        signals={symbolSignals}
                        recommendations={tcbsRecommendations}
                        tcbsSignals={tcbsRecentSignals}
                        loadingTcbsInsights={loadingTcbsInsights}
                    />
                </div>
                <div className="w-80 flex flex-col gap-4 h-full shrink-0">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 shadow-lg flex flex-col">
                        <WatchlistSelector
                            className="justify-between mt-2"
                            showSymbols={true}
                            selectedSymbolId={selectedSymbolId}
                            onSymbolClick={(symbol) => {
                                setSelectedSymbolId(symbol.documentId || symbol.id);
                                setSearchParams({ symbol: symbol.Name }, { replace: true });
                            }}
                        />
                    </div>
                    <TradeStationOrderForm
                        key={tradeSetupKey}
                        selectedAccount={selectedAccount}
                        selectedSymbol={selectedSymbol}
                        activeStrategy={activeStrategy}
                        value={tradeSetupValue}
                        onSaved={refreshSelectedAccountTrades}
                    />
                    <TechnicalPanel externalIndicators={externalIndicators} />
                </div>
            </div>
            <TradeDetailModal
                isOpen={Boolean(selectedTrade)}
                onClose={() => setSelectedTrade(null)}
                trade={selectedTrade}
                onEdit={handleEditTrade}
            />
            <TradeModal
                isOpen={isTradeModalOpen}
                onClose={() => {
                    setIsTradeModalOpen(false);
                    setTradeToEdit(null);
                }}
                onSubmit={handleSaveTrade}
                onDelete={handleDeleteTrade}
                initialData={tradeToEdit}
            />
        </div>
    );
};

export default TradeStation;
