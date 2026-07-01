import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react';
import { fetchStrategies, createStrategy, updateStrategy, deleteStrategy } from '../features/strategySlice';
import { fetchRules } from '../features/ruleSlice';
import { fetchWebhooks } from '../features/webhookSlice';

/* eslint-disable react-hooks/set-state-in-effect */

const RULE_GROUPS = [
    { key: 'entryRules', label: 'Entry Rules', labelClassName: 'text-blue-400' },
    { key: 'takeProfitRules', label: 'Take Profit Rules', labelClassName: 'text-green-400' },
    { key: 'stoplossRules', label: 'Stoploss Rules', labelClassName: 'text-red-400' },
    { key: 'exitRules', label: 'Exit Rules', labelClassName: 'text-yellow-400' }
];

const getRuleId = (rule) => rule?.documentId || rule?.id;

const StrategyModal = ({ isOpen, onClose, onSubmit, initialData, availableRules, availableWebhooks }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'Rules',
        webhook: '',
        entryRules: [],
        takeProfitRules: [],
        stoplossRules: [],
        exitRules: []
    });
    const [openRuleGroup, setOpenRuleGroup] = useState(null);
    const [ruleSearchTerms, setRuleSearchTerms] = useState({});

    useEffect(() => {
        if (initialData) {
            const fallbackRules = initialData.rules || [];
            const getInitialRules = (fieldName) => {
                const sourceRules = initialData[fieldName]?.length
                    ? initialData[fieldName]
                    : fieldName === 'entryRules' ? fallbackRules : [];

                return sourceRules.map(getRuleId).filter(Boolean);
            };

            setFormData({
                name: initialData.name || '',
                description: initialData.description || '',
                type: initialData.type || (initialData.webhook ? 'Webhook' : 'Rules'),
                webhook: initialData.webhook ? (initialData.webhook.documentId || initialData.webhook.id) : '',
                entryRules: getInitialRules('entryRules'),
                takeProfitRules: getInitialRules('takeProfitRules'),
                stoplossRules: getInitialRules('stoplossRules'),
                exitRules: getInitialRules('exitRules')
            });
        } else {
            setFormData({
                name: '',
                description: '',
                type: 'Rules',
                webhook: '',
                entryRules: [],
                takeProfitRules: [],
                stoplossRules: [],
                exitRules: []
            });
        }
        setOpenRuleGroup(null);
        setRuleSearchTerms({});
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            if (name === 'type') {
                return {
                    ...prev,
                    type: value,
                    webhook: value === 'Webhook' ? prev.webhook : '',
                    entryRules: value === 'Rules' ? prev.entryRules : [],
                    takeProfitRules: value === 'Rules' ? prev.takeProfitRules : [],
                    stoplossRules: value === 'Rules' ? prev.stoplossRules : [],
                    exitRules: value === 'Rules' ? prev.exitRules : []
                };
            }
            return { ...prev, [name]: value };
        });
    };

    const handleAddRule = (fieldName, ruleId) => {
        if (!formData[fieldName].includes(ruleId)) {
            setFormData(prev => ({ ...prev, [fieldName]: [...prev[fieldName], ruleId] }));
        }
        setOpenRuleGroup(null);
    };

    const handleRemoveRule = (fieldName, ruleId) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: prev[fieldName].filter(id => id !== ruleId)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const ruleIds = RULE_GROUPS.flatMap(group => formData[group.key]);

        onSubmit({
            ...formData,
            webhook: formData.type === 'Webhook' ? formData.webhook : null,
            rules: formData.type === 'Rules' ? [...new Set(ruleIds)] : [],
            entryRules: formData.type === 'Rules' ? formData.entryRules : [],
            takeProfitRules: formData.type === 'Rules' ? formData.takeProfitRules : [],
            stoplossRules: formData.type === 'Rules' ? formData.stoplossRules : [],
            exitRules: formData.type === 'Rules' ? formData.exitRules : []
        });
    };

    // Helper for badges
    const TypeBadge = ({ type }) => {
        const styles = {
            priceaction: 'bg-blue-500/20 text-blue-400',
            indicator: 'bg-purple-500/20 text-purple-400'
        };

        return (
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${styles[type] || 'bg-gray-500/20 text-gray-400'}`}>
                {type}
            </span>
        );
    };

    const RuleGroupSelector = ({ group }) => {
        const selectedIds = formData[group.key];
        const searchTerm = ruleSearchTerms[group.key] || '';
        const selectedRules = availableRules.filter(rule =>
            selectedIds.includes(rule.id) || selectedIds.includes(rule.documentId)
        );
        const rulesToSelect = availableRules.filter(rule => {
            const name = rule.Name || '';
            const description = rule.Description || '';

            return !selectedIds.includes(rule.id) &&
                !selectedIds.includes(rule.documentId) &&
                (name.toLowerCase().includes(searchTerm.toLowerCase()) || description.toLowerCase().includes(searchTerm.toLowerCase()));
        });
        const isScannerOpen = openRuleGroup === group.key;

        return (
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className={`block text-sm font-medium ${group.labelClassName}`}>{group.label}</label>
                    {!isScannerOpen && (
                        <button
                            type="button"
                            onClick={() => setOpenRuleGroup(group.key)}
                            className="text-xs flex items-center gap-1 bg-blue-600/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-600/30 transition"
                        >
                            <Plus size={14} /> Add Rule
                        </button>
                    )}
                </div>

                <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden mb-4">
                    <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-gray-700/50">
                            {selectedRules.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="p-4 text-center text-gray-500">No rules added yet.</td>
                                </tr>
                            ) : (
                                selectedRules.map(rule => (
                                    <tr key={getRuleId(rule)}>
                                        <td className="p-3 text-white">{rule.Name}</td>
                                        <td className="p-3"><TypeBadge type={rule.Type} /></td>
                                        <td className="p-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRule(group.key, getRuleId(rule))}
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

                {isScannerOpen && (
                    <div className="mt-4 border border-gray-700 rounded-xl p-4 bg-gray-900/30 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-300 text-sm">Add {group.label}</h4>
                            <button type="button" onClick={() => setOpenRuleGroup(null)} className="text-gray-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
                            <input
                                type="text"
                                placeholder="Search available rules..."
                                value={searchTerm}
                                onChange={(e) => setRuleSearchTerms(prev => ({ ...prev, [group.key]: e.target.value }))}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
                                autoFocus
                            />
                        </div>
                        <div className="rule-list max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {rulesToSelect.length === 0 ? (
                                <p className="text-gray-500 text-center py-4 text-sm">No matching rules found.</p>
                            ) : (
                                rulesToSelect.map(rule => (
                                    <button
                                        key={getRuleId(rule)}
                                        type="button"
                                        onClick={() => handleAddRule(group.key, getRuleId(rule))}
                                        className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 flex justify-between items-center group transition"
                                    >
                                        <div>
                                            <p className="text-gray-200 font-medium text-sm">{rule.Name}</p>
                                            <p className="text-gray-500 text-xs">{rule.Description}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <TypeBadge type={rule.Type} />
                                            <Plus size={16} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
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

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Type</label>
                        <select
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                        >
                            <option value="Rules">Rules</option>
                            <option value="Webhook">Webhook</option>
                        </select>
                    </div>

                    {formData.type === 'Webhook' ? (
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Webhook</label>
                            <select
                                name="webhook"
                                required
                                value={formData.webhook}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                            >
                                <option value="">Select webhook...</option>
                                {availableWebhooks.map(webhook => (
                                    <option key={webhook.documentId || webhook.id} value={webhook.documentId || webhook.id}>
                                        {webhook.Title || webhook.App || webhook.WebhookUrl || 'Untitled webhook'}
                                    </option>
                                ))}
                            </select>
                            {availableWebhooks.length === 0 && (
                                <p className="mt-2 text-sm text-gray-500">No webhooks found.</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {RULE_GROUPS.map(group => (
                                <RuleGroupSelector key={group.key} group={group} />
                            ))}
                        </div>
                    )}
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
    const { items: webhooks } = useSelector(state => state.webhooks);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStrategy, setEditingStrategy] = useState(null);

    useEffect(() => {
        dispatch(fetchStrategies());
        dispatch(fetchRules()); // Fetch rules so we can select them
        dispatch(fetchWebhooks());
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

    const getStrategyRuleCount = (strategy) => {
        const groupedRuleCount = RULE_GROUPS.reduce((count, group) => count + (strategy[group.key]?.length || 0), 0);
        return groupedRuleCount || strategy.rules?.length || 0;
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

                        {/* Show strategy source */}
                        <div className="mt-auto pt-4 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
                            <span>{strategy.type === 'Webhook' ? 'Webhook' : 'Rules'}</span>
                            <span className="text-gray-300 font-medium">
                                {strategy.type === 'Webhook'
                                    ? (strategy.webhook?.Title || strategy.webhook?.App || '-')
                                    : `${getStrategyRuleCount(strategy)}`}
                            </span>
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
                availableWebhooks={webhooks}
            />
        </div>
    );
};

export default ManageStrategies;
