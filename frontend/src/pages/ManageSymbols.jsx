import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols, createSymbol, updateSymbol, deleteSymbol } from '../features/symbolSlice';
import { Edit2, Trash2, Tag, History, BrainCircuit, Plus, Search } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { deleteAllHistories } from '../features/marketSlice';
import { getStrategyTemplates } from '../services/strategyTemplate';
import SymbolModal from '../components/SymbolModal';

const ManageSymbols = () => {
    const dispatch = useDispatch();
    const { items: symbols, loading } = useSelector(state => state.symbols);
    const { selectedAccount } = useAccount();

    const [templates, setTemplates] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSymbol, setEditingSymbol] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const marketId = selectedAccount?.market?.documentId || selectedAccount?.market?.id;
        dispatch(fetchSymbols(marketId));
    }, [dispatch, selectedAccount?.market]);

    useEffect(() => {
        getStrategyTemplates()
            .then(data => setTemplates(data || []))
            .catch(err => console.error('Failed to load strategy templates:', err));
    }, []);

    const handleOpenCreate = () => {
        setEditingSymbol(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (symbol) => {
        setEditingSymbol(symbol);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSymbol(null);
    };

    const handleModalSubmit = async (payload, editingId) => {
        setIsSubmitting(true);
        try {
            if (selectedAccount?.market) {
                payload.market = selectedAccount.market.documentId || selectedAccount.market.id;
            }

            if (editingId) {
                await dispatch(updateSymbol({ id: editingId, data: payload })).unwrap();
            } else {
                await dispatch(createSymbol(payload)).unwrap();
            }

            const marketId = selectedAccount?.market?.documentId || selectedAccount?.market?.id;
            dispatch(fetchSymbols(marketId));
            handleCloseModal();
        } catch (err) {
            const errorMsg = err?.error?.message || err?.message || 'Unknown error';
            if (errorMsg.includes('must be unique')) {
                alert('Symbol name must be unique. This name is already taken.');
            } else {
                alert(`Failed to save symbol: ${errorMsg}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this symbol?')) return;
        try {
            await dispatch(deleteSymbol(id)).unwrap();
        } catch (error) {
            alert(`Failed to delete symbol: ${error}`);
        }
    };

    const handleClearHistory = async (symbol) => {
        const symbolId = symbol.documentId || symbol.id || symbol.Name;
        if (!symbolId) return;
        if (!window.confirm(`Are you sure you want to CLEAR ALL history records for ${symbol.Name}? This action cannot be undone.`)) return;
        try {
            const count = await dispatch(deleteAllHistories(symbolId)).unwrap();
            alert(`Successfully cleared ${count} history records for ${symbol.Name}`);
        } catch (error) {
            alert(`Failed to clear history: ${error}`);
        }
    };

    const getAssignedTemplate = (symbol) => {
        const assigned = symbol.strategy_template;
        if (!assigned) return null;
        if (typeof assigned === 'object' && assigned.name) {
            return assigned;
        }
        const targetId = assigned?.documentId || assigned?.id || assigned;
        return templates.find(t =>
            String(t.documentId || t.id) === String(targetId) ||
            String(t.id) === String(targetId)
        ) || null;
    };

    const filteredSymbols = useMemo(() => {
        if (!searchTerm.trim()) return symbols;
        const q = searchTerm.trim().toLowerCase();
        return symbols.filter(s =>
            (s.Name && s.Name.toLowerCase().includes(q)) ||
            (s.exchange && s.exchange.toLowerCase().includes(q)) ||
            (s.sector && s.sector.toLowerCase().includes(q)) ||
            (s.Description && s.Description.toLowerCase().includes(q))
        );
    }, [symbols, searchTerm]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Tag className="text-purple-500" size={32} />
                        Manage Symbols
                    </h1>
                    <p className="text-gray-400 mt-1">Quản lý danh sách các mã giao dịch và gán Python Strategy Template tương ứng.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 transition cursor-pointer"
                    >
                        <Plus size={18} />
                        Thêm Symbol Mới
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
                <div className="p-4 sm:p-6 border-b border-gray-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-white">Symbol List</h2>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-700 text-gray-300 font-semibold">
                            {filteredSymbols.length} {filteredSymbols.length === symbols.length ? 'symbols' : `of ${symbols.length}`}
                        </span>
                    </div>
                    {/* Search Bar */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm symbol, sàn, ngành..."
                            className="w-full bg-gray-900/70 border border-gray-600 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                        />
                    </div>
                </div>

                <div className="overflow-auto max-h-[650px]">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/60 text-gray-400 text-xs uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                            <tr>
                                <th className="px-6 py-3.5 font-medium">Name</th>
                                <th className="px-6 py-3.5 font-medium">Exchange</th>
                                <th className="px-6 py-3.5 font-medium">Sector</th>
                                <th className="px-6 py-3.5 font-medium">Strategy Template</th>
                                <th className="px-6 py-3.5 font-medium">Description</th>
                                <th className="px-6 py-3.5 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading && symbols.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">Đang tải danh sách symbols...</td>
                                </tr>
                            ) : filteredSymbols.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                        {searchTerm ? 'Không tìm thấy symbol nào khớp với từ khóa tìm kiếm.' : 'Chưa có symbol nào trong thị trường này.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredSymbols.map(symbol => {
                                    const assignedTpl = getAssignedTemplate(symbol);
                                    return (
                                        <tr key={symbol.id} className="hover:bg-gray-700/50 transition">
                                            <td className="px-6 py-4 text-white font-medium">{symbol.Name}</td>
                                            <td className="px-6 py-4 text-gray-300 text-sm whitespace-nowrap">{symbol.exchange || '-'}</td>
                                            <td className="px-6 py-4 text-gray-300 text-sm">{symbol.sector || '-'}</td>
                                            <td className="px-6 py-4 text-sm">
                                                {assignedTpl ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-700/50">
                                                        <BrainCircuit size={13} className="text-purple-400 shrink-0" />
                                                        <span className="truncate max-w-[200px]">{assignedTpl.name}</span>
                                                        <span className="text-[10px] opacity-75 font-mono">[{assignedTpl.timeframe || 'D1'}]</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500 text-xs italic">Chưa gắn template</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 max-w-xs truncate text-sm">{symbol.Description || '-'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenEdit(symbol)}
                                                        className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded-lg transition cursor-pointer"
                                                        title="Chỉnh sửa Symbol"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleClearHistory(symbol)}
                                                        className="p-1.5 text-amber-400 hover:bg-amber-900/30 rounded-lg transition cursor-pointer"
                                                        title="Xóa lịch sử nến"
                                                    >
                                                        <History size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(symbol.id || symbol.documentId)}
                                                        className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-lg transition cursor-pointer"
                                                        title="Xóa Symbol"
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

            {/* Symbol Create/Edit Modal */}
            <SymbolModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleModalSubmit}
                symbol={editingSymbol}
                templates={templates}
                existingSymbols={symbols}
                isSubmitting={isSubmitting}
            />
        </div>
    );
};

export default ManageSymbols;
