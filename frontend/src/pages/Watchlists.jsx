import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Edit2, Trash2, List, Eye } from 'lucide-react';
import { fetchWatchlists, createWatchlist, updateWatchlist, deleteWatchlist } from '../features/watchlistSlice';
import { fetchSymbols } from '../features/marketSlice';
import WatchlistModal from '../components/WatchlistModal';
import SubWatchlistModal from '../components/SubWatchlistModal';
import { useAccount } from '../context/AccountContext';

const ManageWatchlists = () => {
    const dispatch = useDispatch();
    const { items: watchlists, loading } = useSelector(state => state.watchlists);
    const { symbols } = useSelector(state => state.market);
    const { selectedAccount, accountSymbols } = useAccount();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [selectedWatchlist, setSelectedWatchlist] = useState(null);

    useEffect(() => {
        dispatch(fetchWatchlists());
        dispatch(fetchSymbols());
    }, [dispatch]);

    // Filter watchlists by selected account (if applicable)
    // The backend relationship is account -> watch_lists (oneToMany) typically.
    // If watchlists have an 'account' field populated, we can filter.
    const filteredWatchlists = selectedAccount
        ? watchlists.filter(wl => {
            const accId = wl.account?.documentId || wl.account?.id;
            const currentAccId = selectedAccount.documentId || selectedAccount.id;
            return !accId || (accId === currentAccId);
        })
        : watchlists;

    const handleCreate = async (data) => {
        try {
            await dispatch(createWatchlist(data)).unwrap();
            await dispatch(fetchWatchlists());
            setIsModalOpen(false);
            setIsSubModalOpen(false);
        } catch (error) {
            alert(`Failed to create watchlist: ${error}`);
        }
    };

    const handleUpdate = async (data) => {
        try {
            if (!selectedWatchlist) return;
            const id = selectedWatchlist.documentId || selectedWatchlist.id;
            await dispatch(updateWatchlist({ id, data })).unwrap();
            await dispatch(fetchWatchlists());
            setIsModalOpen(false);
            setIsSubModalOpen(false);
            setSelectedWatchlist(null);
        } catch (error) {
            alert(`Failed to update watchlist: ${error}`);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this watchlist?')) return;
        try {
            await dispatch(deleteWatchlist(id)).unwrap();
        } catch (error) {
            alert(`Failed to delete watchlist: ${error}`);
        }
    };

    const openCreateModal = () => {
        setSelectedWatchlist(null);
        setIsModalOpen(true);
    };

    const handleSubModalClose = () => {
        setIsSubModalOpen(false);
        setSelectedWatchlist(null);
    };

    const openEditModal = (watchlist) => {
        setSelectedWatchlist(watchlist);
        if (watchlist.isSubWatchlist) {
            setIsSubModalOpen(true);
        } else {
            setIsModalOpen(true);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <List className="text-blue-500" size={32} />
                        Manage Watchlists
                    </h1>
                    <p className="text-gray-400 mt-2">Create and organize your custom symbol lists.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsSubModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition font-medium text-white shadow-lg shadow-purple-500/20"
                    >
                        <Plus size={20} />
                        Create Sub Watchlist
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition font-medium text-white shadow-lg shadow-blue-500/20"
                    >
                        <Plus size={20} />
                        New Watchlist
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-12 text-gray-500">Loading watchlists...</div>
                ) : filteredWatchlists.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-gray-800/50 rounded-2xl border border-gray-700 border-dashed">
                        <p className="text-gray-400 text-lg">No watchlists found for this account.</p>
                        <button onClick={openCreateModal} className="mt-4 text-blue-400 hover:text-blue-300">Create one now</button>
                    </div>
                ) : (
                    filteredWatchlists.map(wl => (
                        <div key={wl.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg hover:shadow-xl transition flex flex-col">
                            <div className="p-5 border-b border-gray-700 flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                                        {wl.name}
                                        {wl.isSubWatchlist && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-900/40 text-purple-400 border border-purple-900/50 uppercase tracking-wide">
                                                Sub
                                            </span>
                                        )}
                                        {wl.isDefault && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-900/40 text-green-400 border border-green-900/50 uppercase tracking-wide">
                                                Default
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-sm text-gray-400 line-clamp-2 min-h-[1.25rem]">
                                        {wl.description || 'No description provided.'}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => openEditModal(wl)}
                                        className="p-2 text-gray-400 hover:text-blue-400 transition hover:bg-gray-700 rounded-lg"
                                        title="Edit"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(wl.documentId || wl.id)}
                                        className="p-2 text-gray-400 hover:text-red-400 transition hover:bg-gray-700 rounded-lg"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-5 bg-gray-900/30">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    Included Symbols
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {wl.symbols && wl.symbols.length > 0 ? (
                                        wl.symbols.slice(0, 8).map(s => (
                                            <span key={s.id} className="px-2 py-1 rounded bg-gray-800 border border-gray-600 text-xs font-medium text-gray-300">
                                                {s.Name}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm text-gray-500 italic">No symbols added yet.</span>
                                    )}
                                    {wl.symbols && wl.symbols.length > 8 && (
                                        <span className="px-2 py-1 rounded bg-gray-800 border border-gray-600 text-xs font-medium text-gray-400">
                                            +{wl.symbols.length - 8}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <WatchlistModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedWatchlist(null); }}
                onSubmit={selectedWatchlist ? handleUpdate : handleCreate}
                initialData={selectedWatchlist}
                symbols={accountSymbols}
            />

            <SubWatchlistModal
                isOpen={isSubModalOpen}
                onClose={handleSubModalClose}
                onSubmit={selectedWatchlist ? handleUpdate : handleCreate}
                initialData={selectedWatchlist}
                watchlists={filteredWatchlists}
                allSymbols={symbols}
            />
        </div>
    );
};

export default ManageWatchlists;
