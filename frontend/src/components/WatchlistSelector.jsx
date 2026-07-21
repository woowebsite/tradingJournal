import { RefreshCw } from 'lucide-react';
import { useAccount } from '../context/AccountContext';

const WatchlistSelector = ({ onRefresh, refreshing = false, className = '' }) => {
    const {
        accountWatchlists,
        selectedWatchlist,
        setSelectedWatchlist,
    } = useAccount();

    return (
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
                className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white transition hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
                {accountWatchlists.length === 0 && <option value="">No Watchlists</option>}
                {accountWatchlists.map(watchlist => (
                    <option key={watchlist.documentId || watchlist.id} value={watchlist.documentId || watchlist.id}>
                        {watchlist.name}
                    </option>
                ))}
            </select>

            {onRefresh && (
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="text-gray-400 transition hover:text-blue-400 disabled:opacity-50"
                    title="Refresh Watchlist Data"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-400' : ''} />
                </button>
            )}
        </div>
    );
};

export default WatchlistSelector;
