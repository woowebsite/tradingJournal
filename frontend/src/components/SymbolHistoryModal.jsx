import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import api from '../services/api';

const SymbolHistoryModal = ({ isOpen, onClose, onSubmit, initialData, symbols: propSymbols }) => {
    const [formData, setFormData] = useState({
        symbol: '',
        date: new Date().toISOString().slice(0, 16),
        open: '',
        high: '',
        low: '',
        close: '',
        volume: ''
    });
    const [symbols, setSymbols] = useState([]);
    const [loadingSymbols, setLoadingSymbols] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (propSymbols) {
                setSymbols(propSymbols);
            } else {
                fetchSymbols();
            }
            if (initialData) {
                setFormData({
                    symbol: initialData.symbol?.documentId || initialData.symbol?.id || initialData.symbol || '',
                    date: initialData.date ? new Date(initialData.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
                    open: initialData.open || '',
                    high: initialData.high || '',
                    low: initialData.low || '',
                    close: initialData.close || '',
                    volume: initialData.volume || ''
                });
            } else {
                setFormData({
                    symbol: '',
                    date: new Date().toISOString().slice(0, 16),
                    open: '',
                    high: '',
                    low: '',
                    close: '',
                    volume: ''
                });
            }
        }
    }, [isOpen, initialData, propSymbols]);

    const fetchSymbols = async () => {
        try {
            setLoadingSymbols(true);
            const res = await api.get('/symbols');
            // Support both Strapi v4 array wrapper or direct array
            const data = res.data.data || res.data;
            setSymbols(data.map(item => ({
                id: item.id,
                documentId: item.documentId,
                ...item
            })));
        } catch (error) {
            console.error('Error fetching symbols:', error);
        } finally {
            setLoadingSymbols(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            open: parseFloat(formData.open),
            high: parseFloat(formData.high),
            low: parseFloat(formData.low),
            close: parseFloat(formData.close),
            volume: parseInt(formData.volume, 10),
            date: new Date(formData.date).toISOString()
        };
        onSubmit(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        {initialData ? 'Edit Market History' : 'New Market History'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Symbol</label>
                        <select
                            name="symbol"
                            value={formData.symbol}
                            onChange={handleChange}
                            required
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">Select Symbol</option>
                            {symbols.map(s => (
                                <option key={s.id} value={s.documentId || s.id}>{s.Name || s.symbol}</option> // Fallback for name/symbol
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Date</label>
                        <input
                            type="datetime-local"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            required
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Open</label>
                            <input
                                type="number"
                                step="any"
                                name="open"
                                value={formData.open}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Close</label>
                            <input
                                type="number"
                                step="any"
                                name="close"
                                value={formData.close}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">High</label>
                            <input
                                type="number"
                                step="any"
                                name="high"
                                value={formData.high}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Low</label>
                            <input
                                type="number"
                                step="any"
                                name="low"
                                value={formData.low}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Volume</label>
                        <input
                            type="number"
                            name="volume"
                            value={formData.volume}
                            onChange={handleChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                        >
                            <Save size={18} />
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SymbolHistoryModal;
