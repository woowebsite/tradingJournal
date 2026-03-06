import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols, fetchHistories, loadExternalHistory, fetchExternalIndicators } from '../features/marketSlice';
import { fetchSignals } from '../features/signalSlice';
import { fetchStrategies } from '../features/strategySlice';
import TradingViewChart from '../components/TradingViewChart';
import IndicatorTable from '../components/IndicatorTable';
import { Search, RefreshCw, Activity } from 'lucide-react';
import { useAccount } from '../context/AccountContext';

const TradeStation = () => {
    const dispatch = useDispatch();
    const { symbols, histories, externalIndicators, loading } = useSelector(state => state.market);
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
        ? allSignals.filter(s => {
            const symId = s.symbol?.documentId || s.symbol?.id;
            return (symId && selectedSymbolId && symId.toString() === selectedSymbolId.toString());
        })
        : [];

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
                else alert('No new records');
            })
            .catch(err => console.error(`Failed to refresh: ${err}`));
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
            <div className="flex flex-1 gap-4 min-h-0">
                {/* Left Column: Chart & Strategy */}
                <div className="flex flex-col flex-1 gap-4 min-h-0">
                    {/* Left Panel: Chart */}
                    <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                        <div className="p-2 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-white">
                                    {selectedSymbol ? `${selectedSymbol.Name}` : 'Select a Symbol'}
                                </h2>
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
                    <div className="h-60 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col shrink-0">
                        <div className="p-2 border-b border-gray-700 bg-gray-900/50 flex items-center gap-2">
                            <Activity size={18} className="text-purple-400" />
                            <h3 className="text-lg font-bold text-white">Strategy Summary</h3>
                        </div>
                        <div className="p-2 overflow-y-auto custom-scrollbar flex-1 text-sm text-gray-300">
                            {activeStrategy ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="mb-1"><span className="font-semibold text-gray-400">Name:</span> <span className="text-blue-400 font-medium text-base">{activeStrategy.name}</span></p>
                                        <p className="mb-1"><span className="font-semibold text-gray-400">Description:</span> {activeStrategy.description || 'No description'}</p>
                                    </div>
                                    <div>
                                        <p className="mb-1"><span className="font-semibold text-gray-400">Rules:</span> {activeStrategy.rules?.length || 0} active rules</p>
                                        <div className="mt-2">
                                            {activeStrategy.rules?.map((rule, index) => (
                                                <p key={index} className="mb-1"><span className="font-semibold text-gray-400">{rule.Name}:</span> {rule.Description || 'No description'}</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 italic mt-2">No active strategy for this account.</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="w-80 rounded-xl overflow-hidden shadow-lg flex flex-col">
                    {/* Technical Indicators */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                        <div className="p-2 border-b border-gray-700 bg-gray-900/50 flex items-center gap-2">
                            <Activity size={18} className="text-blue-400" />
                            <h3 className="text-lg font-bold text-white">Technical Indicators</h3>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                            <IndicatorTable indicators={(() => {
                                if (!externalIndicators || !externalIndicators.indicator) return [];
                                const indObj = externalIndicators.indicator;
                                const list = [];
                                Object.keys(indObj).forEach(key => {
                                    if (key === 'ticker' || key === 'signal') return;
                                    const item = indObj[key];
                                    if (item && typeof item === 'object') {
                                        list.push({
                                            indicator: key.toUpperCase(),
                                            signal: item.signal,
                                            value: item.value
                                        });
                                    }
                                });
                                return list;
                            })()} />
                        </div>
                    </div>

                    {/* Moving Avergage */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col mt-3">
                        <div className="p-2 border-b border-gray-700 bg-gray-900/50 flex items-center gap-2">
                            <Activity size={18} className="text-green-400" />
                            <h3 className="text-lg font-bold text-white">Moving Average</h3>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                            <IndicatorTable indicators={(() => {
                                if (!externalIndicators || !externalIndicators.simple) return [];
                                const indObj = externalIndicators.simple; // Default to Simple MA
                                const list = [];
                                Object.keys(indObj).forEach(key => {
                                    if (key === 'ticker' || key === 'signal') return;
                                    const item = indObj[key];
                                    if (item && typeof item === 'object') {
                                        list.push({
                                            indicator: key.toUpperCase(),
                                            signal: item.signal,
                                            value: item.value
                                        });
                                    }
                                });
                                return list;
                            })()} />
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col mt-3">
                        <div className="p-2 border-b border-gray-700 bg-gray-900/50 flex items-center gap-2">
                            <Activity size={18} className="text-orange-400" />
                            <h3 className="text-lg font-bold text-white">Summary</h3>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                            <IndicatorTable indicators={(() => {
                                if (!externalIndicators || !externalIndicators.summary) return [];
                                const sumObj = externalIndicators.summary;
                                const list = [];
                                // Summary object: { sell: 0, buy: 17, neutral: 7, signal: "Strong Buy" }
                                list.push({ indicator: 'Buy Count', value: sumObj.buy, signal: 'Buy' });
                                list.push({ indicator: 'Sell Count', value: sumObj.sell, signal: 'Sell' });
                                list.push({ indicator: 'Neutral Count', value: sumObj.neutral, signal: 'Neutral' });
                                list.push({ indicator: 'Overall Signal', signal: sumObj.signal, value: '' });
                                return list;
                            })()} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TradeStation;
