import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

const AccountModal = ({ isOpen, onClose, onSubmit, account }) => {
    const [formData, setFormData] = useState({
        name: '',
        initial_balance: '',
        currency: 'USD',
        market: '',
        strategy: '',
        moneyFormat: '#,###.##',
        volumeFormat: '###'
    });
    const [markets, setMarkets] = useState([]);
    const [strategies, setStrategies] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [marketsRes, strategiesRes] = await Promise.all([
                    api.get('/markets'),
                    api.get('/strategies?sort=name:asc')
                ]);

                const marketsData = marketsRes.data.data || [];
                setMarkets(marketsData.map(item => ({
                    id: item.id || item.documentId,
                    documentId: item.documentId,
                    Name: item.Name || item.name
                })));

                const strategiesData = strategiesRes.data.data || [];
                setStrategies(strategiesData.map(item => ({
                    id: item.id || item.documentId,
                    documentId: item.documentId,
                    name: item.name
                })));

            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (account) {
            setFormData({
                name: account.name || '',
                initial_balance: account.initial_balance || '',
                currency: account.currency || 'USD',
                market: account.market?.documentId || account.market?.id || account.market || '',
                strategy: account.strategy?.documentId || account.strategy?.id || account.strategy || '',
                moneyFormat: account.moneyFormat || '#,###.##',
                volumeFormat: account.volumeFormat || '###'
            });
        } else {
            setFormData({
                name: '',
                initial_balance: '',
                currency: 'USD',
                market: '',
                strategy: '',
                moneyFormat: '#,###.##',
                volumeFormat: '###'
            });
        }
    }, [account, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            initial_balance: parseFloat(formData.initial_balance)
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700 shadow-xl">
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        {account ? 'Edit Account' : 'New Account'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Account Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            placeholder="e.g. Binance Futures"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Initial Balance</label>
                        <input
                            type="number"
                            required
                            step="0.01"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            placeholder="0.00"
                            value={formData.initial_balance}
                            onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Currency</label>
                            <select
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                            >
                                <option value="USD">USD</option>
                                <option value="VND">VND</option>
                                <option value="EUR">EUR</option>
                                <option value="USDT">USDT</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Market</label>
                            <select
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                value={formData.market}
                                onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                                required
                            >
                                <option value="">Select Market</option>
                                {markets.map(m => (
                                    <option key={m.id} value={m.documentId || m.id}>
                                        {m.Name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Strategy (Optional)</label>
                        <select
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            value={formData.strategy}
                            onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                        >
                            <option value="">No Strategy</option>
                            {strategies.map(s => (
                                <option key={s.id} value={s.documentId || s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Money Format</label>
                            <input
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                placeholder="#,###.##"
                                value={formData.moneyFormat}
                                onChange={(e) => setFormData({ ...formData, moneyFormat: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Volume Format</label>
                            <input
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                placeholder="###"
                                value={formData.volumeFormat}
                                onChange={(e) => setFormData({ ...formData, volumeFormat: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 mt-6"
                    >
                        {account ? 'Save Changes' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AccountModal;
