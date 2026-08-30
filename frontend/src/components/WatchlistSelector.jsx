import React, { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { RefreshCw, Edit2, TrendingUp, TrendingDown } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { loadExternalHistory, fetchHistories } from '../features/marketSlice';
import { updateWatchlist, fetchWatchlists } from '../features/watchlistSlice';
import WatchlistModal from './WatchlistModal';

const WatchlistSelector = ({ 
    className = '',
    showSymbols = false,
    selectedSymbolId = null,
    onSymbolClick = null,
    searchTerm = ''
}) => {
    const dispatch = useDispatch();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const {
        selectedAccount,
        accountSymbols = [],
        accountWatchlists,
        selectedWatchlist,
        setSelectedWatchlist,
    } = useAccount();

    const filteredSymbols = (() => {
        if (searchTerm) {
            return accountSymbols.filter(s =>
                s.Name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (selectedWatchlist?.symbols && selectedWatchlist.symbols.length > 0) {
            return selectedWatchlist.symbols;
        }
        return accountSymbols;
    })();

    const handleUpdateWatchlist = async (data) => {
        try {
            if (!selectedWatchlist) return;
            const id = selectedWatchlist.documentId || selectedWatchlist.id;
            await dispatch(updateWatchlist({ id, data })).unwrap();
            const res = await dispatch(fetchWatchlists()).unwrap();
            const updated = res.find(w => (w.documentId || w.id) === id);
            if (updated) {
                setSelectedWatchlist(updated);
            }
            setIsEditModalOpen(false);
        } catch (error) {
            console.error('Failed to update watchlist:', error);
            alert(`Failed to update watchlist: ${error?.message || error}`);
        }
    };

    const handleWatchlistRefresh = useCallback(async () => {
        if (!filteredSymbols || filteredSymbols.length === 0) return;
        if (!window.confirm(`Refresh data for all ${filteredSymbols.length} symbols in the list?`)) return;

        setIsRefreshing(true);
        let updatedCount = 0;
        let errors = 0;

        const promises = filteredSymbols.map(async (symbol) => {
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

        // Fetch all symbol histories with forceRefresh: true to update database -> Redux -> localStorage!
        const symbolIds = filteredSymbols.map(s => s.documentId || s.id).filter(Boolean);
        if (symbolIds.length > 0) {
            await dispatch(fetchHistories({ symbolIds, forceRefresh: true })).unwrap();
        }

        setIsRefreshing(false);
        alert(`Watchlist refresh complete.\nUpdated symbols: ${updatedCount}\nErrors: ${errors}`);
    }, [dispatch, filteredSymbols, selectedAccount?.market?.Name, selectedSymbolId]);

    return (
        <div className="w-full flex flex-col">
            <div id="watchlist-selected" className={`flex items-center gap-2 ${className}`}>
                <select
                    aria-label="Selected watchlist"
                    value={selectedWatchlist?.documentId || selectedWatchlist?.id || ''}
                    onChange={(event) => {
                        const watchlistId = event.target.value;
                        const watchlist = accountWatchlists.find(item =>
                            String(item.documentId || item.id) === watchlistId
                        );
                        if (watchlist) setSelectedWatchlist(watchlist);
                    }}
                    className="flex-1 min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white transition hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {accountWatchlists.length === 0 && <option value="">No Watchlists</option>}
                    {accountWatchlists.map(watchlist => (
                        <option key={watchlist.documentId || watchlist.id} value={watchlist.documentId || watchlist.id}>
                            {watchlist.name}
                        </option>
                    ))}
                </select>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsEditModalOpen(true)}
                        disabled={!selectedWatchlist}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-blue-400 disabled:opacity-50"
                        title="Edit Watchlist"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={handleWatchlistRefresh}
                        disabled={isRefreshing}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-blue-400 disabled:opacity-50"
                        title="Refresh Watchlist Data"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-400' : ''} />
                    </button>
                </div>
            </div>

            {selectedWatchlist && (
                <WatchlistModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSubmit={handleUpdateWatchlist}
                    initialData={selectedWatchlist}
                    symbols={accountSymbols}
                />
            )}

            {showSymbols && (
                <div id="symbol-list" className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-gray-900/40 mt-2 rounded-lg max-h-[250px]">
                    {filteredSymbols.length === 0 ? (
                        <div className="text-center text-sm text-gray-500 py-4">No symbols found</div>
                    ) : (
                        filteredSymbols.map(symbol => {
                            const id = symbol.documentId || symbol.id;

                            // Merge data from accountSymbols because watchlist symbols are not deeply populated
                            const fullSymbol = accountSymbols.find(s => (s.documentId || s.id) === id) || symbol;

                            let currentPrice = 0;
                            let isUp = true;
                            let changePercent = 0;

                            if (fullSymbol.symbol_histories && fullSymbol.symbol_histories.length > 0) {
                                const sorted = [...fullSymbol.symbol_histories].sort((a, b) => new Date(b.date) - new Date(a.date));
                                const latest = sorted[0];
                                currentPrice = latest.close || 0;

                                if (sorted.length > 1) {
                                    const diff = latest.close - latest.open;
                                    isUp = diff >= 0;
                                    changePercent = Math.abs((diff / latest.open) * 100);
                                }
                            }

                            const displayPrice = currentPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                            const displayChange = changePercent.toFixed(2);

                            const isSelected = selectedSymbolId?.toString() === id?.toString();

                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => onSymbolClick && onSymbolClick(symbol)}
                                    className={`w-full group text-left px-3 py-2 rounded-lg flex justify-between items-center transition border ${
                                        isSelected 
                                            ? 'bg-blue-600/10 border-blue-500/30' 
                                            : 'hover:bg-gray-700 border-transparent hover:border-gray-600'
                                    }`}
                                >
                                    <div className="flex flex-col">
                                        <span className={`font-bold text-xs ${isSelected ? 'text-blue-400' : 'text-gray-200 group-hover:text-white'} transition`}>{symbol.Name}</span>
                                        <span className="text-[10px] text-gray-500">{symbol.market?.Name || selectedAccount?.market?.Name || 'Asset'}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-medium text-gray-300">
                                            {displayPrice === "0.00" ? `-` : `${displayPrice}`}
                                        </span>
                                        <span className={`text-[10px] flex items-center gap-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                                            {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                            {displayChange}%
                                        </span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default WatchlistSelector;
