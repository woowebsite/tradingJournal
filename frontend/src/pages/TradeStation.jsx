import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols, fetchHistories, loadExternalHistory, fetchExternalIndicators, syncSymbolMetadata } from '../features/marketSlice';
import { fetchSignals, scanSignals } from '../features/signalSlice';
import { fetchStrategies } from '../features/strategySlice';
import { fetchOpenTrades, fetchTrades } from '../features/tradeSlice';
import { createSymbol } from '../features/symbolSlice';
import { fetchWatchlists, updateWatchlist } from '../features/watchlistSlice';
import TradingViewChart from '../components/TradingViewChart';
import CreateSymbolModal from '../components/CreateSymbolModal';
import StrategyPanel from '../containers/StrategyPanel';
import TechnicalPanel from '../containers/TechnicalPanel';
import SignalPanel from '../containers/SignalPanel';
import { Search, RefreshCw, Plus } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { getTcbsRecommendations } from '../services/tcbsRecommendation';
import { fetchRecentTcbsStrategySignals } from '../services/tcbsStrategy';

const TradeStation = () => {
    const dispatch = useDispatch();
    const { symbols, histories, externalIndicators, loading } = useSelector(state => state.market);
    const { items: trades } = useSelector(state => state.trades);
    const { items: allSignals } = useSelector(state => state.signals);
    const { items: strategies } = useSelector(state => state.strategies);
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedSymbolId, setSelectedSymbolId] = useState(null);
    const [tcbsRecommendations, setTcbsRecommendations] = useState([]);
    const [tcbsRecentSignals, setTcbsRecentSignals] = useState([]);
    const [loadingTcbsInsights, setLoadingTcbsInsights] = useState(false);
    const [showCreateSymbolModal, setShowCreateSymbolModal] = useState(false);
    const [creatingSymbol, setCreatingSymbol] = useState(false);
    const [addingToWatchlist, setAddingToWatchlist] = useState(false);
    const lastAutoRefreshedSymbolRef = useRef(null);
    const autoOpenedMissingSymbolRef = useRef('');
    const { selectedAccount, defaultWatchlist } = useAccount();
    const symbolParam = searchParams.get('symbol');

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
        if (selectedAccount) {
            const accId = selectedAccount.documentId || selectedAccount.id;
            dispatch(fetchTrades({ accountId: accId, pageSize: 50 }));
        }
    }, [dispatch, selectedAccount]);

    const selectedSymbol = symbols.find(s => (s.documentId || s.id) === selectedSymbolId);

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
    const activeStrategyId = (() => {
        if (!selectedAccount || !selectedAccount.strategy) return null;
        if (typeof selectedAccount.strategy === 'object') {
            return selectedAccount.strategy.documentId || selectedAccount.strategy.id;
        }
        return selectedAccount.strategy;
    })();

    const activeStrategy = (() => {
        if (!activeStrategyId) return null;
        return strategies.find(s => (s.documentId == activeStrategyId || s.id == activeStrategyId));
    })();

    const strategySignals = activeStrategy
        ? allSignals.filter(signal => {
            if (!signal.rules || signal.rules.length === 0) return false;

            const strategyRuleIds = new Set();
            [
                ...(activeStrategy.rules || []),
                ...(activeStrategy.entryRules || []),
                ...(activeStrategy.takeProfitRules || []),
                ...(activeStrategy.stoplossRules || []),
                ...(activeStrategy.exitRules || [])
            ].forEach(rule => {
                if (rule.id) strategyRuleIds.add(rule.id.toString());
                if (rule.documentId) strategyRuleIds.add(rule.documentId.toString());
            });

            return signal.rules.some(rule =>
                (rule.id && strategyRuleIds.has(rule.id.toString())) ||
                (rule.documentId && strategyRuleIds.has(rule.documentId.toString()))
            );
        })
        : [];

    // Filter signals for selected symbol and current account strategy.
    const symbolSignals = selectedSymbolId
        ? strategySignals.filter(s => s.symbol.id === selectedSymbolId || s.symbol.documentId === selectedSymbolId)
        : [];

    const symbolTrades = selectedSymbolId ? trades.filter(t => t.symbol.id === selectedSymbolId || t.symbol.documentId === selectedSymbolId) : [];

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
                        strategyId: activeStrategyId
                    })).unwrap();
                }

                return 0;
            })
            .then(() => {
                dispatch(fetchSignals());
                if (accountId) dispatch(fetchTrades({ accountId, pageSize: 50 }));
            })
            .catch(err => console.error(`Failed to refresh history: ${err}`));

        // Also sync metadata (Exchange & Sector)
        dispatch(syncSymbolMetadata({ ticker, symbolId: selectedSymbolId }))
            .unwrap()
            .then(() => console.log(`Metadata synced for ${ticker}`))
            .catch(err => console.error(`Failed to sync metadata: ${err}`));
    }, [activeStrategy, activeStrategyId, dispatch, selectedAccount, selectedSymbol, selectedSymbolId]);

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
                            <TradingViewChart data={histories} symbol={selectedSymbol?.Name} signals={symbolSignals} />
                        </div>
                    </div>

                    {/* Strategy Panel */}
                    <StrategyPanel
                        activeStrategy={activeStrategy}
                        trades={symbolTrades}
                        recommendations={tcbsRecommendations}
                        tcbsSignals={tcbsRecentSignals}
                        loadingTcbsInsights={loadingTcbsInsights}
                    />
                </div>
                <div className="w-80 flex flex-col gap-4 h-full shrink-0">
                    <SignalPanel trades={symbolTrades} signals={symbolSignals} />
                    <TechnicalPanel externalIndicators={externalIndicators} />
                </div>
            </div>
        </div>
    );
};

export default TradeStation;
