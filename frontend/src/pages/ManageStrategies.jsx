import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react';
import { fetchStrategies, createStrategy, updateStrategy, deleteStrategy } from '../features/strategySlice';
import { fetchRules } from '../features/ruleSlice';

const StrategyModal = ({ isOpen, onClose, onSubmit, initialData, availableRules }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        rules: [] // Array of IDs
    });
    const [showRuleScanner, setShowRuleScanner] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                description: initialData.description || '',
                rules: initialData.rules ? initialData.rules.map(r => r.id || r.documentId) : []
            });
        } else {
            setFormData({
                name: '',
                description: '',
                rules: []
            });
        }
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddRule = (ruleId) => {
        if (!formData.rules.includes(ruleId)) {
            setFormData(prev => ({ ...prev, rules: [...prev.rules, ruleId] }));
        }
        setShowRuleScanner(false);
    };

    const handleRemoveRule = (ruleId) => {
        setFormData(prev => ({
            ...prev,
            rules: prev.rules.filter(id => id !== ruleId)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    // Get full rule objects for selected IDs
    const selectedRules = availableRules.filter(r => formData.rules.includes(r.id) || formData.rules.includes(r.documentId));

    // Filter available rules for scanner
    const rulesToSelect = availableRules.filter(r =>
        !formData.rules.includes(r.id) &&
        !formData.rules.includes(r.documentId) &&
        (r.Name.toLowerCase().includes(searchTerm.toLowerCase()) || r.Description?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Helper for badges
    const TypeBadge = ({ type }) => {
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${type === 'entry' ? 'bg-blue-500/20 text-blue-400' :
                type === 'takeprofit' ? 'bg-green-500/20 text-green-400' :
                    type === 'stoploss' ? 'bg-red-500/20 text-red-400' :
                        'bg-orange-500/20 text-orange-400'
                }`}>
                {type}
            </span>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h3 className="text-xl font-bold text-white">
                        {initialData ? 'Edit Strategy' : 'New Strategy'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Name</label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                                placeholder="e.g. Trend Following"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Description</label>
                            <textarea
                                name="description"
                                rows="2"
                                value={formData.description}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-white"
                                placeholder="Explain how this strategy works..."
                            ></textarea>
                        </div>
                    </div>

                    {/* Rules Table */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm text-gray-400">Associated Rules</label>
                            {!showRuleScanner && (
                                <button
                                    type="button"
                                    onClick={() => setShowRuleScanner(true)}
                                    className="text-xs flex items-center gap-1 bg-blue-600/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-600/30 transition"
                                >
                                    <Plus size={14} /> Add Rule
                                </button>
                            )}
                        </div>

                        <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden mb-4">
                            <table className="w-full text-left text-sm">
                                <thead className="text-gray-500 bg-gray-800/50">
                                    <tr>
                                        <th className="p-3 font-medium">Name</th>
                                        <th className="p-3 font-medium">Type</th>
                                        <th className="p-3 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/50">
                                    {selectedRules.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="p-4 text-center text-gray-500">No rules added yet.</td>
                                        </tr>
                                    ) : (
                                        selectedRules.map(r => (
                                            <tr key={r.id || r.documentId}>
                                                <td className="p-3 text-white">{r.Name}</td>
                                                <td className="p-3"><TypeBadge type={r.Type} /></td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRule(r.id || r.documentId)}
                                                        className="text-red-500 hover:text-red-400"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Inline Rule Scanner */}
                        {showRuleScanner && (
                            <div className="mt-4 border border-gray-700 rounded-xl p-4 bg-gray-900/30 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-gray-300 text-sm">Add Rule</h4>
                                    <button onClick={() => setShowRuleScanner(false)} className="text-gray-500 hover:text-white">
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search available rules..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
                                        autoFocus
                                    />
                                </div>
                                <div className="rule-list max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {rulesToSelect.length === 0 ? (
                                        <p className="text-gray-500 text-center py-4 text-sm">No matching rules found.</p>
                                    ) : (
                                        rulesToSelect.map(r => (
                                            <button
                                                key={r.id || r.documentId}
                                                type="button"
                                                onClick={() => handleAddRule(r.id || r.documentId)}
                                                className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 flex justify-between items-center group transition"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <p className="text-gray-200 font-medium text-sm">{r.Name}</p>
                                                        <p className="text-gray-500 text-xs">{r.Description}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <TypeBadge type={r.Type} />
                                                    <Plus size={16} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-700 flex justify-end gap-3 bg-gray-900/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 flex items-center gap-2"
                    >
                        <Save size={18} />
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

const ManageStrategies = () => {
    const dispatch = useDispatch();
    const { items: strategies, loading } = useSelector(state => state.strategies);
    const { items: rules } = useSelector(state => state.rules); // Get rules from store
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStrategy, setEditingStrategy] = useState(null);

    useEffect(() => {
        dispatch(fetchStrategies());
        dispatch(fetchRules()); // Fetch rules so we can select them
    }, [dispatch]);

    const handleCreate = () => {
        setEditingStrategy(null);
        setIsModalOpen(true);
    };

    const handleEdit = (strategy) => {
        setEditingStrategy(strategy);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this strategy?')) return;
        dispatch(deleteStrategy(id));
    };

    const handleModalSubmit = async (data) => {
        try {
            if (editingStrategy) {
                const id = editingStrategy.documentId || editingStrategy.id;
                await dispatch(updateStrategy({ id, data })).unwrap();
            } else {
                await dispatch(createStrategy(data)).unwrap();
            }
            setIsModalOpen(false);
            dispatch(fetchStrategies()); // Refetch to ensure everything is up to date (optional, but safer for relations)
        } catch (error) {
            console.error('Failed to save strategy:', error);
            alert('Failed to save strategy');
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Strategies</h1>
                    <p className="text-gray-400">Define and manage your trading strategies.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-lg shadow-blue-600/20"
                >
                    <Plus size={18} />
                    <span>New Strategy</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading && strategies.length === 0 && (
                    <div className="col-span-full text-center text-gray-500 py-12">Loading strategies...</div>
                )}

                {!loading && strategies.length === 0 && (
                    <div className="col-span-full text-center text-gray-500 py-12">No strategies found. create one!</div>
                )}

                {strategies.map(strategy => (
                    <div key={strategy.id || strategy.documentId} className="bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-sm hover:shadow-md transition group relative flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-white">{strategy.name}</h3>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(strategy)}
                                    className="p-1.5 text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-lg transition"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(strategy.documentId || strategy.id)}
                                    className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <p className="text-gray-400 text-sm h-20 overflow-hidden text-ellipsis mb-4">
                            {strategy.description || 'No description provided.'}
                        </p>

                        {/* Show rule count */}
                        <div className="mt-auto pt-4 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
                            <span>Rules</span>
                            <span className="text-gray-300 font-medium">{strategy.rules?.length || 0}</span>
                        </div>
                    </div>
                ))}
            </div>

            <StrategyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingStrategy}
                availableRules={rules}
            />
        </div>
    );
};

export default ManageStrategies;
