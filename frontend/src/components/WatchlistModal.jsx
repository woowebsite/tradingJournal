import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useAccount } from '../context/AccountContext';

const WatchlistModal = ({ isOpen, onClose, onSubmit, initialData = null, symbols = [] }) => {
    const { selectedAccount } = useAccount();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isDefault: false,
        symbols: [] // Array of symbol IDs
    });

    useEffect(() => {
        if (initialData) {
            // Populate form with existing data
            const linkedSymbolIds = initialData.symbols?.map(s => s.documentId || s.id) || [];

            setFormData({
                name: initialData.name || '',
                description: initialData.description || '',
                isDefault: initialData.isDefault || false,
                symbols: linkedSymbolIds
            });
        } else {
            // Reset form for new entry
            setFormData({
                name: '',
                description: '',
                isDefault: false,
                symbols: []
            });
        }
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSymbolToggle = (symbolId) => {
        setFormData(prev => {
            const currentSymbols = prev.symbols;
            const isSelected = currentSymbols.includes(symbolId);
            if (isSelected) {
                return { ...prev, symbols: currentSymbols.filter(id => id !== symbolId) };
            } else {
                return { ...prev, symbols: [...currentSymbols, symbolId] };
            }
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Prepare payload
        const payload = {
            ...formData,
            account: selectedAccount ? (selectedAccount.documentId || selectedAccount.id) : null
        };
        onSubmit(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">
                        {initialData ? 'Edit Watchlist' : 'Create New Watchlist'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                required
                                placeholder="e.g., Potential Breakouts"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows="3"
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Optional description..."
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isDefault"
                                name="isDefault"
                                checked={formData.isDefault}
                                onChange={handleChange}
                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="isDefault" className="text-sm text-gray-300 pointer-events-none">
                                Set as Default Watchlist
                            </label>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-400">Select Symbols</label>
                        <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-4 max-h-60 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {symbols.map(sym => {
                                    const symId = sym.documentId || sym.id;
                                    const isSelected = formData.symbols.includes(symId);
                                    return (
                                        <div
                                            key={symId}
                                            onClick={() => handleSymbolToggle(symId)}
                                            className={`
                                                cursor-pointer px-3 py-2 rounded-lg border text-sm transition flex items-center justify-between
                                                ${isSelected
                                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
                                                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                                                }
                                            `}
                                        >
                                            <span className="font-bold">{sym.Name}</span>
                                            {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                                        </div>
                                    );
                                })}
                                {symbols.length === 0 && (
                                    <p className="col-span-full text-center text-gray-500 py-4">No symbols available.</p>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Selected: {formData.symbols.length}
                        </p>
                    </div>
                </form>

                <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-gray-800 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition font-medium text-white shadow-lg shadow-blue-600/20"
                    >
                        <Save size={18} />
                        {initialData ? 'Update Watchlist' : 'Create Watchlist'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WatchlistModal;
