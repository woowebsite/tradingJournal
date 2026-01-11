import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, LineChart, RefreshCw } from 'lucide-react';
import api from '../services/api';
import SymbolHistoryModal from '../components/SymbolHistoryModal';
import { formatNumber } from '../utils/formatNumber';
import { useSelector, useDispatch } from 'react-redux';
import { fetchHistories, fetchSymbols, loadExternalHistory, setSymbolFilter, deleteAllHistories } from '../features/marketSlice';
import { useAccount } from '../context/AccountContext';

const ManageMarket = () => {
    const dispatch = useDispatch();
    const { histories, symbols, loading, selectedSymbolFilter } = useSelector((state) => state.market);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedHistoryToEdit, setSelectedHistoryToEdit] = useState(null);
    const { selectedAccount } = useAccount();

    useEffect(() => {
        dispatch(fetchSymbols());
    }, [dispatch]);

    useEffect(() => {
        dispatch(fetchHistories(selectedSymbolFilter));
    }, [dispatch, selectedSymbolFilter]);

    let filteredSymbols = symbols;
    if (selectedAccount?.market) {
        const accountMarketId = selectedAccount.market.id || selectedAccount.market.documentId;
        filteredSymbols = symbols.filter(s => {
            if (s.market && (s.market.id === accountMarketId || s.market.documentId === accountMarketId)) return true;
            if (s.markets && Array.isArray(s.markets)) {
                return s.markets.some(m => m.id === accountMarketId || m.documentId === accountMarketId);
            }
            return false;
        });
    } else {
        filteredSymbols = symbols;
    }

    const handleSave = async (data) => {
        try {
            if (selectedHistoryToEdit) {
                const id = selectedHistoryToEdit.documentId || selectedHistoryToEdit.id;
                await api.put(`/ symbol - histories / ${id} `, { data });
            } else {
                await api.post('/symbol-histories', { data });
            }
            // Fetch histories again to refresh
            dispatch(fetchHistories(selectedSymbolFilter));
            setIsModalOpen(false);
            setSelectedHistoryToEdit(null);
        } catch (error) {
            console.error('Error saving symbol history:', error);
            alert('Failed to save record');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this record?')) return;
        try {
            await api.delete(`/ symbol - histories / ${id} `);
            dispatch(fetchHistories(selectedSymbolFilter));
        } catch (error) {
            console.error('Error deleting symbol history:', error);
            alert('Failed to delete record');
        }
    };

    const openCreateModal = () => {
        setSelectedHistoryToEdit(null);
        setIsModalOpen(true);
    };

    const openEditModal = (history) => {
        setSelectedHistoryToEdit(history);
        setIsModalOpen(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString();
    };

    const handleLoadHistory = () => {
        if (!selectedSymbolFilter) return;

        // Find the symbol object to get the Name string
        const symbolObj = symbols.find(s => (s.id == selectedSymbolFilter || s.documentId == selectedSymbolFilter));

        if (!symbolObj) {
            alert('Symbol not found');
            return;
        }

        // The user ID/Name is what we send? TCBS likely needs "Ticker" e.g. "GEE"
        // Let's assume 'Name' or 'symbol' field holds the ticker.
        const ticker = symbolObj.Name || symbolObj.symbol;

        if (!ticker) {
            alert('Selected symbol has no valid Ticker name');
            return;
        }

        dispatch(loadExternalHistory({
            symbol: ticker,
            symbolId: selectedSymbolFilter
        })).unwrap()
            .then((count) => {
                alert(`Successfully loaded ${count} records for ${ticker}`);
            })
            .catch((err) => {
                alert(`Failed to load history: ${err} `);
            });
    };

    const handleDeleteAll = () => {
        if (!selectedSymbolFilter) return;

        if (!window.confirm('Are you sure you want to DELETE ALL history records for this symbol? This action cannot be undone.')) {
            return;
        }

        dispatch(deleteAllHistories(selectedSymbolFilter)).unwrap()
            .then((count) => {
                alert(`Successfully deleted ${count} records.`);
            })
            .catch((err) => {
                alert(`Failed to delete all records: ${err} `);
            });
    };

    return (
        <div>
            <SymbolHistoryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSave}
                initialData={selectedHistoryToEdit}
                symbols={filteredSymbols}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold flex items-center gap-3">
                    <LineChart className="text-blue-500" size={32} />
                    Manage Market Data
                </h2>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition font-medium text-white shadow-lg shadow-blue-500/20"
                >
                    <Plus size={18} />
                    New Record
                </button>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center gap-4">
                    <div className="relative">
                        <select
                            value={selectedSymbolFilter}
                            onChange={(e) => dispatch(setSymbolFilter(e.target.value))}
                            className="bg-gray-700 border border-gray-600 text-gray-200 rounded-lg pl-4 pr-10 py-2 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer min-w-[200px]"
                        >
                            <option value="">All Symbols</option>
                            {filteredSymbols.map(s => (
                                <option key={s.id} value={s.documentId || s.id}>
                                    {s.Name || s.symbol}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                        </div>
                    </div>

                    <button
                        onClick={handleLoadHistory}
                        disabled={!selectedSymbolFilter || loading}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Load Data"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        <span className="text-sm font-medium">Load Data</span>
                    </button>

                    {selectedSymbolFilter && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleDeleteAll}
                                className="px-3 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 rounded-lg transition text-sm font-medium border border-red-900/50"
                                title="Delete All History"
                            >
                                Delete All
                            </button>
                            <button
                                onClick={() => dispatch(setSymbolFilter(''))}
                                className="text-sm text-gray-400 hover:text-white underline"
                                title="Clear Filter"
                            >
                                Clear Filter
                            </button>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-sm uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Symbol</th>
                                <th className="px-6 py-4 text-right">Open</th>
                                <th className="px-6 py-4 text-right">High</th>
                                <th className="px-6 py-4 text-right">Low</th>
                                <th className="px-6 py-4 text-right">Close</th>
                                <th className="px-6 py-4 text-right">Volume</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">Loading data...</td>
                                </tr>
                            ) : histories.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">No market data found.</td>
                                </tr>
                            ) : (
                                histories.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-700/30 transition">
                                        <td className="px-6 py-4 text-gray-300 font-mono text-sm">{formatDate(item.date)}</td>
                                        <td className="px-6 py-4 font-medium text-white">
                                            {item.symbol?.Name || item.symbol?.symbol || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-300 font-mono">{formatNumber(item.open, '#,###.##')}</td>
                                        <td className="px-6 py-4 text-right text-green-400 font-mono">{formatNumber(item.high, '#,###.##')}</td>
                                        <td className="px-6 py-4 text-right text-red-400 font-mono">{formatNumber(item.low, '#,###.##')}</td>
                                        <td className="px-6 py-4 text-right text-blue-300 font-mono">{formatNumber(item.close, '#,###.##')}</td>
                                        <td className="px-6 py-4 text-right text-gray-400 font-mono">{item.volume?.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(item)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-400 transition hover:bg-gray-700 rounded"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.documentId || item.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-400 transition hover:bg-gray-700 rounded"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ManageMarket;
