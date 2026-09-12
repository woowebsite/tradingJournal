import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Edit2, Filter, Plus, Search, Trash2 } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import api from '../services/api';
import ScoredModal from '../components/ScoredModal';

const getItemId = (item) => item?.documentId || item?.id || '';
const getMarket = (item) => item?.Market || item?.market || null;
const getMarketId = (item) => getItemId(getMarket(item));
const getMarketLabel = (item) => getMarket(item)?.Name || getMarket(item)?.name || 'Unknown Market';

const unwrapList = (response) => {
    const data = response?.data?.data;
    if (Array.isArray(data)) return data;
    return [];
};

const ManageScored = () => {
    const { selectedAccount } = useAccount();
    const [scoredItems, setScoredItems] = useState([]);
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [marketFilter, setMarketFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingScored, setEditingScored] = useState(null);
    const initializedMarketFilterRef = useRef(false);

    const selectedAccountMarketId = selectedAccount?.market ? getItemId(selectedAccount.market) : '';

    useEffect(() => {
        if (!initializedMarketFilterRef.current && selectedAccountMarketId) {
            setMarketFilter(selectedAccountMarketId);
            initializedMarketFilterRef.current = true;
        }
    }, [marketFilter, selectedAccountMarketId]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError('');

            const [scoredRes, marketRes] = await Promise.all([
                api.get('/scoreds?populate=Market&sort=Label:asc&pagination[pageSize]=1000'),
                api.get('/markets?sort=Name:asc&pagination[pageSize]=1000')
            ]);

            setScoredItems(unwrapList(scoredRes));
            setMarkets(unwrapList(marketRes));
        } catch (err) {
            console.error('Failed to load scored data:', err);
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to load scored data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredScoredItems = useMemo(() => {
        return scoredItems.filter(item => {
            const label = (item.Label || item.label || '').toLowerCase();
            const description = (item.Description || item.description || '').toLowerCase();
            const marketLabel = getMarketLabel(item).toLowerCase();
            const matchesSearch = !searchTerm.trim()
                || label.includes(searchTerm.toLowerCase())
                || description.includes(searchTerm.toLowerCase())
                || marketLabel.includes(searchTerm.toLowerCase());
            const matchesMarket = !marketFilter || getMarketId(item) === marketFilter;
            return matchesSearch && matchesMarket;
        });
    }, [marketFilter, scoredItems, searchTerm]);

    const handleCreate = () => {
        setEditingScored(null);
        setIsModalOpen(true);
    };

    const handleEdit = (item) => {
        setEditingScored(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (item) => {
        const id = getItemId(item);
        if (!id) return;
        if (!window.confirm(`Delete scored "${item.Label || 'Untitled'}"?`)) return;

        try {
            setSaving(true);
            await api.delete(`/scoreds/${id}`);
            await loadData();
        } catch (err) {
            console.error('Failed to delete scored:', err);
            alert(err?.response?.data?.error?.message || err?.message || 'Failed to delete scored.');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (formData) => {
        try {
            setSaving(true);
            const payload = {
                Label: formData.Label.trim(),
                Description: formData.Description.trim(),
                Market: formData.Market || null
            };

            const id = getItemId(editingScored);
            if (id) {
                await api.put(`/scoreds/${id}`, { data: payload });
            } else {
                await api.post('/scoreds', { data: payload });
            }

            setIsModalOpen(false);
            setEditingScored(null);
            await loadData();
        } catch (err) {
            console.error('Failed to save scored:', err);
            alert(err?.response?.data?.error?.message || err?.message || 'Failed to save scored.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <CheckSquare className="text-blue-400" size={32} />
                        Scored
                    </h1>
                    <p className="mt-2 text-sm text-gray-400">
                        Define scored labels by market. Trades can be matched to scored items through the same Market.
                    </p>
                    {selectedAccount?.market && (
                        <p className="mt-1 text-xs text-gray-500">
                            Active account market: {selectedAccount.market.Name || selectedAccount.market.name || 'Unknown Market'}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCreate}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
                    >
                        <Plus size={18} />
                        New Scored
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </div>
            )}

            <div className="rounded-2xl border border-gray-700 bg-gray-800 shadow-lg overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-gray-700 bg-gray-900/50 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search label, description, or market..."
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 py-2.5 pl-10 pr-4 text-gray-200 outline-none transition focus:border-blue-500"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2">
                            <Filter size={16} className="text-gray-500" />
                            <select
                                value={marketFilter}
                                onChange={(e) => setMarketFilter(e.target.value)}
                                className="bg-transparent text-sm text-gray-200 outline-none"
                            >
                                <option value="">All Markets</option>
                                {markets.map(market => {
                                    const marketId = getItemId(market);
                                    return (
                                        <option key={marketId} value={marketId}>
                                            {market.Name || market.name || 'Unknown Market'}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {marketFilter && (
                            <button
                                type="button"
                                onClick={() => setMarketFilter('')}
                                className="text-sm text-gray-400 underline transition hover:text-white"
                            >
                                Clear filter
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/40 text-xs uppercase tracking-wider text-gray-400">
                            <tr>
                                <th className="px-6 py-4 font-medium">Label</th>
                                <th className="px-6 py-4 font-medium">Market</th>
                                <th className="px-6 py-4 font-medium">Description</th>
                                <th className="px-6 py-4 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/60">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                        Loading scored data...
                                    </td>
                                </tr>
                            ) : filteredScoredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                        No scored found.
                                    </td>
                                </tr>
                            ) : (
                                filteredScoredItems.map(item => {
                                    const itemId = getItemId(item);
                                    return (
                                        <tr key={itemId} className="transition hover:bg-gray-700/30">
                                            <td className="px-6 py-4 font-medium text-white">
                                                {item.Label || item.label || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-300">
                                                {getMarketLabel(item)}
                                            </td>
                                            <td className="px-6 py-4 max-w-xl truncate text-gray-400" title={item.Description || item.description || ''}>
                                                {item.Description || item.description || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(item)}
                                                        disabled={saving}
                                                        className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item)}
                                                        disabled={saving}
                                                        className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ScoredModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingScored(null);
                }}
                onSubmit={handleSubmit}
                initialData={editingScored}
                markets={markets}
                defaultMarketId={marketFilter || selectedAccountMarketId}
            />
        </div>
    );
};

export default ManageScored;
