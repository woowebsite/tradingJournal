import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';

const getRelationId = (relation) => relation?.documentId || relation?.id || '';

const ScoredModal = ({ isOpen, onClose, onSubmit, initialData, markets, defaultMarketId = '' }) => {
    const [formData, setFormData] = useState({
        Label: '',
        Description: '',
        Market: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                Label: initialData.Label || initialData.label || '',
                Description: initialData.Description || initialData.description || '',
                Market: getRelationId(initialData.Market || initialData.market) || defaultMarketId || ''
            });
        } else {
            setFormData({
                Label: '',
                Description: '',
                Market: defaultMarketId || ''
            });
        }
    }, [initialData, isOpen, defaultMarketId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/40">
                <div className="flex items-start justify-between border-b border-gray-800 bg-gray-800/40 p-5">
                    <div>
                        <h3 className="text-xl font-bold text-white">
                            {initialData ? 'Edit Scored' : 'New Scored'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-400">
                            Scored items are matched to trades through the same Market.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-5">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-400">Label</label>
                        <input
                            type="text"
                            name="Label"
                            value={formData.Label}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
                            placeholder="e.g. Trend aligned"
                            required
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-400">Market</label>
                        <select
                            name="Market"
                            value={formData.Market}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
                            required
                        >
                            <option value="">Select market</option>
                            {markets.map(market => {
                                const marketId = getRelationId(market);
                                return (
                                    <option key={marketId} value={marketId}>
                                        {market.Name || market.name || 'Unknown Market'}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-400">Description</label>
                        <textarea
                            name="Description"
                            value={formData.Description}
                            onChange={handleChange}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none transition focus:border-blue-500"
                            placeholder="Optional notes or scoring guideline"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-gray-300 transition hover:bg-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition hover:bg-blue-700"
                        >
                            <Save size={16} />
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ScoredModal;
