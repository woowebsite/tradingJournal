import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const RuleModal = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState({
        Name: '',
        Description: '',
        Type: 'entry',
        Active: 'Enable',
        Rule: JSON.stringify({
            condition: "AND",
            rules: []
        }, null, 2)
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                Name: initialData.Name || '',
                Description: initialData.Description || '',
                Type: initialData.Type || 'entry',
                Active: initialData.Active || 'Enable',
                Rule: initialData.Rule ? JSON.stringify(initialData.Rule, null, 2) : JSON.stringify({
                    condition: "AND",
                    rules: []
                }, null, 2)
            });
        } else {
            setFormData({
                Name: '',
                Description: '',
                Type: 'entry',
                Active: 'Enable',
                Rule: JSON.stringify({
                    condition: "AND",
                    rules: []
                }, null, 2)
            });
        }
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                Rule: JSON.parse(formData.Rule)
            };
            onSubmit(payload);
        } catch (error) {
            alert('Invalid JSON in Rule field');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h3 className="text-xl font-bold text-white">
                        {initialData ? 'Edit Rule' : 'New Rule'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Name</label>
                        <input
                            type="text"
                            name="Name"
                            required
                            value={formData.Name}
                            onChange={handleChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                            placeholder="e.g. RSI Oversold"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Type</label>
                            <select
                                name="Type"
                                value={formData.Type}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                            >
                                <option value="entry">Entry</option>
                                <option value="takeprofit">Take Profit</option>
                                <option value="stoploss">Stop Loss</option>
                                <option value="exit">Exit</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Status</label>
                            <select
                                name="Active"
                                value={formData.Active}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                            >
                                <option value="Enable">Enable</option>
                                <option value="Disable">Disable</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Description</label>
                        <textarea
                            name="Description"
                            rows="2"
                            value={formData.Description}
                            onChange={handleChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-white"
                            placeholder="Brief description..."
                        ></textarea>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Rule (JSON Logic)</label>
                        <textarea
                            name="Rule"
                            rows="6"
                            value={formData.Rule}
                            onChange={handleChange}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm text-green-400"
                            placeholder="{ ... }"
                        ></textarea>
                        <p className="text-xs text-gray-500 mt-1">Define logic using JSON format.</p>
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
                            className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 flex items-center gap-2"
                        >
                            <Save size={18} />
                            Save Rule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RuleModal;
