import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react';
import { fetchStrategies, createStrategy, updateStrategy, deleteStrategy } from '../features/strategySlice';
import { fetchRules, updateRule } from '../features/ruleSlice';
import { fetchWebhooks } from '../features/webhookSlice';
import RuleModal from '../components/RuleModal';

/* eslint-disable react-hooks/set-state-in-effect */

const RULE_GROUPS = [
    { key: 'entryRules', label: 'Entry Rules', labelClassName: 'text-blue-400' },
    { key: 'takeProfitRules', label: 'Take Profit Rules', labelClassName: 'text-green-400' },
    { key: 'stoplossRules', label: 'Stoploss Rules', labelClassName: 'text-red-400' },
    { key: 'exitRules', label: 'Exit Rules', labelClassName: 'text-yellow-400' }
];

const getRuleId = (rule) => {
    if (!rule) return null;
    if (typeof rule === 'object') return rule.documentId || rule.id || null;
    return rule;
};

const findAvailableRule = (id, availableRules) => {
    if (!id || !availableRules) return null;
    return availableRules.find(r => r.documentId === id || r.id === id || String(r.id) === String(id) || String(r.documentId) === String(id));
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

const RuleGroupSelector = ({
    group,
    formData,
    availableRules = [],
    openRuleGroup,
    setOpenRuleGroup,
    ruleSearchTerms,
    setRuleSearchTerms,
    handleAddRule,
    handleRemoveRule,
    handleRulePercentChange,
    handleRuleSignalTextChange,
    onEditRule
}) => {
    const selectedIds = formData[group.key] || [];
    const searchTerm = ruleSearchTerms[group.key] || '';
    const selectedRules = selectedIds.map(id => {
        return findAvailableRule(id, availableRules) || (typeof id === 'object' ? id : null);
    }).filter(Boolean);

    const supportsPercent = ['entryRules', 'takeProfitRules', 'stoplossRules'].includes(group.key);
    const rulesToSelect = (availableRules || []).filter(rule => {
        const name = rule.Name || '';
        const description = rule.Description || '';
        const ruleId = getRuleId(rule);

        const isAlreadySelected = selectedIds.some(id => {
            if (id === ruleId || id === rule.id || id === rule.documentId) return true;
            const matched = findAvailableRule(id, availableRules);
            return matched && (matched.documentId === rule.documentId || matched.id === rule.id);
        });

        return !isAlreadySelected &&
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
                                <td colSpan={supportsPercent ? 5 : 4} className="p-4 text-center text-gray-500">No rules added yet.</td>
                            </tr>
                        ) : (
                            selectedRules.map(rule => {
                                const ruleId = getRuleId(rule);
                                return (
                                    <tr key={ruleId}>
                                        <td className="p-3 text-white font-medium">{rule.Name}</td>
                                        <td className="p-3"><TypeBadge type={rule.Type} /></td>
                                        <td className="p-3 w-36">
                                            <input
                                                type="text"
                                                value={formData.ruleSignalTexts?.[ruleId] ?? ''}
                                                onChange={event => handleRuleSignalTextChange(ruleId, event.target.value)}
                                                className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none placeholder-gray-500"
                                                placeholder="Signal text..."
                                                title="Text hiển thị trên Chart (để trống sẽ dùng Rule Name)"
                                            />
                                        </td>
                                        {supportsPercent && (
                                             <td className="p-3 w-28">
                                                <label className="flex items-center gap-1 text-xs text-gray-400">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        value={formData.rulePercents?.[ruleId] ?? ''}
                                                        onChange={event => handleRulePercentChange(ruleId, event.target.value)}
                                                        className="w-16 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-right text-white focus:border-blue-500 focus:outline-none"
                                                        placeholder="0"
                                                    />
                                                    <span>%</span>
                                                </label>
                                            </td>
                                        )}
                                        <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => onEditRule?.(rule)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition"
                                                    title="Edit Rule"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRule(group.key, ruleId)}
                                                    className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                                                    title="Remove Rule"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
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
                                    onClick={() => handleAddRule(group.key, rule)}
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

export const StrategyModal = ({ isOpen, onClose, onSubmit, initialData, availableRules = [], availableWebhooks = [] }) => {
    const dispatch = useDispatch();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        template: '',
        type: 'Rules',
        webhook: '',
        entryRules: [],
        takeProfitRules: [],
        stoplossRules: [],
        exitRules: []
    });
    const [openRuleGroup, setOpenRuleGroup] = useState(null);
    const [ruleSearchTerms, setRuleSearchTerms] = useState({});
    const [editingRule, setEditingRule] = useState(null);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

    useEffect(() => {
        if (initialData) {
            const fallbackRules = initialData.rules || [];
            const getInitialRules = (fieldName) => {
                const sourceRules = initialData[fieldName]?.length
                    ? initialData[fieldName]
                    : fieldName === 'entryRules' ? fallbackRules : [];

                return sourceRules
                    .map(r => {
                        const rawId = getRuleId(r);
                        if (!rawId) return null;
                        const matched = findAvailableRule(rawId, availableRules);
                        if (availableRules && availableRules.length > 0) {
                            return matched ? (matched.documentId || matched.id) : null;
                        }
                        return rawId;
                    })
                    .filter(Boolean);
            };
            const rulePercents = {};
            const ruleSignalTexts = {};
            [...(initialData.entryRules || []), ...(initialData.takeProfitRules || []), ...(initialData.stoplossRules || []), ...(initialData.exitRules || []), ...(initialData.rules || [])]
                .forEach(rule => {
                    const rawId = getRuleId(rule);
                    const matched = findAvailableRule(rawId, availableRules);
                    const ruleId = matched ? (matched.documentId || matched.id) : rawId;
                    if (ruleId) {
                        rulePercents[ruleId] = (typeof rule === 'object' ? rule.percent : matched?.percent) ?? '';
                        ruleSignalTexts[ruleId] = (typeof rule === 'object' ? (rule.signalText || rule.signal_text) : (matched?.signalText || matched?.signal_text)) ?? '';
                    }
                });

            const rawWebhook = initialData.webhook;
            const webhookId = typeof rawWebhook === 'object' ? (rawWebhook?.documentId || rawWebhook?.id) : rawWebhook;

            setFormData({
                name: initialData.name || '',
                description: initialData.description || '',
                template: initialData.template || '',
                type: initialData.type || (webhookId ? 'Webhook' : 'Rules'),
                webhook: webhookId || '',
                entryRules: getInitialRules('entryRules'),
                takeProfitRules: getInitialRules('takeProfitRules'),
                stoplossRules: getInitialRules('stoplossRules'),
                exitRules: getInitialRules('exitRules'),
                rulePercents,
                ruleSignalTexts
            });
        } else {
            setFormData({
                name: '',
                description: '',
                template: '',
                type: 'Rules',
                webhook: '',
                entryRules: [],
                takeProfitRules: [],
                stoplossRules: [],
                exitRules: [],
                rulePercents: {},
                ruleSignalTexts: {}
            });
        }
        setOpenRuleGroup(null);
        setRuleSearchTerms({});
    }, [initialData, isOpen, availableRules]);

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

    const handleAddRule = (fieldName, rule) => {
        const ruleId = getRuleId(rule);
        if (!ruleId) return;

        const exists = formData[fieldName].some(id => {
            if (id === ruleId) return true;
            const matchedA = findAvailableRule(id, availableRules);
            const matchedB = findAvailableRule(ruleId, availableRules);
            return matchedA && matchedB && (matchedA.documentId === matchedB.documentId || matchedA.id === matchedB.id);
        });

        if (!exists) {
            setFormData(prev => ({
                ...prev,
                [fieldName]: [...prev[fieldName], ruleId],
                rulePercents: fieldName === 'exitRules'
                    ? prev.rulePercents
                    : { ...prev.rulePercents, [ruleId]: '' },
                ruleSignalTexts: {
                    ...prev.ruleSignalTexts,
                    [ruleId]: (typeof rule === 'object' ? (rule.signalText || rule.signal_text) : '') ?? ''
                }
            }));
        }
        setOpenRuleGroup(null);
    };

    const handleRemoveRule = (fieldName, ruleId) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: prev[fieldName].filter(id => {
                if (id === ruleId) return false;
                const matchedA = findAvailableRule(id, availableRules);
                const matchedB = findAvailableRule(ruleId, availableRules);
                if (matchedA && matchedB && (matchedA.documentId === matchedB.documentId || matchedA.id === matchedB.id)) {
                    return false;
                }
                return true;
            }),
            rulePercents: { ...prev.rulePercents, [ruleId]: undefined },
            ruleSignalTexts: { ...prev.ruleSignalTexts, [ruleId]: undefined }
        }));
    };

    const handleRulePercentChange = (ruleId, value) => {
        setFormData(prev => ({
            ...prev,
            rulePercents: { ...prev.rulePercents, [ruleId]: value }
        }));
    };

    const handleRuleSignalTextChange = (ruleId, value) => {
        setFormData(prev => ({
            ...prev,
            ruleSignalTexts: { ...prev.ruleSignalTexts, [ruleId]: value }
        }));
    };

    const handleEditRule = (rule) => {
        const rawId = getRuleId(rule);
        const fullRule = findAvailableRule(rawId, availableRules) || (typeof rule === 'object' ? rule : null);
        if (fullRule) {
            setEditingRule(fullRule);
            setIsRuleModalOpen(true);
        }
    };

    const handleRuleModalSubmit = async (data) => {
        try {
            if (editingRule) {
                const id = editingRule.documentId || editingRule.id;
                await dispatch(updateRule({ id, data })).unwrap();
            }
            dispatch(fetchRules());
            setIsRuleModalOpen(false);
        } catch (error) {
            console.error('Failed to save rule:', error);
            alert('Failed to save rule');
        }
    };

    const handleSubmit = (e) => {
        e?.preventDefault?.();
        
        const sanitizeRuleList = (list) => {
            if (!Array.isArray(list)) return [];
            return list
                .map(r => {
                    const rawId = getRuleId(r);
                    const matched = findAvailableRule(rawId, availableRules);
                    if (availableRules && availableRules.length > 0) {
                        return matched ? (matched.documentId || matched.id) : null;
                    }
                    return rawId;
                })
                .filter(Boolean);
        };

        const entryRules = formData.type === 'Rules' ? sanitizeRuleList(formData.entryRules) : [];
        const takeProfitRules = formData.type === 'Rules' ? sanitizeRuleList(formData.takeProfitRules) : [];
        const stoplossRules = formData.type === 'Rules' ? sanitizeRuleList(formData.stoplossRules) : [];
        const exitRules = formData.type === 'Rules' ? sanitizeRuleList(formData.exitRules) : [];
        const allRules = [...new Set([...entryRules, ...takeProfitRules, ...stoplossRules, ...exitRules])];

        onSubmit({
            ...formData,
            template: formData.template?.trim() || '',
            webhook: formData.type === 'Webhook' ? (formData.webhook || null) : null,
            rules: formData.type === 'Rules' ? allRules : [],
            entryRules,
            takeProfitRules,
            stoplossRules,
            exitRules,
            rulePercents: formData.rulePercents,
            ruleSignalTexts: formData.ruleSignalTexts
        });
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Chart Template</label>
                            <input
                                type="text"
                                name="template"
                                list="strategy-template-options"
                                value={formData.template}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                                placeholder="e.g. Supertrend, Ichimoku, VWAP"
                            />
                            <datalist id="strategy-template-options">
                                <option value="Supertrend" />
                                <option value="Ichimoku" />
                                <option value="VWAP" />
                            </datalist>
                        </div>
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
                                <RuleGroupSelector
                                    key={group.key}
                                    group={group}
                                    formData={formData}
                                    availableRules={availableRules}
                                    openRuleGroup={openRuleGroup}
                                    setOpenRuleGroup={setOpenRuleGroup}
                                    ruleSearchTerms={ruleSearchTerms}
                                    setRuleSearchTerms={setRuleSearchTerms}
                                    handleAddRule={handleAddRule}
                                    handleRemoveRule={handleRemoveRule}
                                    handleRulePercentChange={handleRulePercentChange}
                                    handleRuleSignalTextChange={handleRuleSignalTextChange}
                                    onEditRule={handleEditRule}
                                />
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

            {isRuleModalOpen && (
                <RuleModal
                    isOpen={isRuleModalOpen}
                    onClose={() => setIsRuleModalOpen(false)}
                    onSubmit={handleRuleModalSubmit}
                    initialData={editingRule}
                    zIndex="z-[60]"
                />
            )}
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
            const { rulePercents = {}, ruleSignalTexts = {}, ...strategyData } = data;
            if (editingStrategy) {
                const id = editingStrategy.documentId || editingStrategy.id;
                await dispatch(updateStrategy({ id, data: strategyData })).unwrap();
            } else {
                await dispatch(createStrategy(strategyData)).unwrap();
            }

            const ruleUpdates = new Map();
            Object.entries(rulePercents)
                .filter(([, percent]) => percent !== '' && percent !== undefined && percent !== null)
                .forEach(([ruleId, percent]) => {
                    ruleUpdates.set(ruleId, { ...(ruleUpdates.get(ruleId) || {}), percent: Number(percent) });
                });

            Object.entries(ruleSignalTexts)
                .forEach(([ruleId, signalText]) => {
                    if (signalText !== undefined && signalText !== null) {
                        ruleUpdates.set(ruleId, { ...(ruleUpdates.get(ruleId) || {}), signalText: String(signalText).trim() });
                    }
                });

            if (ruleUpdates.size > 0) {
                await Promise.all(
                    Array.from(ruleUpdates.entries()).map(([ruleId, updateData]) =>
                        dispatch(updateRule({ id: ruleId, data: updateData })).unwrap()
                    )
                );
                dispatch(fetchRules());
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
                        <p className="text-gray-400 text-sm h-20 overflow-hidden text-ellipsis mb-4 whitespace-pre-line">
                            {strategy.description || 'No description provided.'}
                        </p>

                        {/* Show strategy source & template */}
                        <div className="mt-auto pt-4 border-t border-gray-700 text-xs text-gray-500 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span>{strategy.type === 'Webhook' ? 'Webhook' : 'Rules'}</span>
                                {strategy.template && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                                        {strategy.template}
                                    </span>
                                )}
                            </div>
                            <span className="text-gray-300 font-medium">
                                {strategy.type === 'Webhook'
                                    ? (strategy.webhook?.Title || strategy.webhook?.App || '-')
                                    : `${getStrategyRuleCount(strategy)} rules`}
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
