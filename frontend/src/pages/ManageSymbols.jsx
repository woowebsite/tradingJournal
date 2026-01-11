import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols, createSymbol, updateSymbol, deleteSymbol } from '../features/symbolSlice';
import { Save, X, Edit2, Trash2, Tag } from 'lucide-react';
import { useAccount } from '../context/AccountContext';

const ManageSymbols = () => {
    const dispatch = useDispatch();
    const { items: symbols, loading } = useSelector(state => state.symbols);
    const { selectedAccount } = useAccount();

    const [formData, setFormData] = useState({
        Name: '',
        Description: ''
    });
    const [editingId, setEditingId] = useState(null); // ID of symbol being edited

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (symbol) => {
        setFormData({
            Name: symbol.Name,
            Description: symbol.Description || ''
        });
        setEditingId(symbol.id || symbol.documentId);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => {
        setFormData({ Name: '', Description: '' });
        setEditingId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData };
            if (selectedAccount?.market) {
                payload.market = selectedAccount.market.documentId || selectedAccount.market.id;
            }

            if (editingId) {
                await dispatch(updateSymbol({ id: editingId, data: payload })).unwrap();
            } else {
                await dispatch(createSymbol(payload)).unwrap();
            }
            handleCancel();
        } catch (err) {
            // Strapi error structure handling
            const errorMsg = err?.error?.message || err?.message || 'Unknown error';
            if (errorMsg.includes('must be unique')) {
                alert('Symbol name must be unique. This name is already taken.');
            } else {
                alert(`Failed to save symbol: ${errorMsg}`);
            }
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this symbol?')) return;
        try {
            await dispatch(deleteSymbol(id)).unwrap();
            if (editingId === id) handleCancel();
        } catch (error) {
            alert(`Failed to delete symbol: ${error}`);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Tag className="text-purple-500" size={32} />
                    Manage Symbols
                </h1>
                <p className="text-gray-400 mt-2">Create and manage your trading symbols.</p>
            </div>

            {/* Form Section */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-lg">
                <h2 className="text-xl font-bold text-white mb-4">
                    {editingId ? 'Edit Symbol' : 'Create New Symbol'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                            <input
                                type="text"
                                name="Name"
                                value={formData.Name}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                required
                                placeholder="e.g. BTCUSD"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                            <textarea
                                name="Description"
                                value={formData.Description}
                                onChange={handleChange}
                                rows="2"
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                placeholder="Optional description"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition font-medium text-white shadow-lg shadow-purple-500/20"
                        >
                            <Save size={18} />
                            {editingId ? 'Update Symbol' : 'Save Symbol'}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition font-medium text-gray-300"
                            >
                                <X size={18} />
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Table Section */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
                <div className="p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Symbol List</h2>
                </div>
                <div className="overflow-auto max-h-[600px]">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-3 font-medium">Name</th>
                                <th className="px-6 py-3 font-medium">Description</th>
                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading && symbols.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-8 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : symbols.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-8 text-center text-gray-500">No symbols found for this market.</td>
                                </tr>
                            ) : (
                                symbols.map(symbol => (
                                    <tr key={symbol.id} className="hover:bg-gray-700/50 transition">
                                        <td className="px-6 py-4 text-white font-medium">{symbol.Name}</td>
                                        <td className="px-6 py-4 text-gray-400">{symbol.Description || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(symbol)}
                                                    className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded transition cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(symbol.id || symbol.documentId)}
                                                    className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition cursor-pointer"
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

export default ManageSymbols;
