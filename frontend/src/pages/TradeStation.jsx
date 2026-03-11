import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols, fetchHistories, loadExternalHistory, fetchExternalIndicators, syncSymbolMetadata } from '../features/marketSlice';
import { fetchSignals } from '../features/signalSlice';
import { fetchStrategies } from '../features/strategySlice';
import { fetchOpenTrades, fetchTrades } from '../features/tradeSlice';
import TradingViewChart from '../components/TradingViewChart';
import StrategyPanel from '../containers/StrategyPanel';
import TechnicalPanel from '../containers/TechnicalPanel';
import SignalPanel from '../containers/SignalPanel';
import { Search, RefreshCw } from 'lucide-react';
import { useAccount } from '../context/AccountContext';

const TradeStation = () => {
    const dispatch = useDispatch();
    const { symbols, histories, externalIndicators, loading } = useSelector(state => state.market);
    const { items: trades, openTrades, loading: tradesLoading } = useSelector(state => state.trades);
    const { items: allSignals } = useSelector(state => state.signals);
    const { items: strategies } = useSelector(state => state.strategies);
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedSymbolId, setSelectedSymbolId] = useState(null);
    const symbolParam = searchParams.get('symbol');

    useEffect(() => {
        if (symbolParam && symbols.length > 0) {
            const found = symbols.find(s => s.Name === symbolParam);
            if (found) {
                const id = found.documentId || found.id;
                setSelectedSymbolId(id);
            }
        }
    }, [symbolParam, symbols]);

    useEffect(() => {
        dispatch(fetchSymbols());
        dispatch(fetchSignals());
        dispatch(fetchStrategies());
        dispatch(fetchOpenTrades({ accountId: selectedAccount?.documentId }));
    }, [dispatch]);

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
    }, [dispatch, selectedSymbolId]); // 'symbols' dependency might trigger too often if not careful, but selectedSymbolId change is main driver

    const { selectedAccount } = useAccount();

    useEffect(() => {
        if (selectedAccount) {
            const accId = selectedAccount.documentId || selectedAccount.id;
            dispatch(fetchTrades({ accountId: accId, pageSize: 50 }));
        }
    }, [dispatch, selectedAccount]);

    const selectedSymbol = symbols.find(s => (s.documentId || s.id) === selectedSymbolId);

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

    // Filter signals for selected symbol
    const symbolSignals = selectedSymbolId
        ? allSignals.filter(s => s.symbol.id === selectedSymbolId || s.symbol.documentId === selectedSymbolId)
        : [];

    const symbolTrades = selectedSymbolId ? trades.filter(t => t.symbol.id === selectedSymbolId || t.symbol.documentId === selectedSymbolId) : [];

    const handleRefresh = () => {
        if (!selectedSymbol || !selectedSymbolId) return;
        const ticker = selectedSymbol.Name;
        if (!ticker) return;

        dispatch(loadExternalHistory({
            symbol: ticker,
            symbolId: selectedSymbolId,
            marketType: selectedAccount?.market?.Name // Pass Account Market Type
        }))
            .unwrap()
            .then(count => {
                if (count > 0) console.log(`Updated ${count} new records for ${ticker}`);
                else if (count === 0) console.log('No new records');
            })
            .catch(err => console.error(`Failed to refresh history: ${err}`));

        // Also sync metadata (Exchange & Sector)
        dispatch(syncSymbolMetadata({ ticker, symbolId: selectedSymbolId }))
            .unwrap()
            .then(() => console.log(`Metadata synced for ${ticker}`))
            .catch(err => console.error(`Failed to sync metadata: ${err}`));
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
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

                            <div className="flex items-end justify-end gap-3">
                                {selectedSymbol && (
                                    <button
                                        onClick={handleRefresh}
                                        disabled={loading}
                                        className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-blue-400 disabled:opacity-50 transition shadow-sm"
                                        title="Refresh Data"
                                    >
                                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                    </button>
                                )}
                            </div>
                            {loading && <span className="text-sm text-blue-400 animate-pulse">Loading data...</span>}
                        </div>
                        <div className="flex-1 min-h-0">
                            <TradingViewChart data={histories} symbol={selectedSymbol?.Name} signals={symbolSignals} />
                        </div>
                    </div>

                    {/* Strategy Panel */}
                    <StrategyPanel activeStrategy={activeStrategy} allSignals={allSignals} trades={symbolTrades} />
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
