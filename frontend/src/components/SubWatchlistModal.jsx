import React, { useState, useEffect } from 'react';
import { X, Save, Box } from 'lucide-react';
import { useAccount } from '../context/AccountContext';

const SubWatchlistModal = ({ isOpen, onClose, onSubmit, initialData = null, watchlists = [], allSymbols = [] }) => {
    const { selectedAccount } = useAccount();
    const [formData, setFormData] = useState({
        name: '',
        fromWatchlistId: '',
        rule: '',
        isDefault: false,
        isSubWatchlist: true,
        symbols: [] // Array of symbol IDs
    });
    const [bulkText, setBulkText] = useState('');

    // symbols available for selection (from source watchlist)
    const [availableSymbols, setAvailableSymbols] = useState([]);

    useEffect(() => {
        if (initialData) {
            // Populate form with existing data
            const linkedSymbolIds = initialData.symbols?.map(s => s.documentId || s.id) || [];
            const symbolNames = initialData.symbols?.map(s => s.Name).join(', ') || '';

            // Format rule for display (stringify if object)
            let displayRule = initialData.rule || '';
            if (displayRule && typeof displayRule === 'object') {
                displayRule = JSON.stringify(displayRule, null, 2);
            }

            setFormData({
                name: initialData.name || '',
                fromWatchlistId: initialData.fromWatchlist?.id || initialData.fromWatchlist || '',
                rule: displayRule,
                isDefault: initialData.isDefault || false,
                isSubWatchlist: true,
                symbols: linkedSymbolIds
            });
            setBulkText(symbolNames);
        } else if (isOpen) {
            // Reset form for new entry
            setFormData({
                name: '',
                fromWatchlistId: '',
                rule: '',
                isDefault: false,
                isSubWatchlist: true,
                symbols: []
            });
            setBulkText('');
            setAvailableSymbols([]);
        }
    }, [initialData, isOpen]);

    // Update available symbols when fromWatchlistId changes
    useEffect(() => {
        if (formData.fromWatchlistId) {
            const sourceWl = watchlists.find(w => w.id == formData.fromWatchlistId);
            if (sourceWl && sourceWl.symbols) {
                setAvailableSymbols(sourceWl.symbols);

                // Auto-select all symbols from source
                const allIds = sourceWl.symbols.map(s => s.documentId || s.id);
                setFormData(prev => ({ ...prev, symbols: allIds }));

                const names = sourceWl.symbols.map(s => s.Name).join(', ');
                setBulkText(names);
            } else {
                setAvailableSymbols([]);
                setFormData(prev => ({ ...prev, symbols: [] }));
                setBulkText('');
            }
        } else {
            setAvailableSymbols([]);
            setFormData(prev => ({ ...prev, symbols: [] }));
            setBulkText('');
        }
    }, [formData.fromWatchlistId, watchlists]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const updateBulkText = (selectedIds, pool = availableSymbols) => {
        const names = selectedIds.map(id => {
            const sym = pool.find(s => (s.documentId || s.id).toString() === id.toString()) ||
                allSymbols.find(s => (s.documentId || s.id).toString() === id.toString());
            return sym ? sym.Name : null;
        }).filter(Boolean);
        setBulkText(names.join(', '));
    };

    const handleBulkInputChange = (e) => {
        const text = e.target.value;
        setBulkText(text);

        const names = text.split(/[,|\n]/).map(n => n.trim().toUpperCase()).filter(n => n !== '');
        const matchedIds = [];

        names.forEach(name => {
            // Only match from available symbols (source watchlist)
            const found = availableSymbols.find(s => s.Name.toUpperCase() === name);
            if (found) {
                matchedIds.push(found.documentId || found.id);
            }
        });

        const uniqueIds = Array.from(new Set(matchedIds));
        setFormData(prev => ({ ...prev, symbols: uniqueIds }));
    };

    const handleSymbolToggle = (symbolId) => {
        setFormData(prev => {
            const currentSymbols = prev.symbols;
            const isSelected = currentSymbols.includes(symbolId);
            const nextSymbols = isSelected
                ? currentSymbols.filter(id => id !== symbolId)
                : [...currentSymbols, symbolId];

            updateBulkText(nextSymbols);
            return { ...prev, symbols: nextSymbols };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Basic JSON validation and parsing for rule
        let parsedRule = null;
        if (formData.rule && formData.rule.trim() !== '') {
            try {
                parsedRule = JSON.parse(formData.rule);
            } catch (e) {
                alert('Invalid JSON in Rule field.');
                return;
            }
        }

        const payload = {
            ...formData,
            rule: parsedRule, // Send as JSON object, not string
            fromWatchlist: formData.fromWatchlistId, // Map form field to backend field
            account: selectedAccount ? (selectedAccount.documentId || selectedAccount.id) : null
        };
        // Remove fromWatchlistId as we use fromWatchlist
        delete payload.fromWatchlistId;

        onSubmit(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Box size={24} className="text-purple-400" />
                        {initialData ? 'Edit Sub Watchlist' : 'Create Sub Watchlist'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                required
                                placeholder="e.g., Banks from My List"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">From Watchlist</label>
                            <select
                                name="fromWatchlistId"
                                value={formData.fromWatchlistId}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                required
                            >
                                <option value="">Select source...</option>
                                {watchlists.map(wl => (
                                    <option key={wl.id} value={wl.id}>
                                        {wl.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                id="isDefault"
                                name="isDefault"
                                checked={formData.isDefault}
                                onChange={handleChange}
                                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 transition cursor-pointer"
                            />
                            <span className="text-sm text-gray-300 group-hover:text-white transition">
                                Set as Default Watchlist
                            </span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Rule (JSON format)</label>
                        <textarea
                            name="rule"
                            value={formData.rule}
                            onChange={handleChange}
                            rows="2"
                            className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-blue-100 font-mono text-xs focus:outline-none focus:border-purple-500 transition"
                            placeholder='{"sector": "Banks", "exchange": "HOSE"}'
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Bulk Symbols Import (from source)</label>
                        <textarea
                            value={bulkText}
                            onChange={handleBulkInputChange}
                            rows="3"
                            className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-blue-100 font-mono text-sm focus:outline-none focus:border-purple-500 transition"
                            placeholder="e.g. ACB, BID, CTG..."
                            disabled={!formData.fromWatchlistId}
                        />
                        {!formData.fromWatchlistId && <p className="text-[10px] text-yellow-500/70 mt-1">Select a source watchlist first.</p>}
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-400">Select Symbols (from source)</label>
                            <span className="text-xs font-medium px-2 py-0.5 bg-purple-600/20 text-purple-400 rounded-full border border-purple-500/30">
                                {formData.symbols.length} selected
                            </span>
                        </div>
                        <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4 max-h-60 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {availableSymbols.map(sym => {
                                    const symId = sym.documentId || sym.id;
                                    const isSelected = formData.symbols.includes(symId);
                                    return (
                                        <div
                                            key={symId}
                                            onClick={() => handleSymbolToggle(symId)}
                                            className={`
                                                cursor-pointer px-3 py-2 rounded-lg border text-sm transition flex items-center justify-between
                                                ${isSelected
                                                    ? 'bg-purple-600/20 border-purple-500/50 text-purple-200'
                                                    : 'bg-gray-800/40 border-gray-700 text-gray-500 hover:border-gray-500 hover:bg-gray-800'
                                                }
                                            `}
                                        >
                                            <span className={`${isSelected ? 'font-bold' : ''}`}>{sym.Name}</span>
                                            {isSelected && (
                                                <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                                            )}
                                        </div>
                                    );
                                })}
                                {availableSymbols.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-gray-600 italic text-sm">
                                        {formData.fromWatchlistId ? 'Source watchlist is empty.' : 'Please select a source watchlist.'}
                                    </div>
                                )}
                            </div>
                        </div>
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
                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition font-medium text-white shadow-lg shadow-purple-600/20"
                    >
                        <Save size={18} />
                        {initialData ? 'Update Sub Watchlist' : 'Create Sub Watchlist'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubWatchlistModal;
