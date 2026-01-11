import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Edit, Trash2 } from 'lucide-react';
import api from '../services/api';
import { fetchRules, createRule, updateRule } from '../features/ruleSlice';
import RuleModal from '../components/RuleModal';

const ManageRules = () => {
    const dispatch = useDispatch();
    const { items: rules, loading } = useSelector(state => state.rules);
    const [filter, setFilter] = useState('All');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);

    useEffect(() => {
        dispatch(fetchRules());
    }, [dispatch]);

    const handleCreate = () => {
        setEditingRule(null);
        setIsModalOpen(true);
    };

    const handleEdit = (rule) => {
        setEditingRule(rule);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this rule?')) return;
        try {
            await api.delete(`/rules/${id}`);
            dispatch(fetchRules());
        } catch (error) {
            console.error('Failed to delete rule:', error);
        }
    };

    const handleModalSubmit = async (data) => {
        try {
            if (editingRule) {
                const id = editingRule.documentId || editingRule.id;
                await dispatch(updateRule({ id, data })).unwrap();
            } else {
                await dispatch(createRule(data)).unwrap();
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to save rule:', error);
            alert('Failed to save rule');
        }
    };

    // Filter logic
    const filteredRules = rules.filter(rule => {
        if (filter === 'All') return true;
        return rule.Active === filter;
    });

    const StatusBadge = ({ active }) => {
        const isEnabled = active === 'Enable';
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${isEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {active}
            </span>
        );
    };

    const TypeBadge = ({ type }) => {
        const colors = {
            entry: 'text-blue-400',
            takeprofit: 'text-green-400',
            stoploss: 'text-red-400',
            exit: 'text-orange-400'
        };
        return (
            <span className={`font-mono uppercase font-bold ${colors[type] || 'text-gray-400'}`}>
                {type}
            </span>
        );
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Rules</h1>
                    <p className="text-gray-400">Manage rule definitions and logic.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        {['All', 'Enable', 'Disable'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-lg shadow-blue-600/20"
                    >
                        <Plus size={18} />
                        <span>New Rule</span>
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-sm uppercase">
                            <tr>
                                <th className="p-4">Name</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Description</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">Loading rules...</td></tr>
                            ) : filteredRules.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No rules found.</td></tr>
                            ) : (
                                filteredRules.map(rule => (
                                    <tr key={rule.id || rule.documentId} className="hover:bg-gray-700/30 transition group">
                                        <td className="p-4 font-bold text-white max-w-xs truncate">{rule.Name}</td>
                                        <td className="p-4"><TypeBadge type={rule.Type} /></td>
                                        <td className="p-4 text-gray-300 max-w-md truncate">{rule.Description}</td>
                                        <td className="p-4"><StatusBadge active={rule.Active} /></td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(rule)}
                                                    className="p-2 text-gray-400 hover:text-white transition"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(rule.documentId || rule.id)}
                                                    className="p-2 text-red-500 hover:text-red-400 transition"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <RuleModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingRule}
            />
        </div>
    );
};

export default ManageRules;
