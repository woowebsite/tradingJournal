import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols, fetchHistories, loadExternalHistory, fetchExternalIndicators } from '../features/marketSlice';
import { fetchSignals } from '../features/signalSlice';
import TradingViewChart from '../components/TradingViewChart';
import IndicatorTable from '../components/IndicatorTable';
import { Search, RefreshCw, Activity } from 'lucide-react';
import { useAccount } from '../context/AccountContext';

const TradeStation = () => {
    const dispatch = useDispatch();
    const { symbols, histories, externalIndicators, loading } = useSelector(state => state.market);
    const { items: allSignals } = useSelector(state => state.signals);
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedSymbolId, setSelectedSymbolId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);

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

    const { selectedAccount, accountSymbols, defaultWatchlist } = useAccount();

    const filteredSymbols = (() => {
        if (searchTerm) {
            return accountSymbols.filter(s =>
                s.Name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (defaultWatchlist?.symbols && defaultWatchlist.symbols.length > 0) {
            return defaultWatchlist.symbols;
        }
        return accountSymbols;
    })();

    const selectedSymbol = symbols.find(s => (s.documentId || s.id) === selectedSymbolId);

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

    const handleWatchlistRefresh = async () => {
        if (!filteredSymbols || filteredSymbols.length === 0) return;
        if (!window.confirm(`Refresh data for all ${filteredSymbols.length} symbols in the list?`)) return;

        setIsWatchlistLoading(true);
        let updatedCount = 0;
        let errors = 0;

        const promises = filteredSymbols.map(async (symbol) => {
            // Skip symbols without proper ID or Name
            const symId = symbol.documentId || symbol.id;
            const ticker = symbol.Name;
            if (!symId || !ticker) return;

            try {
                const count = await dispatch(loadExternalHistory({
                    symbol: ticker,
                    symbolId: symId,
                    marketType: selectedAccount?.market?.Name // Pass Account Market Type
                })).unwrap();
                if (count > 0) updatedCount++;
            } catch (err) {
                console.error(`Failed to refresh ${ticker}:`, err);
                errors++;
            }
        });

        await Promise.all(promises);
        setIsWatchlistLoading(false);
        alert(`Watchlist refresh complete.\nUpdated symbols: ${updatedCount}\nErrors: ${errors}`);

        // Refresh chart if selected symbol was part of it
        if (selectedSymbolId) {
            dispatch(fetchHistories(selectedSymbolId));
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
            <div className="flex flex-1 gap-4 min-h-0">
                {/* Left Panel: Chart */}
                <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                    <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
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

                {/* Right Panel: Watchlist */}
                <div className="w-80 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                    <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-white">Watchlist</h3>
                            <button
                                onClick={handleWatchlistRefresh}
                                disabled={isWatchlistLoading || (loading && !isWatchlistLoading)}
                                className="text-gray-400 hover:text-blue-400 transition"
                                title="Refresh All in Watchlist"
                            >
                                <RefreshCw size={16} className={isWatchlistLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {filteredSymbols.map(symbol => {
                            const id = symbol.documentId || symbol.id;
                            const isSelected = id === selectedSymbolId;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setSearchParams({ symbol: symbol.Name })}
                                    className={`w-full text-left p-2 text-sm rounded-lg flex justify-between items-center transition ${isSelected
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                        : 'hover:bg-gray-700 text-gray-300'
                                        }`}
                                >
                                    <span className="font-bold">{symbol.Name}</span>
                                    {/* We could show last price here if we had it easily available in symbol list */}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Bottom Panel: Indicators */}
            {selectedSymbol && (
                <div className="h-64 grid grid-cols-3 gap-4 shrink-0">

                    {/* Technical Indicators */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                        <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex items-center gap-2">
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
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                        <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex items-center gap-2">
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
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                        <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex items-center gap-2">
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
            )}
        </div>
    );
};

export default TradeStation;
