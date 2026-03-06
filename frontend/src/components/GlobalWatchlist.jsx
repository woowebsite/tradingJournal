import React, { useState, useRef, useEffect } from 'react';
import { Search, RefreshCw, TrendingUp, TrendingDown, List as ListIcon } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHistories, loadExternalHistory } from '../features/marketSlice';
import { useNavigate } from 'react-router-dom';

const GlobalWatchlist = () => {
    const dispatch = useDispatch();
    const { symbols } = useSelector(state => state.market);
    const { selectedAccount, accountSymbols, defaultWatchlist } = useAccount();
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);
    const [selectedSymbolId, setSelectedSymbolId] = useState(null);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);
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

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition border border-gray-700 bg-gray-900 ${isOpen ? 'ring-1 ring-blue-500 text-white' : 'text-gray-400 hover:text-white cursor-pointer'}`}
                onClick={() => setIsOpen(true)}
            >
                <input
                    type="text"
                    placeholder="Watchlist..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="bg-transparent border-none outline-none text-sm text-gray-200 w-32 cursor-text transition-all"
                />
                <ListIcon size={16} className={isOpen ? 'text-blue-400' : 'text-gray-500'} />
            </div>

            {isOpen && (
                <div className="absolute right-0 top-full mt-4 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl flex flex-col z-50 max-h-[70vh] overflow-hidden">
                    <div className="p-3 border-b border-gray-700 bg-gray-800/95 backdrop-blur-sm">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-200">Your Watchlist</h3>
                            <button
                                onClick={handleWatchlistRefresh}
                                disabled={isWatchlistLoading || (isWatchlistLoading && !isWatchlistLoading)}
                                className={`text-gray-400 hover:text-blue-400 transition ${isWatchlistLoading ? 'animate-spin text-blue-400' : ''}`}
                                title="Refresh Data"
                            >
                                <RefreshCw size={14} className={isWatchlistLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-gray-900/40">
                        {filteredSymbols.length === 0 ? (
                            <div className="text-center text-sm text-gray-500 mt-4 mb-4">No symbols found</div>
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

                                return (
                                    <button
                                        key={id}
                                        onClick={() => {
                                            navigate(`/trade-station?symbol=${symbol.Name}`);
                                            setIsOpen(false);
                                        }}
                                        className="w-full group text-left px-3 py-2.5 rounded-lg flex justify-between items-center transition hover:bg-gray-700 border border-transparent hover:border-gray-600"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-200 group-hover:text-white transition">{symbol.Name}</span>
                                            <span className="text-xs text-gray-500">{symbol.market?.Name || selectedAccount?.market?.Name || 'Asset'}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-medium text-gray-300">
                                                {displayPrice === "0.00" ? `-` : `${displayPrice}`}
                                            </span>
                                            <span className={`text-xs flex items-center gap-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                                                {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                {displayChange}%
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalWatchlist;
