import { useState } from 'react';
import { Save, X } from 'lucide-react';

const DEFAULT_FORM = {
    Name: '',
    Description: '',
    exchange: '',
    sector: ''
};

const CreateSymbolModal = ({
    isOpen,
    onClose,
    onSubmit,
    initialName = '',
    isSubmitting = false
}) => {
    const [formData, setFormData] = useState(() => ({
        ...DEFAULT_FORM,
        Name: initialName || ''
    }));

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit?.({
            Name: String(formData.Name || '').trim(),
            Description: formData.Description || '',
            exchange: formData.exchange || '',
            sector: formData.sector || ''
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-700 bg-gray-900/50 p-4">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Create New Symbol
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 transition hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-gray-400">Name</label>
                            <input
                                type="text"
                                name="Name"
                                value={formData.Name}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white outline-none focus:border-purple-500"
                                placeholder="e.g. NNC"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-400">Exchange</label>
                            <input
                                type="text"
                                name="exchange"
                                value={formData.exchange}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white outline-none focus:border-purple-500"
                                placeholder="e.g. HOSE"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-400">Sector</label>
                            <input
                                type="text"
                                name="sector"
                                value={formData.sector}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white outline-none focus:border-purple-500"
                                placeholder="e.g. Banks"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-gray-400">Description</label>
                            <textarea
                                name="Description"
                                value={formData.Description}
                                onChange={handleChange}
                                rows="2"
                                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white outline-none focus:border-purple-500"
                                placeholder="Optional description"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-gray-300 transition hover:bg-gray-700"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 font-medium text-white shadow-lg shadow-purple-500/20 transition hover:bg-purple-700 disabled:opacity-50"
                        >
                            <Save size={18} />
                            {isSubmitting ? 'Creating...' : 'Save Symbol'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateSymbolModal;
