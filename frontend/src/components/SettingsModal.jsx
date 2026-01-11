import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, onSubmit, setting }) => {
    const [formData, setFormData] = useState({
        Name: '',
        riskPerTrade: '',
        maxDrawDown: '',
        capitalRisk: ''
    });

    useEffect(() => {
        if (setting) {
            setFormData({
                Name: setting.Name || '',
                riskPerTrade: setting.riskPerTrade || '',
                maxDrawDown: setting.maxDrawDown || '',
                capitalRisk: setting.capitalRisk || ''
            });
        } else {
            setFormData({
                Name: '',
                riskPerTrade: '',
                maxDrawDown: '',
                capitalRisk: ''
            });
        }
    }, [setting, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        {setting ? 'Edit Setting' : 'New Setting'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Name</label>
                        <input
                            type="text"
                            name="Name"
                            required
                            value={formData.Name || ''}
                            onChange={handleChange}
                            className="w-full bg-gray-700 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-white"
                            placeholder="e.g. Standard"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Risk % / Trade</label>
                            <input
                                type="number"
                                step="any"
                                name="riskPerTrade"
                                required
                                value={formData.riskPerTrade || ''}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-white"
                                placeholder="2"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Max Drawdown %</label>
                            <input
                                type="number"
                                step="any"
                                name="maxDrawDown"
                                required
                                value={formData.maxDrawDown || ''}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-white"
                                placeholder="20"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Capital Risk %</label>
                        <input
                            type="number"
                            step="any"
                            name="capitalRisk"
                            required
                            value={formData.capitalRisk || ''}
                            onChange={handleChange}
                            className="w-full bg-gray-700 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-white"
                            placeholder="6"
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
                            className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsModal;
